"""FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.db import init_db, SessionLocal
from app.models import Base
from app.schemas import HealthResponse
from app.routers import auth
from app.seed import seed_db


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


app = FastAPI(
    title="FixTheCity Backend",
    description="API for the FixTheCity citizen and admin apps",
    version=settings.version,
    lifespan=lifespan,
)

# CORS middleware for web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # citizen web
        "http://localhost:3001",  # admin web
        "http://localhost:8081",  # mobile (expo)
        "http://127.0.0.1:8081",
    ],
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
