"""GET /map/incidents."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.logic.serialize import map_pin
from app.models import Incident

router = APIRouter(tags=["map"])


def parse_bbox(bbox: str) -> tuple[float, float, float, float]:
    """``minLng,minLat,maxLng,maxLat``; 400 when malformed."""
    try:
        min_lng, min_lat, max_lng, max_lat = (float(x) for x in bbox.split(","))
    except ValueError:
        raise HTTPException(status_code=400, detail="الإحداثيات مش صحيحة") from None
    if min_lng > max_lng or min_lat > max_lat:
        raise HTTPException(status_code=400, detail="الإحداثيات مش صحيحة")
    return min_lng, min_lat, max_lng, max_lat


@router.get("/map/incidents")
def map_incidents(
    status: str | None = None,
    categoryId: str | None = None,
    bbox: str | None = None,
    payload: dict = Depends(current_user),
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
    return [map_pin(i) for i in query.order_by(Incident.created_at.desc(), Incident.id.desc()).all()]
