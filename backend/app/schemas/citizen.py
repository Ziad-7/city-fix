"""Citizen API shapes mirroring apps/mobile/src/domain/types.ts."""

from datetime import date
from typing import Annotated, Literal, Self

from pydantic import AwareDatetime, ConfigDict, Field, field_validator, model_validator

from app.schemas.auth import ApiModel

CategoryId = Literal[
    "pothole",
    "open_manhole",
    "sewage_overflow",
    "water_pipe_burst",
    "garbage",
    "streetlight_out",
    "exposed_wire",
    "road_obstruction",
    "stray_dogs",
    "fallen_tree",
    "broken_sidewalk",
    "other",
]
Status = Literal["received", "triaged", "assigned", "in_progress", "resolved", "closed"]
Severity = Literal["low", "medium", "high", "critical"]
ShortText = Annotated[str, Field(min_length=1, max_length=500)]


class InputModel(ApiModel):
    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, allow_inf_nan=False
    )


class Place(InputModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str = Field(min_length=3, max_length=500)
    landmark: str | None = Field(default=None, max_length=500)


class NewReport(InputModel):
    category_id: CategoryId
    description: str = Field(max_length=10000)
    photo_uris: list[ShortText] = Field(max_length=10)
    location: Place
    anonymous: bool
    blur_faces: bool
    voice_note_uri: ShortText | None = None
    link_to_incident_id: ShortText | None = None
    severity: Severity | None = None
    governorate: ShortText | None = None
    district: ShortText | None = None

    @model_validator(mode="after")
    def enough_detail(self) -> Self:
        if not self.photo_uris and len(self.description) < 10:
            raise ValueError("ضيف صورة أو اكتب وصف للمشكلة (١٠ حروف على الأقل)")
        return self


class TimelineEntry(ApiModel):
    status: Status
    note: str
    actor: str
    at: AwareDatetime


class PriorityFactor(ApiModel):
    key: str
    label: str
    points: float
    max: float


class Priority(ApiModel):
    score: int = Field(ge=0, le=100)
    factors: list[PriorityFactor]


class Report(ApiModel):
    id: str
    reporter_id: str
    incident_id: str
    category_id: CategoryId
    description: str
    photo_uris: list[str]
    location: Place
    anonymous: bool
    blur_faces: bool
    created_at: AwareDatetime
    voice_note_uri: str | None = None


class Incident(ApiModel):
    id: str
    category_id: CategoryId
    title: str
    severity: Severity
    priority: Priority
    status: Status
    department: str
    estimated_cost_egp: int = Field(ge=0)
    linked_report_ids: list[str]
    followers: int = Field(ge=0)
    location: Place
    sensitive_place: str | None = None
    area_underserved: bool
    work_order_id: str | None = None
    eta: str | None = None
    timeline: list[TimelineEntry]
    created_at: AwareDatetime
    updated_at: AwareDatetime
    is_following: bool = False


class ReportResult(ApiModel):
    report: Report
    incident: Incident


class BookingDetails(InputModel):
    items: list[ShortText] = Field(min_length=1, max_length=30)
    day: str = Field(pattern=r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
    slot: Literal["morning", "afternoon"]
    payment: Literal["cash", "fawry", "instapay", "wallet"]
    note: str | None = Field(default=None, max_length=2000)

    @field_validator("day")
    @classmethod
    def valid_date(cls, value: str) -> str:
        date.fromisoformat(value)
        return value


class NewServiceRequest(InputModel):
    service_type: Literal["bulky_waste", "tree_maintenance"]
    details: BookingDetails
    location: Place


class ServiceRequest(NewServiceRequest):
    id: str
    citizen_id: str
    status: Status
    timeline: list[TimelineEntry]
    created_at: AwareDatetime


class MapPin(ApiModel):
    id: str
    category_id: CategoryId
    title: str
    status: Status
    severity: Severity
    lat: float
    lng: float
