"""Shared domain operations used by the citizen and staff routers."""

from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.logic.ids import next_id
from app.logic.priority import compute_priority
from app.logic.status import change_incident_status
from app.logic.timeline import incident_timeline_entry
from app.models import (
    ActivityLog,
    Category,
    Department,
    Incident,
    IncidentFollower,
    Profile,
    Report,
    WorkOrder,
)

# Districts whose areas feed the "equity" priority factor (apps/mobile/src/domain/locations.ts).
UNDERSERVED_DISTRICTS = {"عين شمس", "شبرا", "فيصل", "إمبابة", "العجمي", "شبرا الخيمة", "القناطر الخيرية"}

DEFAULT_TASKS = ["معاينة الموقع", "تنفيذ الإصلاح", "تنضيف الموقع", "رفع صور بعد التنفيذ"]
TASKS_BY_CATEGORY = {
    "pothole": ["تأمين الموقع وتحويل المرور", "تكسير الحفرة وتنضيفها", "ردم وسفلتة", "رفع صور بعد الإصلاح"],
    "open_manhole": ["تأمين الموقع بحواجز", "تركيب غطا جديد", "اختبار التثبيت", "رفع صور بعد الإصلاح"],
    "sewage_overflow": ["تأمين الموقع", "كسح وتسليك الخط", "غسيل وتطهير", "رفع صور بعد الإصلاح"],
    "water_pipe_burst": ["قفل المحبس", "حفر وكشف الماسورة", "استبدال الجزء التالف", "ردم وتسوية"],
    "garbage": ["حصر الكمية", "تحميل ورفع المخلفات", "غسيل الموقع", "رفع صور بعد التنضيف"],
    "streetlight_out": ["فحص العمود والتغذية", "استبدال اللمبة أو الكابل", "اختبار الإنارة", "رفع صور بعد الإصلاح"],
    "exposed_wire": ["عزل المنطقة وفصل التيار", "تغيير الكابل التالف", "اختبار الأمان", "رفع صور بعد الإصلاح"],
    "fallen_tree": ["تأمين الموقع", "قص وتقطيع الفروع", "رفع المخلفات", "رفع صور بعد التنفيذ"],
    "broken_sidewalk": ["تحديد الجزء المكسور", "إزالة البلاط التالف", "تركيب بلاط جديد", "رفع صور بعد الإصلاح"],
}


def staff_department(payload: dict) -> str | None:
    """Department id a staff token is restricted to; None for admins."""
    return payload.get("department") if payload.get("role") == "staff" else None


def actor_name(db: Session, payload: dict) -> str:
    """Display name written to the activity log for a staff/admin token."""
    p = db.get(Profile, payload.get("sub"))
    return (p.name if p and p.name else None) or "موظف"


def resolve_department(db: Session, value: str) -> Department:
    """Accept a department id or its Arabic name; 422 when unknown."""
    d = db.get(Department, value) or db.query(Department).filter(Department.name_ar == value).first()
    if not d:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")
    return d


def recompute_priority(db: Session, inc: Incident, category: Category | None = None) -> None:
    """Recompute and store priority from the DB (reporters = linked reports, whole days open)."""
    category = category or db.get(Category, inc.category_id)
    created = inc.created_at if inc.created_at.tzinfo else inc.created_at.replace(tzinfo=now_utc().tzinfo)
    p = compute_priority(
        {
            "severity": getattr(inc.severity, "value", inc.severity),
            "near_sensitive_place": bool(inc.sensitive_place),
            "reporters": db.query(Report).filter(Report.incident_id == inc.id).count(),
            "days_open": max(0, (now_utc() - created).days),
            "target_days": category.target_days if category else 5,
            "area_underserved": bool(inc.area_underserved),
        }
    )
    inc.priority_score = p["score"]
    inc.priority_factors = p["factors"]


def ensure_follower(db: Session, incident_id: str, user_id: str) -> bool:
    """Add a follower row if the user neither follows nor reported the incident. True if newly added."""
    follows = db.get(IncidentFollower, (incident_id, user_id)) is not None
    reported = db.query(Report).filter(Report.incident_id == incident_id, Report.reporter_id == user_id).first()
    if not follows:
        db.add(IncidentFollower(incident_id=incident_id, user_id=user_id))
    return not follows and reported is None


