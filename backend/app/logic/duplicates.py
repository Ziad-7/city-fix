"""Duplicate detection using haversine distance."""
import math
from sqlalchemy.orm import Session
from app.models import Incident


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate great-circle distance between two points in metres.
    Uses the haversine formula.
    """
    R = 6_371_000  # Earth radius in meters

    def rad(d: float) -> float:
        return (d * math.pi) / 180

    d_lat = rad(lat2 - lat1)
    d_lng = rad(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def is_within_radius(
    lat1: float, lng1: float, lat2: float, lng2: float, radius_m: float = 250
) -> bool:
    """Check if two points are within radius_m metres of each other."""
    return haversine_m(lat1, lng1, lat2, lng2) <= radius_m


def find_duplicates(db: Session, incident: Incident, radius_m: float = 250) -> list[dict]:
    """Find duplicate/similar incidents.

    Returns open incidents in the same category within radius_m.
    Excludes the incident itself.

    Args:
        db: Database session
        incident: The incident to find duplicates for
        radius_m: Search radius in metres

    Returns:
        List of dicts with {incidentId, title, address, distance, priorityScore, followersCount}
    """
    open_statuses = {"received", "triaged", "assigned", "in_progress"}

    duplicates = []
    for other in db.query(Incident).filter(
        Incident.category_id == incident.category_id,
        Incident.status.in_(open_statuses),
    ).all():
        if other.id == incident.id:
            continue

        distance = haversine_m(
            incident.lat, incident.lng,
            other.lat, other.lng
        )

        if distance <= radius_m:
            duplicates.append({
                "incidentId": other.id,
                "title": other.title,
                "address": other.address,
                "distance": int(distance),
                "priorityScore": other.priority_score,
                "followersCount": other.followers_count,
            })

    # Sort by priority desc
    duplicates.sort(key=lambda x: x["priorityScore"], reverse=True)

    return duplicates
