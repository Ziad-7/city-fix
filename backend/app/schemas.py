"""Pydantic request bodies (camelCase aliases) and the few typed responses.

Invalid enum values fail validation -> 422 ``{"detail": "البيانات مش مكتملة"}`` (see main.py).
Responses are built as plain dicts by ``app.logic.serialize`` (None omitted).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

IncidentStatus = Literal["received", "triaged", "assigned", "in_progress", "resolved", "closed"]
Severity = Literal["low", "medium", "high", "critical"]
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
WorkOrderStatus = Literal["open", "assigned", "in_progress", "done"]
ServiceType = Literal["bulky_waste", "tree_maintenance"]
PaymentMethod = Literal["cash", "fawry", "instapay", "wallet"]
SlotId = Literal["morning", "afternoon"]
OtpChannel = Literal["sms", "whatsapp"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --------------------------------------------------------------------------- auth
class OTPRequestInput(CamelModel):
    phone: str
    channel: OtpChannel = "sms"


class OTPVerifyInput(CamelModel):
    phone: str
    code: str


class StaffLoginInput(CamelModel):
    email: str
    password: str


class StaffSession(CamelModel):
    user_id: str
    name: str
    title: str
    role: Literal["staff", "admin"]
    department: str | None = None
    district: str
    token: str | None = None  # omitted by GET /auth/me


class HealthResponse(BaseModel):
    status: str
    version: str


# --------------------------------------------------------------------------- citizen
class PlaceInput(CamelModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str = ""
    landmark: str | None = None


class NewReportInput(CamelModel):
    category_id: CategoryId
    description: str = ""
    photo_uris: list[str] = []
    location: PlaceInput
    anonymous: bool = False
    blur_faces: bool = False
    voice_note_uri: str | None = None
    link_to_incident_id: str | None = None
    severity: Severity | None = None
    governorate: str | None = None
    district: str | None = None
    source: Literal["app", "web"] = "app"


class ServiceDetailsInput(CamelModel):
    items: list[str] = []
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    slot: SlotId
    payment: PaymentMethod | None = None  # optional: absent for free tree_maintenance
    note: str | None = None
    work_type: str | None = None
    photo_uris: list[str] | None = None


class NewServiceRequestInput(CamelModel):
    service_type: ServiceType
    details: ServiceDetailsInput
    location: PlaceInput


class TriageInput(CamelModel):
    description: str = ""
    category_id: CategoryId | None = None
    photo_uri: str | None = None
    location: PlaceInput | None = None


class UploadSignInput(CamelModel):
    kind: Literal["report_photo", "voice_note"]
    content_type: str = "image/jpeg"


class ReopenInput(CamelModel):
    note: str = ""


# --------------------------------------------------------------------------- staff / admin
class PatchIncidentRequest(CamelModel):
    status: IncidentStatus | None = None
    severity: Severity | None = None
    category_id: CategoryId | None = None
    department: str | None = None  # department id or Arabic name
    note: str | None = None


class CreateWorkOrderRequest(CamelModel):
    incident_id: str | None = None
    service_request_id: str | None = None
    department: str  # department id or Arabic name
    team: str | None = None
    team_size: int | None = Field(default=None, ge=0)
    supervisor: str | None = None
    due_at: str | None = None
    tasks: list[str] | None = None


class WorkOrderTaskInput(CamelModel):
    label: str
    done: bool = False


class PatchWorkOrderRequest(CamelModel):
    status: WorkOrderStatus | None = None
    team: str | None = None
    team_size: int | None = Field(default=None, ge=0)
    supervisor: str | None = None
    due_at: str | None = None
    tasks: list[WorkOrderTaskInput] | None = None
    note: str | None = None


class PatchServiceRequestRequest(CamelModel):
    status: IncidentStatus | None = None
    day: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    slot: SlotId | None = None
    assignee: str | None = None
    note: str | None = None


class BudgetOptimizeRequest(CamelModel):
    budget_egp: int = Field(gt=0)
    incident_ids: list[str] | None = None


class BudgetCommitRequest(CamelModel):
    incident_ids: list[str]


class TriageConfirmRequest(CamelModel):
    category_id: CategoryId | None = None
    severity: Severity | None = None


class MergeIncidentRequest(CamelModel):
    into_incident_id: str
