"""Duplicate detection: open incident, same category, within 250 m (haversine)."""

import math
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.logic.status import OPEN_STATUSES
from app.models import Incident

DUPLICATE_RADIUS_M = 250


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in metres."""
    r = 6_371_000

    def rad(d: float) -> float:
        return (d * math.pi) / 180

    d_lat = rad(lat2 - lat1)
    d_lng = rad(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(d_lng / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def is_within_radius(lat1: float, lng1: float, lat2: float, lng2: float, radius_m: float = DUPLICATE_RADIUS_M) -> bool:
    return haversine_m(lat1, lng1, lat2, lng2) <= radius_m


def find_nearby(
    db: Session,
    lat: float,
    lng: float,
    category_ids: Iterable[str],
    radius_m: float = DUPLICATE_RADIUS_M,
    exclude_id: str | None = None,
) -> list[tuple[Incident, float]]:
    """Open incidents of the given categories within radius_m, nearest first."""
    rows = (
        db.query(Incident)
        .filter(Incident.category_id.in_(list(category_ids)), Incident.status.in_(OPEN_STATUSES))
        .all()
    )
    out = []
    for other in rows:
        if other.id == exclude_id:
            continue
        d = haversine_m(lat, lng, other.lat, other.lng)
        if d <= radius_m:
            out.append((other, d))
    out.sort(key=lambda x: x[1])
    return out


def duplicate_match(incident: Incident, distance_m: float) -> dict:
    """Contract DuplicateMatch shape."""
    return {
        "incidentId": incident.id,
        "title": incident.title,
        "categoryId": incident.category_id,
        "distanceM": round(distance_m),
        "followers": incident.followers_count,
        "status": getattr(incident.status, "value", incident.status),
    }


def find_duplicates(db: Session, incident: Incident, radius_m: float = DUPLICATE_RADIUS_M) -> list[dict]:
    """DuplicateMatch[] for an incident: open, same category, within radius, not itself, nearest first."""
    nearby = find_nearby(db, incident.lat, incident.lng, [incident.category_id], radius_m, exclude_id=incident.id)
    return [duplicate_match(i, d) for i, d in nearby]
