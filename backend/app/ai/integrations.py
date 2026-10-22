"""Adapters between CityBrain and the existing SQLAlchemy backend."""

import asyncio
import math

from sqlalchemy.orm import Session

from app.ai.schemas import CategoryId
from app.db import SessionLocal
from app.logic.duplicates import haversine_m
from app.models import Incident, IncidentFollower, IncidentStatusEnum, Report

OPEN_STATUSES = (
    IncidentStatusEnum.RECEIVED,
    IncidentStatusEnum.TRIAGED,
    IncidentStatusEnum.ASSIGNED,
    IncidentStatusEnum.IN_PROGRESS,
)


async def find_nearby_incidents(
    category_id: CategoryId,
    lat: float,
    lng: float,
    radius_m: float,
    user_id: str,
) -> dict[str, list[dict]]:
    """Find nearby open incidents, separating the caller's reports from join suggestions."""
    return await asyncio.to_thread(
        _find_nearby_with_session, category_id, lat, lng, radius_m, user_id
    )


def _find_nearby_with_session(
    category_id: CategoryId, lat: float, lng: float, radius_m: float, user_id: str
) -> dict[str, list[dict]]:
    with SessionLocal() as db:
        return _find_nearby(db, category_id, lat, lng, radius_m, user_id)


def _find_nearby(
    db: Session,
    category_id: CategoryId,
    lat: float,
    lng: float,
    radius_m: float,
    user_id: str,
) -> dict[str, list[dict]]:
    lat_delta = radius_m / 110_574
    lng_delta = radius_m / (111_320 * max(abs(math.cos(math.radians(lat))), 0.01))
    candidates = (
        db.query(Incident)
        .filter(
            Incident.category_id == category_id.value,
            Incident.status.in_(OPEN_STATUSES),
            Incident.lat.between(lat - lat_delta, lat + lat_delta),
            Incident.lng.between(lng - lng_delta, lng + lng_delta),
        )
        .all()
    )

    nearby = [
        (incident, haversine_m(lat, lng, incident.lat, incident.lng))
        for incident in candidates
    ]
    nearby = [
        (incident, distance) for incident, distance in nearby if distance <= radius_m
    ]
    if not nearby:
        return {"duplicates": [], "alreadyReported": []}

    incident_ids = [incident.id for incident, _ in nearby]
    own_reports = {
        report.incident_id: report
        for report in db.query(Report)
        .filter(Report.reporter_id == user_id, Report.incident_id.in_(incident_ids))
        .all()
    }
    followed_ids = {
        row.incident_id
        for row in db.query(IncidentFollower)
        .filter(
            IncidentFollower.user_id == user_id,
            IncidentFollower.incident_id.in_(incident_ids),
        )
        .all()
    }

    duplicates = []
    already_reported = []
    for incident, distance in sorted(nearby, key=lambda item: item[1]):
        if incident.id in own_reports:
            already_reported.append(
                {
                    "incidentId": incident.id,
                    "reportId": own_reports[incident.id].id,
                    "title": incident.title,
                    "categoryId": incident.category_id,
                    "distanceM": round(distance),
                }
            )
        elif incident.id not in followed_ids:
            duplicates.append(
                {
                    "incidentId": incident.id,
                    "title": incident.title,
                    "categoryId": incident.category_id,
                    "distanceM": round(distance),
                    "followers": incident.followers_count or 0,
                    "status": incident.status.value,
                }
            )

    return {"duplicates": duplicates, "alreadyReported": already_reported}
