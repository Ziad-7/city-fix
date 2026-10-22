"""Persistence/business-operation boundary for citizen routes.

The teammate implements this protocol transactionally using PostGIS and shared logic.
Methods must return per-caller isFollowing, sorted lists, and stored media paths.
"""

from typing import Annotated, Protocol

from fastapi import Depends, HTTPException, Request

from app.auth import User, current_user
from app.schemas.citizen import (
    CategoryId,
    Incident,
    MapPin,
    NewReport,
    NewServiceRequest,
    Report,
    ReportResult,
    ServiceRequest,
    Status,
)

Bounds = tuple[float, float, float, float]


class CitizenRepository(Protocol):
    def create_report(self, user_id: str, body: NewReport) -> ReportResult:
        """Atomic report/link + follow + priority + activity entry; check link rules."""
        ...

    def list_reports(self, user_id: str) -> list[Report]: ...
    def get_report(self, report_id: str) -> Report | None: ...
    def list_incidents(self, user_id: str) -> list[Incident]: ...
    def get_incident(self, incident_id: str, user_id: str) -> Incident | None: ...
    def follow_incident(self, incident_id: str, user_id: str) -> Incident:
        """Atomic/idempotent follow; recompute priority; raise 404 when absent."""
        ...

    def map_pins(
        self, status: Status | None, category: CategoryId | None, bbox: Bounds | None
    ) -> list[MapPin]: ...
    def create_service_request(
        self, user_id: str, body: NewServiceRequest
    ) -> ServiceRequest: ...
    def list_service_requests(self, user_id: str) -> list[ServiceRequest]: ...
    def get_service_request(self, request_id: str) -> ServiceRequest | None: ...


def get_citizen_repository(request: Request) -> CitizenRepository:
    repo: CitizenRepository = request.app.state.citizen_repository
    return repo


Citizen = Annotated[User, Depends(current_user)]
Repository = Annotated[CitizenRepository, Depends(get_citizen_repository)]


def check_owner(owner_id: str, user: User) -> None:
    if owner_id != user.id and user.role != "admin":
        raise HTTPException(403, "مش مسموح لك تشوف الطلب ده.")


def only_citizen(user: User) -> None:
    if user.role != "citizen":
        raise HTTPException(403, "الخدمة دي لحسابات المواطنين.")
