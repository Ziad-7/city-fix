"""Database-backed public map-pin query for the assembled API."""

from collections.abc import Callable

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Incident
from app.schemas.citizen import CategoryId, MapPin, Status

Bounds = tuple[float, float, float, float]
SessionFactory = Callable[[], Session]


class DatabaseMapRepository:
    def __init__(self, session_factory: SessionFactory = SessionLocal) -> None:
        self._session_factory = session_factory

    def map_pins(
        self,
        status: Status | None,
        category: CategoryId | None,
        bbox: Bounds | None,
    ) -> list[MapPin]:
        with self._session_factory() as db:
            query = db.query(Incident)
            if status is not None:
                query = query.filter(Incident.status == status)
            if category is not None:
                query = query.filter(Incident.category_id == category)
            if bbox is not None:
                west, south, east, north = bbox
                query = query.filter(
                    Incident.lng >= west,
                    Incident.lng <= east,
                    Incident.lat >= south,
                    Incident.lat <= north,
                )
            return [
                MapPin(
                    id=incident.id,
                    category_id=incident.category_id,
                    title=incident.title,
                    status=incident.status,
                    severity=incident.severity,
                    lat=incident.lat,
                    lng=incident.lng,
                )
                for incident in query.all()
            ]
