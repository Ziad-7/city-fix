"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.db import init_db, SessionLocal
from app.admin_schemas import HealthResponse
from app.auth import AuthContext, AuthSettings, current_user
from app.auth_adapters import DatabaseStaffDirectory, DatabaseUserRepository
from app.map_repository import DatabaseMapRepository
from app.staff_auth import StaffLoginContext
from app.routers import auth, admin, map as citizen_map, staff_auth
from app.routers import uploads
from app.seed import seed_db
from app.ai.integrations import find_nearby_incidents
from app.ai.llm import GeminiClient
from app.ai.router import create_triage_router
from app.storage import SupabaseMediaStorage


async def load_approved_triage_photo(path: str, user_id: str, consent: bool) -> bytes:
    """Read only a consented caller-owned photo through the private storage adapter."""
    storage = getattr(app.state, "media_storage", None)
    if storage is None or not callable(getattr(storage, "read_approved", None)):
        raise HTTPException(503, "تحليل الصور مش متاح لحد ما التخزين الخاص يكون جاهز.")
    return await storage.read_approved(user_id, path, "report_photo", consent)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    # Startup
    init_db()

    # Check if we should seed
    if settings.seed_on_start:
        db = SessionLocal()
        try:
            # Check if database is empty (no incidents)
            from app.models import Incident

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
    title="FixTheCity Backend",
    description="API for the FixTheCity citizen and admin apps",
    version=settings.version,
    lifespan=lifespan,
)

# All app routers use one auth boundary. User roles and department permissions
# are reloaded from the database on each authenticated request.
app.state.auth_context = AuthContext(
    AuthSettings(
        jwt_secret=settings.jwt_secret,
        demo_otp=settings.otp_mode == "demo",
    ),
    DatabaseUserRepository(),
)
app.state.staff_login_context = StaffLoginContext(DatabaseStaffDirectory())
app.state.citizen_repository = DatabaseMapRepository()
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
] + settings.cors_origins.split(",")

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
        find_nearby_incidents=find_nearby_incidents,
        provider=(
            GeminiClient(api_key=settings.gemini_api_key, model=settings.gemini_model)
            if settings.gemini_api_key.strip()
            else None
        ),
        photo_analysis_enabled=settings.gemini_photo_analysis_enabled,
    )
)
app.include_router(staff_auth.router)
app.include_router(citizen_map.router)
app.include_router(admin.router)
app.include_router(admin.top_level_router)


# ============================================================================
# Error handlers
# ============================================================================


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors (422)."""
    return JSONResponse(status_code=422, content={"detail": "البيانات مش مكتملة"})


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions."""
    return JSONResponse(status_code=500, content={"detail": "حدث خطأ في الخادم"})
