"""GET /map/incidents."""

import math
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.admin_auth import current_claims
from app.db import get_db
from app.helpers import json_response
from app.logic.serialize import map_pin
from app.models import Incident
from app.schemas import CategoryId, IncidentStatus

router = APIRouter(tags=["map"])


def parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    """``minLng,minLat,maxLng,maxLat``; 400 when malformed."""
    try:
        min_lng, min_lat, max_lng, max_lat = (float(x) for x in bbox.split(","))
    except ValueError:
        raise HTTPException(status_code=400, detail="الإحداثيات مش صحيحة") from None
    values = (min_lng, min_lat, max_lng, max_lat)
    if not all(math.isfinite(v) for v in values):
        raise HTTPException(status_code=400, detail="الإحداثيات مش صحيحة")
    if not (-180 <= min_lng <= max_lng <= 180 and -90 <= min_lat <= max_lat <= 90):
        raise HTTPException(status_code=400, detail="الإحداثيات مش صحيحة")
    return min_lng, min_lat, max_lng, max_lat


@router.get("/map/incidents")
def map_incidents(
    status: IncidentStatus | None = None,
    categoryId: Annotated[CategoryId | None, Query()] = None,
    bbox: str | None = None,
    payload: dict = Depends(current_claims),
    db: Session = Depends(get_db),
):
    """MapPin[] (lightweight), optional filters status, categoryId, bbox."""
    query = db.query(Incident)
    if status:
        query = query.filter(Incident.status == status)
    if categoryId:
        query = query.filter(Incident.category_id == categoryId)
    if bbox:
        min_lng, min_lat, max_lng, max_lat = parse_bbox(bbox)
        query = query.filter(Incident.lng.between(min_lng, max_lng), Incident.lat.between(min_lat, max_lat))
    return json_response([map_pin(i) for i in query.order_by(Incident.created_at.desc(), Incident.id.desc()).all()])
