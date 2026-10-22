"""Local/test adapter only: no production priority, routing or scheduling logic."""

from datetime import UTC, datetime
from math import asin, cos, radians, sin, sqrt
from threading import RLock

from fastapi import HTTPException

from app.citizen import Bounds
from app.schemas.citizen import (
    CategoryId,
    Incident,
    MapPin,
    NewReport,
    NewServiceRequest,
    Priority,
    Report,
    ReportResult,
    ServiceRequest,
    Status,
    TimelineEntry,
)


class DemoCitizenRepository:
    def __init__(self) -> None:
        self.reports: dict[str, Report] = {}
        self.incidents: dict[str, Incident] = {}
        self.requests: dict[str, ServiceRequest] = {}
        self.followers: dict[str, set[str]] = {}
        self.lock = RLock()

    def create_report(self, user_id: str, body: NewReport) -> ReportResult:
        with self.lock:
            now = datetime.now(UTC)
            report_id = f"FTC-{1042 + len(self.reports)}"
            if body.link_to_incident_id:
                incident = self.incidents.get(body.link_to_incident_id)
                if incident is None:
                    raise HTTPException(404, "مش لاقيين المشكلة دي.")
                lat1, lat2 = radians(body.location.lat), radians(incident.location.lat)
                dlat = lat1 - lat2
                dlng = radians(body.location.lng - incident.location.lng)
                hav = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
                distance = 6371000 * 2 * asin(sqrt(min(1, hav)))
                if (
                    incident.category_id != body.category_id
                    or incident.status in {"resolved", "closed"}
                    or distance > 250
                ):
                    raise HTTPException(409, "البلاغ مش مطابق للمشكلة دي.")
            else:
                incident_id = f"INC-{len(self.incidents) + 1:04d}"
                incident = Incident(
                    id=incident_id,
                    category_id=body.category_id,
                    title=body.description[:100] or "بلاغ تجريبي بصورة",
                    severity=body.severity or "medium",
                    priority=Priority(score=0, factors=[]),
                    status="received",
                    department="تجريبي — بدون إسناد",
                    estimated_cost_egp=0,
                    linked_report_ids=[],
                    followers=0,
                    location=body.location,
                    area_underserved=False,
                    timeline=[
                        TimelineEntry(
                            status="received", note="وصل البلاغ", actor="النظام", at=now
                        )
                    ],
                    created_at=now,
                    updated_at=now,
                )
                self.incidents[incident_id] = incident
                self.followers[incident_id] = set()
            report = Report(
                id=report_id,
                reporter_id=user_id,
                incident_id=incident.id,
                category_id=body.category_id,
                description=body.description,
                photo_uris=body.photo_uris,
                voice_note_uri=body.voice_note_uri,
                location=body.location,
                anonymous=body.anonymous,
                blur_faces=body.blur_faces,
                created_at=now,
            )
            self.reports[report.id] = report
            incident.linked_report_ids.append(report.id)
            return ReportResult(
                report=report, incident=self.follow_incident(incident.id, user_id)
            )

    def list_reports(self, user_id: str) -> list[Report]:
        with self.lock:
            return sorted(
                (
                    r.model_copy(deep=True)
                    for r in self.reports.values()
                    if r.reporter_id == user_id
                ),
                key=lambda r: r.created_at,
                reverse=True,
            )

    def get_report(self, report_id: str) -> Report | None:
        with self.lock:
            value = self.reports.get(report_id)
            return value.model_copy(deep=True) if value else None

    def get_incident(self, incident_id: str, user_id: str) -> Incident | None:
        with self.lock:
            value = self.incidents.get(incident_id)
            return (
                value.model_copy(
                    deep=True,
                    update={"is_following": user_id in self.followers[incident_id]},
                )
                if value
                else None
            )

    def list_incidents(self, user_id: str) -> list[Incident]:
        with self.lock:
            return [
                value.model_copy(
                    deep=True,
                    update={"is_following": user_id in self.followers[value.id]},
                )
                for value in sorted(
                    self.incidents.values(), key=lambda i: i.created_at, reverse=True
                )
            ]

    def follow_incident(self, incident_id: str, user_id: str) -> Incident:
        with self.lock:
            if incident_id not in self.incidents:
                raise HTTPException(404, "مش لاقيين المشكلة دي.")
            self.followers[incident_id].add(user_id)
            incident = self.incidents[incident_id]
            incident.followers = len(self.followers[incident_id])
            incident.updated_at = datetime.now(UTC)
            return incident.model_copy(deep=True, update={"is_following": True})

    def map_pins(
        self, status: Status | None, category: CategoryId | None, bbox: Bounds | None
    ) -> list[MapPin]:
        with self.lock:
            values = sorted(
                self.incidents.values(), key=lambda i: i.created_at, reverse=True
            )
            return [
                MapPin(
                    id=i.id,
                    category_id=i.category_id,
                    title=i.title,
                    status=i.status,
                    severity=i.severity,
                    lat=i.location.lat,
                    lng=i.location.lng,
                )
                for i in values
                if (status is None or i.status == status)
                and (category is None or i.category_id == category)
                and (
                    bbox is None
                    or (
                        bbox[0] <= i.location.lng <= bbox[2]
                        and bbox[1] <= i.location.lat <= bbox[3]
                    )
                )
            ]

    def create_service_request(
        self, user_id: str, body: NewServiceRequest
    ) -> ServiceRequest:
        with self.lock:
            now = datetime.now(UTC)
            result = ServiceRequest(
                **body.model_dump(),
                id=f"SRV-{2001 + len(self.requests)}",
                citizen_id=user_id,
                status="received",
                created_at=now,
                timeline=[
                    TimelineEntry(
                        status="received", note="وصل الطلب", actor="النظام", at=now
                    )
                ],
            )
            self.requests[result.id] = result
            return result.model_copy(deep=True)

    def list_service_requests(self, user_id: str) -> list[ServiceRequest]:
        with self.lock:
            return sorted(
                (
                    r.model_copy(deep=True)
                    for r in self.requests.values()
                    if r.citizen_id == user_id
                ),
                key=lambda r: r.created_at,
                reverse=True,
            )

    def get_service_request(self, request_id: str) -> ServiceRequest | None:
        with self.lock:
            value = self.requests.get(request_id)
            return value.model_copy(deep=True) if value else None
