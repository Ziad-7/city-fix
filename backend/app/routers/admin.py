"""Admin and staff API routes."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.db import get_db
from app.config import settings
from app.admin_auth import require_staff, require_admin
from app.models import (
    Incident,
    Report,
    WorkOrder,
    ServiceRequest,
    Department,
    Category,
    IncidentFollower,
    ActivityLog,
    BudgetPlan,
    AISuggestion,
)
from app.admin_schemas import (
    PatchIncidentRequest,
    CreateWorkOrderRequest,
    PatchWorkOrderRequest,
    PatchServiceRequestRequest,
    BudgetOptimizeRequest,
    BudgetCommitRequest,
    TriageConfirmRequest,
    MergeIncidentRequest,
)
from app.logic.serialize import admin_incident, work_order, admin_service_request
from app.logic.dashboard import build_dashboard
from app.logic.budget import optimize_budget
from app.logic.insights import generate_insights
from app.logic.status import (
    change_incident_status,
    change_work_order_status,
    change_service_request_status,
)
from app.logic.ids import next_id
from app.logic.duplicates import find_duplicates
from app.logic.priority import compute_priority
from app.helpers import now_utc
from app.seed import TEAMS, seed_db

router = APIRouter(prefix="/admin", tags=["admin"])
# Separate router for non-prefixed routes (e.g., /incidents/{id})
top_level_router = APIRouter(tags=["incidents"])


def _database_utc_datetime(value: str | None) -> datetime | None:
    """Normalize aware ISO datetimes to naive UTC for DateTime(timezone=False) columns."""
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.utcoffset() is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


# ============================================================================
# Departments
# ============================================================================


@router.get("/departments")
async def list_departments(
    payload: dict = Depends(require_staff), db: Session = Depends(get_db)
):
    """List all departments."""
    depts = db.query(Department).all()
    return [
        {
            "id": d.id,
            "nameAr": d.name_ar,
            "external": bool(d.external_hotline),
            "externalHotline": d.external_hotline,
        }
        for d in depts
    ]


# ============================================================================
# Teams
# ============================================================================


@router.get("/teams")
async def list_teams(payload: dict = Depends(require_staff)):
    """List all teams (from seed data)."""
    return TEAMS


# ============================================================================
# Dashboard
# ============================================================================


@router.get("/dashboard")
async def get_dashboard(
    range: str = Query("7d"),
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get dashboard statistics."""
    # Staff see only their department
    staff_dept = None
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")

    stats = build_dashboard(db, range, staff_dept)
    return stats


# ============================================================================
# Incidents
# ============================================================================


