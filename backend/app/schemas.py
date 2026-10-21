"""Pydantic schemas for API request/response bodies."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelCaseModel(BaseModel):
    """Base model with camelCase aliases."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ============================================================================
# Request/Response Schemas
# ============================================================================


class OTPRequestInput(BaseModel):
    """OTP request."""

    phone: str
    channel: str  # sms, whatsapp


class OTPVerifyInput(BaseModel):
    """OTP verification."""

    phone: str
    code: str


class StaffLoginInput(BaseModel):
    """Staff login request."""

    email: str
    password: str


class PriorityFactor(CamelCaseModel):
    """A single priority factor."""

    key: str
    label: str
    points: int
    max: int


class Priority(CamelCaseModel):
    """Priority score with factors."""

    score: int
    factors: List[PriorityFactor]


class Place(CamelCaseModel):
    """Geographic location."""

    lat: float
    lng: float
    address: str
    landmark: Optional[str] = None


class TimelineEntry(CamelCaseModel):
    """Timeline entry for an incident or service request."""

    status: str
    note: str
    actor: str
    at: str  # ISO timestamp


class Incident(CamelCaseModel):
    """Incident response (public fields)."""

    id: str
    category_id: str
    title: str
    severity: str
    priority: Priority
    status: str
    department: str
    estimated_cost_egp: int
    linked_report_ids: List[str]
    followers: int
    location: Place
    sensitive_place: Optional[str] = None
    area_underserved: bool
    work_order_id: Optional[str] = None
    eta: Optional[str] = None
    timeline: List[TimelineEntry]
    created_at: str
    updated_at: str
    is_following: Optional[bool] = None


class Report(CamelCaseModel):
    """Report response."""

    id: str
    reporter_id: str
    incident_id: str
    category_id: str
    description: str
    photo_uris: List[str]
    location: Place
    anonymous: bool
    blur_faces: bool
    created_at: str
    voice_note_uri: Optional[str] = None


class NewReportInput(CamelCaseModel):
    """New report input."""

    category_id: str
    description: str
    photo_uris: List[str]
    location: Place
    anonymous: bool
    blur_faces: bool
    voice_note_uri: Optional[str] = None
    link_to_incident_id: Optional[str] = None
    severity: Optional[str] = None
    governorate: Optional[str] = None
    district: Optional[str] = None


class ServiceRequest(CamelCaseModel):
    """Service request response."""

    id: str
    citizen_id: str
    service_type: str
    details: dict  # {items, day, slot, payment, note}
    location: Place
    status: str
    timeline: List[TimelineEntry]
    created_at: str


class MapPin(CamelCaseModel):
    """Lightweight pin for map."""

    id: str
    category_id: str
    title: str
    status: str
    severity: str
    lat: float
    lng: float
    critical: Optional[bool] = None


class LinkedReport(CamelCaseModel):
    """Linked report for admin view."""

    id: str
    reporter: str  # "مواطن" or "بلاغ بدون اسم"
    description: str
    source: str  # "app" or "web"
    photo_count: int
    created_at: str


class TriageSuggestion(CamelCaseModel):
    """Triage suggestion."""

    options: List[dict]  # [{categoryId, confidence}, ...]
    severity: str
    summary: str
    duplicates: List[dict]  # DuplicateMatch[]
    already_reported: Optional[List[dict]] = None


class AdminIncident(Incident):
    """Admin view of incident with extra fields."""

    linked_reports: List[LinkedReport]
    triage: Optional[dict] = None  # TriageSuggestion & {source, confirmed}
    due_at: str
    overdue: bool
    external: bool
    external_hotline: Optional[str] = None
    in_budget_plan: bool
    last_reviewed_by: Optional[str] = None
    last_reviewed_at: Optional[str] = None


class Department(CamelCaseModel):
    """Department."""

    id: str
    name_ar: str
    external: bool
    external_hotline: Optional[str] = None


class StaffSession(CamelCaseModel):
    """Staff login response."""

    user_id: str
    name: str
    title: str
    role: str  # staff, admin
    department: Optional[str] = None
    district: str
    token: str


