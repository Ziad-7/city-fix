"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai.integrations import find_nearby_incidents_with_session
from app.ai.llm import GeminiClient
from app.ai.router import create_triage_router
from app.ai.schemas import CategoryId
from app.ai.transcribe import GeminiAudioTranscriber, create_transcription_router
from app.ai.waste import GeminiWasteClassifier, create_waste_router
from app.auth import AuthContext, AuthSettings, current_user
from app.auth_adapters import DatabaseStaffDirectory, DatabaseUserRepository
from app.config import settings, validate_settings
from app.db import SessionLocal, get_db, init_db
from app.models import Incident
from app.otp import TwilioVerifyProvider
from app.routers import (
    admin,
    analytics,
    auth,
    bins,
    incidents,
    map,
    notifications,
    recycling,
    recycling_admin,
    reports,
    service_requests,
    staff_auth,
    uploads,
)
from app.schemas import HealthResponse
from app.seed import seed_db
from app.staff_auth import StaffLoginContext
from app.storage import SupabaseMediaStorage

logger = logging.getLogger("fixthecity")


async def load_approved_triage_photo(path: str, user_id: str, consent: bool) -> bytes:
    """Read only a consented caller-owned photo through the private storage adapter."""
    storage = getattr(app.state, "media_storage", None)
    if storage is None or not callable(getattr(storage, "read_approved", None)):
        raise HTTPException(503, "تحليل الصور مش متاح لحد ما التخزين الخاص يكون جاهز.")
    return await storage.read_approved(user_id, path, "report_photo", consent)


async def find_nearby_incidents_from_db(
    category_id: CategoryId, lat: float, lng: float, radius_m: float, user_id: str
) -> dict[str, list[dict]]:
    """Duplicates / alreadyReported from the app database (honours ``get_db`` overrides)."""
    provider = app.dependency_overrides.get(get_db, get_db)

    def run() -> dict[str, list[dict]]:
        sessions = provider()
        db = next(sessions)
        try:
            return find_nearby_incidents_with_session(db, category_id, lat, lng, radius_m, user_id)
        finally:
            sessions.close()

    return await asyncio.to_thread(run)


async def load_authorized_voice_note(path: str, user_id: str) -> tuple[bytes, str]:
    """Read only an authenticated caller-owned voice note from private storage."""
    storage = getattr(app.state, "media_storage", None)
    if storage is None or not callable(getattr(storage, "read_voice_note", None)):
        raise HTTPException(503, "تحويل الصوت لنص مش متاح لحد ما التخزين الخاص يكون جاهز.")
    return await storage.read_voice_note(user_id, path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    # Startup
    validate_settings()
    if settings.database_url.startswith("sqlite") and settings.local_schema_bootstrap:
        init_db()
    if getattr(app.state, "media_storage", None) is None and not settings.local_upload_stub_allowed:
        logger.warning(
            "Media storage is not configured: /uploads/sign answers 503 (set SUPABASE_* or ALLOW_LOCAL_UPLOAD_STUB)"
        )

    # Check if we should seed
    if settings.database_url.startswith("sqlite") and settings.seed_on_start:
        db = SessionLocal()
        try:
            # Check if database is empty (no incidents)
            incident_count = db.query(Incident).count()
            if incident_count == 0:
                seed_db(db)
        finally:
            db.close()

    yield
    # Shutdown
    media_storage = getattr(app.state, "media_storage", None)
    if isinstance(media_storage, SupabaseMediaStorage):
        await media_storage.aclose()
        media_storage.close()


app = FastAPI(
    title="CityFix Backend",
    description="API for the CityFix citizen and admin apps",
    version=settings.version,
    lifespan=lifespan,
)

# One auth boundary for every router: roles and department scope are reloaded from the database
# on each authenticated request (tests swap these contexts for ones bound to their own engine).
app.state.auth_context = AuthContext(
    AuthSettings(
        jwt_secret=settings.jwt_secret,
        demo_otp=settings.otp_mode == "demo",
        token_minutes=settings.token_minutes,
    ),
    DatabaseUserRepository(),
)
app.state.staff_login_context = StaffLoginContext(DatabaseStaffDirectory())
app.state.otp_provider = (
    TwilioVerifyProvider(
        settings.twilio_account_sid,
        settings.twilio_auth_token,
        settings.twilio_verify_service_sid,
    )
    if settings.otp_mode in {"twilio", "real"}
    and settings.twilio_account_sid.strip()
    and settings.twilio_auth_token.strip()
    and settings.twilio_verify_service_sid.strip()
    else None
)
# Optional private-media storage (Supabase); None = local upload stub.
if settings.supabase_url.strip() and settings.supabase_service_role_key.strip():
    app.state.media_storage = SupabaseMediaStorage(
        settings.supabase_url,
        settings.supabase_service_role_key,
        settings.supabase_media_bucket,
    )
else:
    app.state.media_storage = None

# CORS middleware for web clients
cors_origins = [
    "http://localhost:8081",  # mobile (expo)
    "http://127.0.0.1:8081",
] + [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health check
# ============================================================================


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(status="ok", version=settings.version)


# ============================================================================
# Router registration
# ============================================================================

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(
    create_triage_router(
        get_current_user=current_user,
        load_authorized_photo=load_approved_triage_photo,
        find_nearby_incidents=find_nearby_incidents_from_db,
        provider=(
            GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
            if settings.gemini_api_key.strip()
            else None
        ),
        photo_analysis_enabled=settings.gemini_photo_analysis_enabled,
    )
)
app.include_router(
    create_transcription_router(
        get_current_user=current_user,
        load_authorized_voice=load_authorized_voice_note,
        provider=(
            GeminiAudioTranscriber(
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
            )
            if settings.gemini_api_key.strip()
            else None
        ),
    )
)
app.include_router(
    create_waste_router(
        get_current_user=current_user,
        load_authorized_photo=load_approved_triage_photo,
        classifier=(
            GeminiWasteClassifier(settings.gemini_api_key, settings.gemini_model)
            if settings.gemini_api_key.strip()
            else None
        ),
        photo_analysis_enabled=settings.gemini_photo_analysis_enabled,
    )
)
app.include_router(staff_auth.router)
app.include_router(admin.router)
app.include_router(admin.top_level_router)
app.include_router(reports.router)
app.include_router(incidents.router)
app.include_router(map.router)
app.include_router(service_requests.router)
app.include_router(bins.iot_router)
app.include_router(analytics.router)
app.include_router(bins.admin_router)
app.include_router(bins.public_router)
app.include_router(recycling.router)
app.include_router(recycling_admin.router)
app.include_router(notifications.router)


# ============================================================================
# Error handlers
# ============================================================================


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors (422)."""
    return JSONResponse(status_code=422, content={"detail": "البيانات مش مكتملة"})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions (logged, short Arabic message to the client)."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "حدث خطأ في الخادم"})
