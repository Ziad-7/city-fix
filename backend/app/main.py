"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Incident
from app.routers import admin, auth, incidents, map, reports, service_requests, triage, uploads
from app.schemas import HealthResponse
from app.seed import seed_db

logger = logging.getLogger("fixthecity")


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
            incident_count = db.query(Incident).count()
            if incident_count == 0:
                seed_db(db)
        finally:
            db.close()

    yield
    # Shutdown


app = FastAPI(
    title="FixTheCity Backend",
    description="API for the FixTheCity citizen and admin apps",
    version=settings.version,
    lifespan=lifespan,
)

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
app.include_router(admin.router)
app.include_router(admin.top_level_router)
app.include_router(reports.router)
app.include_router(incidents.router)
app.include_router(map.router)
app.include_router(service_requests.router)
app.include_router(triage.router)
app.include_router(uploads.router)


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