class WorkOrderTask(CamelCaseModel):
    """Work order task."""

    label: str
    done: bool


class WorkOrderUpdate(CamelCaseModel):
    """Work order status update."""

    status: str
    note: str
    actor: str
    at: str


class WorkOrder(CamelCaseModel):
    """Work order."""

    id: str
    incident_id: Optional[str] = None
    service_request_id: Optional[str] = None
    title: str
    address: str
    department: str
    external: bool
    external_hotline: Optional[str] = None
    team: Optional[str] = None
    team_size: Optional[int] = None
    supervisor: Optional[str] = None
    status: str
    due_at: str
    overdue: bool
    estimated_cost_egp: int
    priority_score: Optional[int] = None
    followers: Optional[int] = None
    tasks: List[WorkOrderTask]
    updates: List[WorkOrderUpdate]
    created_at: str
    updated_at: str
    resolved_at: Optional[str] = None


class AdminServiceRequest(ServiceRequest):
    """Admin view of service request."""

    department: str
    paid: bool
    assignee: Optional[str] = None
    work_order_id: Optional[str] = None


class DashboardStats(CamelCaseModel):
    """Dashboard statistics."""

    open: int
    open_delta: int
    overdue: int
    resolved_this_week: int
    resolved_delta: int
    avg_resolution_days: int
    avg_resolution_delta_days: int
    by_category: List[dict]
    by_status: List[dict]
    overdue_list: List[dict]
    overdue_total: int
    departments: List[dict]
    activity: List[dict]
    nav: dict


class BudgetItem(CamelCaseModel):
    """Budget plan item."""

    incident_id: str
    title: str
    category_id: str
    cost_egp: int
    priority_score: int
    followers: int
    reason: str


class BudgetPlan(CamelCaseModel):
    """Budget plan."""

    budget_egp: int
    selected: List[BudgetItem]
    skipped: List[BudgetItem]
    total_cost: int
    remaining: int
    covered_priority: int
    total_priority: int
    citizens_served: int
    citizens_total: int


class Insights(CamelCaseModel):
    """AI insights."""

    summary: str
    hotspots: List[dict]
    rising_categories: List[dict]
    overdue_departments: List[str]


# ============================================================================
# Request Body Models
# ============================================================================


class PatchIncidentRequest(CamelCaseModel):
    """Patch incident request body."""

    status: Optional[str] = None
    severity: Optional[str] = None
    category_id: Optional[str] = None
    department: Optional[str] = None
    note: Optional[str] = None


class CreateWorkOrderRequest(CamelCaseModel):
    """Create work order request body."""

    incident_id: Optional[str] = None
    service_request_id: Optional[str] = None
    department: str  # Required
    team: Optional[str] = None
    team_size: Optional[int] = None
    supervisor: Optional[str] = None
    due_at: Optional[str] = None
    tasks: Optional[List[str]] = None
    estimated_cost_egp: Optional[int] = None


class PatchWorkOrderRequest(CamelCaseModel):
    """Patch work order request body."""

    status: Optional[str] = None
    note: Optional[str] = None
    team: Optional[str] = None
    team_size: Optional[int] = None
    supervisor: Optional[str] = None
    due_at: Optional[str] = None
    tasks: Optional[List[dict]] = None


class PatchServiceRequestRequest(CamelCaseModel):
    """Patch service request request body."""

    status: Optional[str] = None
    note: Optional[str] = None
    day: Optional[str] = None
    slot: Optional[str] = None
    assignee: Optional[str] = None


class BudgetOptimizeRequest(CamelCaseModel):
    """Budget optimize request body."""

    budget_egp: int  # Required, > 0
    incident_ids: Optional[List[str]] = None


class BudgetCommitRequest(CamelCaseModel):
    """Budget commit request body."""

    incident_ids: Optional[List[str]] = None  # List of incident IDs to commit


class TriageConfirmRequest(CamelCaseModel):
    """Triage confirm request body."""

    category_id: Optional[str] = None
    severity: Optional[str] = None


class MergeIncidentRequest(CamelCaseModel):
    """Merge incident request body."""

    into_incident_id: str  # ID of target incident


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    version: str