def create_report(
    db: Session, user_id: str, data, category: Category, link_to: Incident | None
) -> tuple[Report, Incident]:
    """Create a report; link to an existing incident (adds a follower) or open a new incident."""
    now = now_utc()
    loc = data.location
    if link_to is not None:
        inc = link_to
        if ensure_follower(db, inc.id, user_id):
            inc.followers_count = (inc.followers_count or 0) + 1
    else:
        severity = data.severity or category.default_severity
        dept = db.get(Department, category.department_id)
        street = loc.address.split("،")[0] if loc.address else ""
        underserved = (data.district or "") in UNDERSERVED_DISTRICTS
        inc = Incident(
            id=next_id(db, "INC"),
            category_id=category.id,
            title=f"{category.label_ar} · {street}" if street else category.label_ar,
            severity=severity,
            status="received",
            department_id=category.department_id,
            estimated_cost_egp=category.estimated_cost_egp,
            followers_count=1,
            lat=loc.lat,
            lng=loc.lng,
            address=loc.address,
            landmark=loc.landmark,
            area_underserved=underserved,
            eta="خلال ٣ أيام",
            priority_score=0,
            priority_factors=[],
            created_at=now,
            updated_at=now,
        )
        db.add(inc)
        db.flush()
        entry = incident_timeline_entry("received", category.label_ar, severity, dept.name_ar if dept else "", now)
        db.add(
            ActivityLog(
                entity_type="incident",
                entity_id=inc.id,
                status="received",
                note=entry["note"],
                actor=entry["actor"],
                kind="status_change",
                at=now,
            )
        )
        db.add(IncidentFollower(incident_id=inc.id, user_id=user_id))

    report = Report(
        id=next_id(db, "FTC"),
        reporter_id=user_id,
        incident_id=inc.id,
        category_id=data.category_id,
        description=data.description,
        photo_paths=list(data.photo_uris),
        voice_note_path=data.voice_note_uri,
        lat=loc.lat,
        lng=loc.lng,
        address=loc.address,
        landmark=loc.landmark,
        anonymous=data.anonymous,
        blur_faces=data.blur_faces,
        severity_suggested=data.severity,
        source=data.source,
        created_at=now,
    )
    db.add(report)
    db.flush()
    recompute_priority(db, inc, category)
    inc.updated_at = now
    return report, inc


def create_work_order(
    db: Session,
    inc: Incident | None,
    department: Department,
    actor: str,
    *,
    service_request_id: str | None = None,
    team: str | None = None,
    team_size: int | None = None,
    supervisor: str | None = None,
    due_at: datetime | None = None,
    tasks: list[str] | None = None,
    move_note: str | None = None,
) -> WorkOrder:
    """The one work-order creation path (also used by budget commit).

    Defaults come from the incident's category (title/tasks/cost/due date). Moves the incident
    to ``assigned`` only when it is still received/triaged.
    """
    cat = db.get(Category, inc.category_id) if inc else None
    wo = WorkOrder(
        id=next_id(db, "WO"),
        incident_id=inc.id if inc else None,
        service_request_id=service_request_id,
        department_id=department.id,
        team=team,
        team_size=team_size,
        supervisor=supervisor,
        status="assigned" if team else "open",
        due_at=due_at or now_utc() + timedelta(days=cat.target_days if cat else 3),
        estimated_cost_egp=inc.estimated_cost_egp if inc else None,
        tasks=[
            {"label": t, "done": False} for t in (tasks or TASKS_BY_CATEGORY.get(cat.id if cat else "", DEFAULT_TASKS))
        ],
    )
    db.add(wo)
    db.flush()
    db.add(
        ActivityLog(
            entity_type="work_order",
            entity_id=wo.id,
            status=wo.status.value if hasattr(wo.status, "value") else wo.status,
            note="اتفتح أمر الشغل",
            actor=actor,
            kind="status_change",
            at=now_utc(),
        )
    )
    if inc:
        inc.work_order_id = wo.id
        if getattr(inc.status, "value", inc.status) in ("received", "triaged"):
            change_incident_status(db, inc, "assigned", move_note or f"اتحوّل لـ{department.name_ar}", actor)
    return wo
