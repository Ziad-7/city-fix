"""Database models using SQLAlchemy 2.0."""
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    DateTime,
    Enum,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship
import enum


def utc_now():
    """Get current time as timezone-aware UTC."""
    return datetime.now(timezone.utc)

Base = declarative_base()


class IncidentStatusEnum(str, enum.Enum):
    """Incident status enumeration."""

    RECEIVED = "received"
    TRIAGED = "triaged"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SeverityEnum(str, enum.Enum):
    """Severity enumeration."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class WorkOrderStatusEnum(str, enum.Enum):
    """Work order status enumeration."""

    OPEN = "open"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class Profile(Base):
    """Citizen or staff profile."""

    __tablename__ = "profiles"

    id = Column(String(50), primary_key=True)  # FTC-1042, etc. or UUID for staff
    phone = Column(String(20), unique=True, nullable=True)  # +20...
    name = Column(String(255), nullable=True)
    role = Column(String(20), default="citizen")  # citizen, staff, admin
    governorate = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    prefs = Column(JSON, default={})
    created_at = Column(DateTime, default=utc_now)


class Department(Base):
    """Department managing incidents/work orders."""

    __tablename__ = "departments"

    id = Column(String(100), primary_key=True)
    name_ar = Column(String(255), nullable=False)
    external_hotline = Column(String(20), nullable=True)
    district = Column(String(100), nullable=True)


class Category(Base):
    """Incident category."""

    __tablename__ = "categories"

    id = Column(String(50), primary_key=True)  # pothole, open_manhole, etc.
    label_ar = Column(String(255), nullable=False)
    danger = Column(Boolean, default=False)
    default_severity = Column(String(20), default="low")
    department_id = Column(String(100), ForeignKey("departments.id"), nullable=True)
    target_days = Column(Integer, default=5)
    estimated_cost_egp = Column(Integer, default=1000)


class Incident(Base):
    """Incident (citizen report, aggregated)."""

    __tablename__ = "incidents"

    id = Column(String(50), primary_key=True)  # INC-501, etc.
    category_id = Column(String(50), ForeignKey("categories.id"), nullable=False)
    title = Column(String(500), nullable=False)
    severity = Column(Enum(SeverityEnum), default=SeverityEnum.MEDIUM)
    status = Column(Enum(IncidentStatusEnum), default=IncidentStatusEnum.RECEIVED)
    department_id = Column(String(100), ForeignKey("departments.id"), nullable=True)
    estimated_cost_egp = Column(Integer, default=1000)
    priority_score = Column(Integer, default=0)
    priority_factors = Column(JSON, default=[])  # List of {key, label, points, max}
    followers_count = Column(Integer, default=0)
    # Location: lat/lng as floats
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    landmark = Column(String(255), nullable=True)
    sensitive_place = Column(String(255), nullable=True)
    area_underserved = Column(Boolean, default=False)
    work_order_id = Column(String(50), nullable=True)
    eta = Column(String(255), nullable=True)
    last_reviewed_by = Column(String(255), nullable=True)  # I1: staff who confirmed triage
    last_reviewed_at = Column(DateTime, nullable=True)  # I1: when triage was confirmed
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    # Indexes for common queries
    __table_args__ = (
        Index("idx_incident_status_category", "status", "category_id"),
        Index("idx_incident_lat_lng", "lat", "lng"),
        Index("idx_incident_created_at", "created_at"),
    )


class Report(Base):
    """Citizen report linked to an incident."""

    __tablename__ = "reports"

    id = Column(String(50), primary_key=True)  # FTC-1042, etc.
    reporter_id = Column(String(50), ForeignKey("profiles.id"), nullable=False)
    incident_id = Column(String(50), ForeignKey("incidents.id"), nullable=False)
    category_id = Column(String(50), ForeignKey("categories.id"), nullable=False)
    description = Column(Text, nullable=True)
    photo_paths = Column(JSON, default=[])  # List of strings (S3 paths)
    voice_note_path = Column(String(500), nullable=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    landmark = Column(String(255), nullable=True)
    anonymous = Column(Boolean, default=False)
    blur_faces = Column(Boolean, default=False)
    severity_suggested = Column(String(20), nullable=True)
    source = Column(String(20), default="app")  # I1: "app" or "web"
    created_at = Column(DateTime, default=utc_now)


class IncidentFollower(Base):
    """Track who follows an incident."""

    __tablename__ = "incident_followers"

    incident_id = Column(String(50), ForeignKey("incidents.id"), primary_key=True)
    user_id = Column(String(50), ForeignKey("profiles.id"), primary_key=True)
    created_at = Column(DateTime, default=utc_now)


class ServiceRequest(Base):
    """Service request (bulky waste, tree maintenance, etc.)."""

    __tablename__ = "service_requests"

    id = Column(String(50), primary_key=True)  # SRV-2001, etc.
    citizen_id = Column(String(50), ForeignKey("profiles.id"), nullable=False)
    service_type = Column(String(50), nullable=False)  # bulky_waste, tree_maintenance
    details = Column(JSON, nullable=False)  # {items, day, slot, payment, note}
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    address = Column(String(500), nullable=False)
    landmark = Column(String(255), nullable=True)
    status = Column(Enum(IncidentStatusEnum), default=IncidentStatusEnum.RECEIVED)
    paid = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)


class WorkOrder(Base):
    """Work order assigned to a department/team."""

    __tablename__ = "work_orders"

    id = Column(String(50), primary_key=True)  # WO-318, etc.
    incident_id = Column(String(50), ForeignKey("incidents.id"), nullable=True)
    service_request_id = Column(String(50), ForeignKey("service_requests.id"), nullable=True)
    department_id = Column(String(100), ForeignKey("departments.id"), nullable=False)
    team = Column(String(255), nullable=True)
    team_size = Column(Integer, nullable=True)
    supervisor = Column(String(255), nullable=True)
    status = Column(Enum(WorkOrderStatusEnum), default=WorkOrderStatusEnum.OPEN)
    due_at = Column(DateTime, nullable=True)
    estimated_cost_egp = Column(Integer, nullable=True)
    tasks = Column(JSON, default=[])  # List of {label, done}
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    resolved_at = Column(DateTime, nullable=True)


class ActivityLog(Base):
    """Log of status changes and actions."""

    __tablename__ = "activity_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False)  # incident, service_request, work_order
    entity_id = Column(String(50), nullable=False)
    status = Column(String(50), nullable=True)
    note = Column(Text, nullable=True)
    actor = Column(String(255), nullable=False)
    kind = Column(String(50), default="status_change")
    at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_activity_entity", "entity_type", "entity_id"),
        Index("idx_activity_at", "at"),
    )


class StaffAccount(Base):
    """Staff login credentials."""

    __tablename__ = "staff_accounts"

    profile_id = Column(String(50), ForeignKey("profiles.id"), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    department_id = Column(String(100), ForeignKey("departments.id"), nullable=True)


class AISuggestion(Base):
    """AI suggestions and transcriptions."""

    __tablename__ = "ai_suggestions"

    id = Column(String(50), primary_key=True)
    report_id = Column(String(50), ForeignKey("reports.id"), nullable=True)
    kind = Column(String(50), nullable=False)  # triage, transcript, insight
    payload = Column(JSON, nullable=False)
    model = Column(String(100), nullable=True)
    latency_ms = Column(Integer, nullable=True)
    accepted = Column(Boolean, nullable=True)
    created_at = Column(DateTime, default=utc_now)


class BudgetPlan(Base):
    """Saved budget plan."""

    __tablename__ = "budget_plans"

    id = Column(String(50), primary_key=True)
    budget_egp = Column(Integer, nullable=False)
    selected = Column(JSON, nullable=False)  # List of incident IDs
    skipped = Column(JSON, nullable=False)
    total_cost = Column(Integer, nullable=False)
    remaining = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utc_now)
