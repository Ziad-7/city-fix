"""Staff-scoped forecasts and operational analytics."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.admin_auth import require_admin, require_staff
from app.analytics_schemas import (
    BinForecastResponse,
    HotspotsResponse,
    OptimizeRoutesInput,
    OptimizeRoutesResponse,
)
from app.db import get_db
from app.logic.bin_forecast import forecast_bins
from app.logic.hotspots import cluster_incidents
from app.logic.route_optimizer import optimize_pickups

router = APIRouter(tags=["analytics"])


@router.get("/admin/bins/forecast", response_model=BinForecastResponse)
def bins_forecast(
    horizon_hours: int = Query(default=24, alias="horizonHours", ge=1, le=168),
    claims: dict = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    return forecast_bins(db, claims, horizon_hours, now=datetime.now(timezone.utc))


@router.post("/admin/recycling/routes/optimize", response_model=OptimizeRoutesResponse)
def routes_optimize(
    request: OptimizeRoutesInput, claims: dict = Depends(require_admin), db: Session = Depends(get_db)
) -> dict:
    return optimize_pickups(db, claims, request)


@router.get("/admin/hotspots", response_model=HotspotsResponse)
def garbage_hotspots(
    days: int = Query(default=30, ge=1, le=90),
    radius_meters: int = Query(default=500, alias="radiusMeters", ge=100, le=2000),
    min_count: int = Query(default=3, alias="minCount", ge=3, le=20),
    claims: dict = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    return cluster_incidents(
        db, claims, days=days, radius_meters=radius_meters, min_count=min_count, now=datetime.now(timezone.utc)
    )