@router.get("/incidents")
async def list_incidents(
    status: Optional[str] = Query(None),
    categoryId: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    critical: Optional[bool] = Query(None),
    overdue: Optional[bool] = Query(None),
    q: Optional[str] = Query(None),
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """
    List incidents.
    - If staff: only their department
    - If no status filter: returns ALL incidents (open + resolved + closed)
    - Returns sorted by priority desc
    """
    # Get all incidents
    incidents = db.query(Incident).all()

    # Filter by department (staff can only see their own)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if staff_dept:
            incidents = [i for i in incidents if i.department_id == staff_dept]

    # Apply filters
    if status:
        incidents = [i for i in incidents if i.status == status]

    if categoryId:
        incidents = [i for i in incidents if i.category_id == categoryId]

    if department:
        incidents = [i for i in incidents if i.department_id == department]

    if critical:
        incidents = [i for i in incidents if i.severity == "critical"]

    if overdue and overdue is True:
        now = now_utc()
        filtered = []
        for incident in incidents:
            if incident.status not in (
                "received",
                "triaged",
                "assigned",
                "in_progress",
            ):
                continue
            category = db.query(Category).filter_by(id=incident.category_id).first()
            if not category:
                continue
            created_at = incident.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            deadline = created_at + timedelta(days=category.target_days)
            if now > deadline:
                filtered.append(incident)
        incidents = filtered

    if q:
        incidents = [
            i
            for i in incidents
            if q.lower() in i.title.lower() or q.lower() in i.address.lower()
        ]

    # Sort by priority desc
    incidents.sort(key=lambda i: i.priority_score, reverse=True)

    return [admin_incident(db, inc) for inc in incidents]


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Get incident detail."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Check department access (staff only)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if incident.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    return admin_incident(db, incident)


async def _patch_incident_impl(
    incident_id: str, update: PatchIncidentRequest, payload: dict, db: Session
):
    """Implementation shared by /incidents/{id} and /admin/incidents/{id}."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Check department access
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if incident.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    # Validate enum fields
    if update.status and update.status not in (
        "received",
        "triaged",
        "assigned",
        "in_progress",
        "resolved",
    ):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")
    if update.severity and update.severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # If status is changing, note is required
    if update.status and update.status != incident.status:
        if not update.note:
            raise HTTPException(status_code=400, detail="اكتب رسالة للمواطنين")

    # Apply updates
    if update.status:
        new_status = update.status
        note = update.note or ""
        actor = payload.get("sub", "staff")
        change_incident_status(db, incident, new_status, note, actor)

    if update.severity:
        incident.severity = update.severity

    if update.category_id:
        incident.category_id = update.category_id
        # Recompute priority
        category = db.query(Category).filter_by(id=incident.category_id).first()
        created_at = incident.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        days_open = max(0, int((now_utc() - created_at).days))
        priority = compute_priority(
            {
                "severity": incident.severity,
                "near_sensitive_place": bool(incident.sensitive_place),
                "reporters": db.query(Report)
                .filter_by(incident_id=incident.id)
                .count(),
                "days_open": days_open,
                "target_days": category.target_days if category else 5,
                "area_underserved": incident.area_underserved,
            }
        )
        incident.priority_score = priority["score"]
        incident.priority_factors = priority["factors"]

    if update.department:
        incident.department_id = update.department

    # A3: note-only PATCH appends timeline entry with current status
    if update.note and not update.status:
        actor = payload.get("sub", "staff")
        activity = ActivityLog(
            entity_type="incident",
            entity_id=incident.id,
            status=incident.status,
            note=update.note,
            actor=actor,
            kind="status_change",
            at=now_utc(),
        )
        db.add(activity)

    db.commit()
    return admin_incident(db, incident)


@router.patch("/incidents/{incident_id}")
async def patch_incident(
    incident_id: str,
    update: PatchIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update incident (admin route)."""
    return await _patch_incident_impl(incident_id, update, payload, db)


# C2: Top-level /incidents/{id} route
@top_level_router.patch("/incidents/{incident_id}")
async def patch_incident_top_level(
    incident_id: str,
    update: PatchIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update incident (top-level route)."""
    return await _patch_incident_impl(incident_id, update, payload, db)


@router.get("/incidents/{incident_id}/similar")
async def get_similar_incidents(
    incident_id: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """I4: Get duplicate/similar incidents within 250m, same category, open only. Staff scoped."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    # I4: Check department access (staff only)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if incident.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    duplicates = find_duplicates(db, incident)
    return duplicates


@router.post("/incidents/{incident_id}/merge")
async def merge_incidents(
    incident_id: str,
    data: MergeIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """I4: Merge reports and followers from source into target incident. Staff scoped."""
    source = db.query(Incident).filter_by(id=incident_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="مش موجود")

    target_id = data.into_incident_id
    if target_id == source.id:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")
    target = db.query(Incident).filter_by(id=target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="مش موجود")

    # I4: Check department access (staff only)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if source.department_id != staff_dept or target.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    # Move reports from source to target
    reports = db.query(Report).filter_by(incident_id=source.id).all()
    for report in reports:
        report.incident_id = target.id

    # Move followers from source to target
    followers = db.query(IncidentFollower).filter_by(incident_id=source.id).all()
    for follower in followers:
        # Check if already following target
        existing = (
            db.query(IncidentFollower)
            .filter_by(incident_id=target.id, user_id=follower.user_id)
            .first()
        )
        if not existing:
            follower.incident_id = target.id

    # Close source with note
    actor = payload.get("sub", "staff")
    change_incident_status(db, source, "closed", f"تم دمج البلاغ في {target_id}", actor)

    # Update target followers count
    target.followers_count = (
        db.query(IncidentFollower).filter_by(incident_id=target.id).count()
    )

    db.commit()
    return admin_incident(db, target)


@router.post("/incidents/{incident_id}/triage/confirm")
async def confirm_triage(
    incident_id: str,
    data: TriageConfirmRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """I2: Confirm AI triage suggestion. Only moves received→triaged, not other statuses."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    if payload.get("role") == "staff" and incident.department_id != payload.get(
        "department"
    ):
        raise HTTPException(status_code=403, detail="مش مسموح")

    # Validate enum fields
    if (
        data.category_id
        and not db.query(Category).filter_by(id=data.category_id).first()
    ):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")
    if data.severity and data.severity not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # Update incident with triage data
    if data.category_id:
        incident.category_id = data.category_id

    if data.severity:
        incident.severity = data.severity

    # I2: Recompute priority after category/severity update
    category = db.query(Category).filter_by(id=incident.category_id).first()
    created_at = incident.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    days_open = max(0, int((now_utc() - created_at).days))
    priority = compute_priority(
        {
            "severity": incident.severity,
            "near_sensitive_place": bool(incident.sensitive_place),
            "reporters": db.query(Report).filter_by(incident_id=incident.id).count(),
            "days_open": days_open,
            "target_days": category.target_days if category else 5,
            "area_underserved": incident.area_underserved,
        }
    )
    incident.priority_score = priority["score"]
    incident.priority_factors = priority["factors"]

    # Mark triage as confirmed in AI suggestions
    first_report = db.query(Report).filter_by(incident_id=incident_id).first()
    if first_report:
        ai_sug = (
            db.query(AISuggestion)
            .filter(
                AISuggestion.report_id == first_report.id,
                AISuggestion.kind == "triage",
            )
            .first()
        )
        if ai_sug and ai_sug.payload:
            ai_sug.payload["confirmed"] = True
            flag_modified(ai_sug, "payload")

    # I2: Record reviewer name + time
    actor = payload.get("sub", "staff")
    incident.last_reviewed_by = actor
    incident.last_reviewed_at = now_utc()

    # I2: Only move from received to triaged (other statuses unchanged)
    if incident.status == "received":
        # I2: Write timeline note with category label
        category_label = category.label_ar if category else data.category_id or "تصنيف"
        change_incident_status(
            db, incident, "triaged", f"اتأكّد التصنيف: {category_label}", actor
        )
    else:
        # Don't change status if not received, just record the update
        pass

    db.commit()
    return admin_incident(db, incident)


# ============================================================================
# Work Orders
# ============================================================================


@router.get("/work-orders")
async def list_work_orders(
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """List work orders, filtered by department for staff."""
    orders = db.query(WorkOrder).all()

    # Filter by department (staff can only see their own)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if staff_dept:
            orders = [o for o in orders if o.department_id == staff_dept]

    if status:
        orders = [o for o in orders if o.status == status]

    if department:
        orders = [o for o in orders if o.department_id == department]

    # Sort newest first
    orders.sort(key=lambda o: o.created_at, reverse=True)

    return [work_order(db, wo) for wo in orders]


@router.get("/work-orders/{wo_id}")
async def get_work_order(
    wo_id: str, payload: dict = Depends(require_staff), db: Session = Depends(get_db)
):
    """Get work order detail."""
    wo = db.query(WorkOrder).filter_by(id=wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Check department access
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if wo.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    return work_order(db, wo)


@router.post("/work-orders")
async def create_work_order(
    data: CreateWorkOrderRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """
    Create work order.
    409 if incident already has a work order.
    Moves incident to 'assigned' (or 'open' if no team).
    """
    incident_id = data.incident_id
    sr_id = data.service_request_id

    if bool(incident_id) == bool(sr_id):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # Validate required field
    if not data.department:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # Check for existing work order
    if incident_id:
        incident = db.query(Incident).filter_by(id=incident_id).first()
        if not incident:
            raise HTTPException(status_code=404, detail="مش موجود")

        if incident.work_order_id:
            raise HTTPException(status_code=409, detail="البلاغ ده ليه أمر شغل بالفعل")

        # Check department access
        if payload.get("role") == "staff":
            staff_dept = payload.get("department")
            if incident.department_id != staff_dept:
                raise HTTPException(status_code=403, detail="مش مسموح")
            if data.department != staff_dept:
                raise HTTPException(status_code=403, detail="مش مسموح")

    if sr_id:
        service_request = db.query(ServiceRequest).filter_by(id=sr_id).first()
        if not service_request:
            raise HTTPException(status_code=404, detail="مش موجود")
        service_department = {
            "bulky_waste": "sanitation",
            "tree_maintenance": "parks",
        }.get(service_request.service_type)
        if payload.get("role") == "staff" and service_department != payload.get(
            "department"
        ):
            raise HTTPException(status_code=403, detail="مش مسموح")
        if data.department != service_department:
            raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    if not db.query(Department).filter_by(id=data.department).first():
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    try:
        parsed_due_at = _database_utc_datetime(data.due_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة") from None

    dept_id = data.department
    team = data.team
    team_size = data.team_size
    supervisor = data.supervisor
    tasks = data.tasks or []

    # Create work order
    wo_id = next_id(db, "WO")
    wo_status = "assigned" if team else "open"

    wo = WorkOrder(
        id=wo_id,
        incident_id=incident_id,
        service_request_id=sr_id,
        department_id=dept_id,
        team=team,
        team_size=team_size,
        supervisor=supervisor,
        status=wo_status,
        due_at=parsed_due_at,
        estimated_cost_egp=data.estimated_cost_egp,
        tasks=[{"label": t, "done": False} for t in tasks] if tasks else [],
    )
    db.add(wo)
    db.flush()

    # I5: Link to incident
    if incident_id:
        incident.work_order_id = wo_id
        incident.department_id = dept_id

        # I5: Only move incident to assigned if status is received/triaged
        actor = payload.get("sub", "staff")
        if incident.status in ("received", "triaged"):
            dept = db.query(Department).filter_by(id=dept_id).first()
            dept_name = dept.name_ar if dept else dept_id
            change_incident_status(
                db,
                incident,
                "assigned",
                f"اتحوّل لـ{dept_name} ضمن خطة الميزانية",
                actor,
            )

    # Record work order creation
    actor = payload.get("sub", "staff")
    activity = ActivityLog(
        entity_type="work_order",
        entity_id=wo_id,
        status=wo_status,
        note="تم إنشاء أمر الشغل",
        actor=actor,
        kind="status_change",
        at=now_utc(),
    )
    db.add(activity)

    db.commit()
    return work_order(db, wo)


@router.patch("/work-orders/{wo_id}")
async def patch_work_order(
    wo_id: str,
    data: PatchWorkOrderRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """
    Update work order.
    When status is 'in_progress' or 'done', also moves linked incident to same status.
    Note is required when status changes to 'in_progress' or 'done' (400).
    """
    wo = db.query(WorkOrder).filter_by(id=wo_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Check department access
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if wo.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    # Validate enum field
    if data.status and data.status not in ("open", "assigned", "in_progress", "done"):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # If status is changing to in_progress/done, note is required
    if data.status and data.status in ("in_progress", "done"):
        if not data.note:
            raise HTTPException(status_code=400, detail="اكتب رسالة")

    try:
        parsed_due_at = _database_utc_datetime(data.due_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة") from None

    # Apply updates
    if data.status:
        new_status = data.status
        note = data.note or ""
        actor = payload.get("sub", "staff")
        change_work_order_status(db, wo, new_status, note, actor)

        # Move linked incident to same status
        if wo.incident_id:
            incident = db.query(Incident).filter_by(id=wo.incident_id).first()
            if incident and new_status in ("in_progress", "done"):
                incident_status = (
                    "in_progress" if new_status == "in_progress" else "resolved"
                )
                change_incident_status(db, incident, incident_status, note, actor)

    if data.team is not None:
        wo.team = data.team

    if data.team_size is not None:
        wo.team_size = data.team_size

    if data.supervisor is not None:
        wo.supervisor = data.supervisor

    if data.due_at is not None:
        wo.due_at = parsed_due_at

    if data.tasks is not None:
        wo.tasks = data.tasks

    db.commit()
    return work_order(db, wo)


# ============================================================================
# Service Requests
# ============================================================================


@router.get("/service-requests")
async def list_service_requests(
    status: Optional[str] = Query(None),
    serviceType: Optional[str] = Query(None),
    day: Optional[str] = Query(None),
    payment: Optional[str] = Query(None),
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """I4: List service requests, sorted by day ascending. Staff scoped by department."""
    srs = db.query(ServiceRequest).all()

    # I4: Filter by staff department - map service type to department
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if staff_dept:
            service_type_to_dept = {
                "bulky_waste": "sanitation",
                "tree_maintenance": "parks",
            }
            allowed_types = [
                st for st, dept in service_type_to_dept.items() if dept == staff_dept
            ]
            srs = [s for s in srs if s.service_type in allowed_types]

    if status:
        srs = [s for s in srs if s.status == status]

    if serviceType:
        srs = [s for s in srs if s.service_type == serviceType]

    if day:
        srs = [s for s in srs if s.details.get("day") == day]

    if payment:
        srs = [s for s in srs if s.details.get("payment") == payment]

    # Sort by day ascending
    srs.sort(key=lambda s: (s.details.get("day") or "", s.details.get("slot") or ""))

    return [admin_service_request(db, sr) for sr in srs]


@router.patch("/service-requests/{sr_id}")
async def patch_service_request(
    sr_id: str,
    data: PatchServiceRequestRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """I4: Update service request. Staff scoped by department."""
    sr = db.query(ServiceRequest).filter_by(id=sr_id).first()
    if not sr:
        raise HTTPException(status_code=404, detail="مش موجود")

    # I4: Check department access (staff only)
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        service_type_to_dept = {
            "bulky_waste": "sanitation",
            "tree_maintenance": "parks",
        }
        sr_dept = service_type_to_dept.get(sr.service_type)
        if sr_dept != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    # Validate enum fields
    if data.status and data.status not in (
        "received",
        "triaged",
        "assigned",
        "in_progress",
        "resolved",
        "closed",
    ):
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    # If status is changing, note is required
    if data.status and data.status != sr.status:
        if not data.note:
            raise HTTPException(status_code=400, detail="اكتب رسالة")

    # Apply updates
    if data.status:
        new_status = data.status
        note = data.note or ""
        actor = payload.get("sub", "staff")
        change_service_request_status(db, sr, new_status, note, actor)

    if data.day is not None:
        sr.details["day"] = data.day

    if data.slot is not None:
        sr.details["slot"] = data.slot

    if data.assignee is not None:
        sr.details["assignee"] = data.assignee

    if data.day is not None or data.slot is not None or data.assignee is not None:
        flag_modified(sr, "details")

    # A3: note-only PATCH
    if data.note and not data.status:
        actor = payload.get("sub", "staff")
        activity = ActivityLog(
            entity_type="service_request",
            entity_id=sr.id,
            status=sr.status,
            note=data.note,
            actor=actor,
            kind="status_change",
            at=now_utc(),
        )
        db.add(activity)

    db.commit()
    return admin_service_request(db, sr)


# ============================================================================
# Budget
# ============================================================================


@router.post("/budget/optimize")
async def optimize_budget_endpoint(
    data: BudgetOptimizeRequest,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Optimize budget using 0/1 knapsack DP. Admin only. C4: budgetEgp required > 0."""
    # C4: Validate budgetEgp > 0
    if data.budget_egp <= 0:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")

    budget_egp = data.budget_egp
    incident_ids = data.incident_ids

    plan = optimize_budget(db, budget_egp, incident_ids)

    # Save plan
    plan_id = next_id(db, "BP")
    db_plan = BudgetPlan(
        id=plan_id,
        budget_egp=budget_egp,
        selected=[i["incidentId"] for i in plan["selected"]],
        skipped=[i["incidentId"] for i in plan["skipped"]],
        total_cost=plan["totalCost"],
        remaining=plan["remaining"],
    )
    db.add(db_plan)
    db.commit()

    return plan


@router.post("/budget/commit")
async def commit_budget(
    data: BudgetCommitRequest,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create work orders for selected incidents. Admin only."""
    incident_ids = data.incident_ids or []

    created_wos = []
    for inc_id in incident_ids:
        incident = db.query(Incident).filter_by(id=inc_id).first()
        if not incident or incident.work_order_id:
            continue

        # Create work order
        wo_id = next_id(db, "WO")
        dept_id = incident.department_id or "utilities"

        wo = WorkOrder(
            id=wo_id,
            incident_id=inc_id,
            department_id=dept_id,
            status="open",
            due_at=now_utc() + timedelta(days=5),
            estimated_cost_egp=incident.estimated_cost_egp,
        )
        db.add(wo)
        db.flush()

        incident.work_order_id = wo_id

        # Record creation
        activity = ActivityLog(
            entity_type="work_order",
            entity_id=wo_id,
            status="open",
            note="تم إنشاء أمر الشغل من الميزانية",
            actor="admin",
            kind="status_change",
            at=now_utc(),
        )
        db.add(activity)

        created_wos.append(work_order(db, wo))

    db.commit()
    return created_wos


# ============================================================================
# Insights
# ============================================================================


@router.get("/insights")
async def get_insights(
    payload: dict = Depends(require_staff), db: Session = Depends(get_db)
):
    """Get deterministic insights."""
    return generate_insights(
        db, department_id=payload["department"] if payload["role"] == "staff" else None
    )


# ============================================================================
# Demo
# ============================================================================


@router.post("/demo/reset")
async def reset_demo(
    payload: dict = Depends(require_admin), db: Session = Depends(get_db)
):
    """Re-seed the database. Admin only."""
    if not settings.demo_reset_enabled:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Clear all data
    from sqlalchemy import text
    from app.models import Base

    for table in reversed(Base.metadata.sorted_tables):
        db.execute(text(f"DELETE FROM {table.name}"))
    db.commit()

    # Re-seed
    seed_db(db)
    db.commit()

    return {"status": "ok", "message": "تم إعادة تحميل البيانات"}
