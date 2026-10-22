"""Staff / admin API (Command Center)."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.admin_auth import require_admin, require_staff
from app.config import settings
from app.db import get_db, reset_session
from app.helpers import now_utc
from app.logic.budget import optimize_budget
from app.logic.dashboard import build_dashboard
from app.logic.domain import (
    actor_name,
    create_work_order,
    recompute_priority,
    resolve_department,
    staff_department,
)
from app.logic.duplicates import find_duplicates
from app.logic.ids import next_id
from app.logic.insights import generate_insights
from app.logic.overdue import is_overdue
from app.logic.serialize import (
    SERVICE_TYPE_DEPARTMENT,
    admin_incident,
    admin_service_request,
    load_ctx,
    service_timelines,
    work_orders_view,
)
from app.logic.status import (
    WORK_ORDER_STATUSES,
    add_incident_note,
    add_service_request_note,
    add_work_order_note,
    change_incident_status,
    change_service_request_status,
    change_work_order_status,
)
from app.media import MediaStorage, get_media, sign_linked_report_photos
from app.models import (
    AISuggestion,
    BudgetPlan,
    Category,
    Department,
    Incident,
    IncidentFollower,
    Report,
    ServiceRequest,
    WorkOrder,
)
from app.schemas import (
    BudgetCommitRequest,
    BudgetOptimizeRequest,
    CreateWorkOrderRequest,
    MergeIncidentRequest,
    PatchIncidentRequest,
    PatchServiceRequestRequest,
    PatchWorkOrderRequest,
    TriageConfirmRequest,
)
from app.seed import TEAMS

router = APIRouter(prefix="/admin", tags=["admin"])
# `PATCH /incidents/{id}` lives at the top level (the contract path); GET /incidents/{id} is the citizen route.
top_level_router = APIRouter(tags=["incidents"])

NEEDS_NOTE = "اكتب رسالة للمواطنين"
INVALID = "البيانات مش مكتملة"


def _forbid() -> HTTPException:
    return HTTPException(status_code=403, detail="مش مسموح")


def _missing() -> HTTPException:
    return HTTPException(status_code=404, detail="مش موجود")


def _incident_or_404(db: Session, incident_id: str, payload: dict) -> Incident:
    """Load an incident; staff may only touch their own department's."""
    inc = db.get(Incident, incident_id)
    if not inc:
        raise _missing()
    dept = staff_department(payload)
    if dept and inc.department_id != dept:
        raise _forbid()
    return inc


def _one(db: Session, inc: Incident) -> dict:
    return admin_incident(load_ctx(db, [inc]), inc)


def _parse_dt(value: str | None) -> datetime | None:
    """ISO 8601 -> naive UTC (how the DB stores it); 422 when malformed."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=422, detail=INVALID) from None
    return dt.astimezone(UTC).replace(tzinfo=None) if dt.tzinfo else dt


# --------------------------------------------------------------------------- reference data
@router.get("/departments")
def list_departments(payload: dict = Depends(require_staff), db: Session = Depends(get_db)):
    out = []
    for d in db.query(Department).order_by(Department.id).all():
        item = {"id": d.id, "nameAr": d.name_ar, "external": bool(d.external_hotline)}
        if d.external_hotline:
            item["externalHotline"] = d.external_hotline
        out.append(item)
    return out


@router.get("/teams")
def list_teams(payload: dict = Depends(require_staff)):
    return TEAMS


# --------------------------------------------------------------------------- dashboard
@router.get("/dashboard")
def get_dashboard(
    range: Literal["today", "7d", "30d"] = Query("7d"),
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    return build_dashboard(db, range, staff_department(payload))


# --------------------------------------------------------------------------- incidents
@router.get("/incidents")
def list_incidents(
    status: str | None = None,
    categoryId: str | None = None,
    department: str | None = None,
    critical: bool | None = None,
    overdue: bool | None = None,
    q: str | None = None,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """All incidents (open, resolved, closed) unless filtered; priority desc. Staff: own department only."""
    query = db.query(Incident)
    scope = staff_department(payload)
    if scope:
        query = query.filter(Incident.department_id == scope)
    if status:
        query = query.filter(Incident.status == status)
    if categoryId:
        query = query.filter(Incident.category_id == categoryId)
    if department:
        dept = db.get(Department, department) or db.query(Department).filter_by(name_ar=department).first()
        query = query.filter(Incident.department_id == (dept.id if dept else department))
    if critical:
        query = query.filter(Incident.severity == "critical")
    incidents = query.all()
    if overdue:
        cats = {c.id: c for c in db.query(Category).all()}
        now = now_utc()
        incidents = [i for i in incidents if is_overdue(i, cats.get(i.category_id), now)]
    if q:
        needle = q.strip().lower()
        incidents = [
            i for i in incidents if needle in i.title.lower() or needle in i.address.lower() or needle in i.id.lower()
        ]
    incidents.sort(key=lambda i: (-i.priority_score, i.id))
    ctx = load_ctx(db, incidents)
    return [admin_incident(ctx, i) for i in incidents]


@router.get("/incidents/{incident_id}")
def get_incident(
    incident_id: str,
    storage: Annotated[MediaStorage | None, Depends(get_media)],
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """One AdminIncident; linked reports carry short-lived signed ``photoUrls`` (detail view only)."""
    inc = _incident_or_404(db, incident_id, payload)
    ctx = load_ctx(db, [inc])
    return sign_linked_report_photos(admin_incident(ctx, inc), ctx.reports.get(inc.id, []), storage)


def _patch_incident(db: Session, incident_id: str, u: PatchIncidentRequest, payload: dict) -> dict:
    inc = _incident_or_404(db, incident_id, payload)
    note = (u.note or "").strip()
    current = getattr(inc.status, "value", inc.status)
    status_changed = u.status is not None and u.status != current
    if status_changed and not note:
        raise HTTPException(status_code=400, detail=NEEDS_NOTE)
    new_dept = resolve_department(db, u.department) if u.department else None
    actor = actor_name(db, payload)

    needs_priority = False
    if u.category_id and u.category_id != inc.category_id:
        cat = db.get(Category, u.category_id)
        inc.category_id = cat.id
        inc.department_id = cat.department_id  # follows the new category unless set explicitly below
        needs_priority = True
    if u.severity and u.severity != getattr(inc.severity, "value", inc.severity):
        inc.severity = u.severity
        needs_priority = True
    if new_dept:
        inc.department_id = new_dept.id
    if needs_priority:
        recompute_priority(db, inc)

    if status_changed:
        change_incident_status(db, inc, u.status, note, actor)
    elif note:
        add_incident_note(db, inc, note, actor)
    inc.updated_at = now_utc()
    db.commit()
    return _one(db, inc)


@top_level_router.patch("/incidents/{incident_id}")
def patch_incident(
    incident_id: str,
    u: PatchIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update status / severity / category / department. A status change needs a citizen-facing note."""
    return _patch_incident(db, incident_id, u, payload)


@router.patch("/incidents/{incident_id}")
def patch_incident_alias(
    incident_id: str,
    u: PatchIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Alias of ``PATCH /incidents/{id}``."""
    return _patch_incident(db, incident_id, u, payload)


@router.get("/incidents/{incident_id}/similar")
def similar_incidents(incident_id: str, payload: dict = Depends(require_staff), db: Session = Depends(get_db)):
    """DuplicateMatch[]: open, same category, within 250 m, not itself."""
    return find_duplicates(db, _incident_or_404(db, incident_id, payload))


@router.post("/incidents/{incident_id}/merge")
def merge_incident(
    incident_id: str,
    body: MergeIncidentRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Move reports and followers into the target, close the source with a note."""
    source = _incident_or_404(db, incident_id, payload)
    target = _incident_or_404(db, body.into_incident_id, payload)
    if source.id == target.id:
        raise HTTPException(status_code=422, detail=INVALID)  # an incident cannot be merged into itself
    if getattr(target.status, "value", target.status) in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="مينفعش تدمج في بلاغ اتحل أو اتقفل")

    def people(incident_id: str) -> set[str]:
        rows = db.query(IncidentFollower.user_id).filter(IncidentFollower.incident_id == incident_id).all()
        reporters = db.query(Report.reporter_id).filter(Report.incident_id == incident_id).all()
        return {r[0] for r in rows} | {r[0] for r in reporters}

    target_people = people(target.id)
    shared = people(source.id) & target_people
    for follower in db.query(IncidentFollower).filter_by(incident_id=source.id).all():
        user_id = follower.user_id
        db.delete(follower)
        if user_id not in target_people:
            db.add(IncidentFollower(incident_id=target.id, user_id=user_id))
            target_people.add(user_id)
    for report in db.query(Report).filter_by(incident_id=source.id).all():
        report.incident_id = target.id
    target.followers_count = max(0, (target.followers_count or 0) + (source.followers_count or 0) - len(shared))
    db.flush()
    recompute_priority(db, target)

    actor = actor_name(db, payload)
    note = f"اتدمج البلاغ ده مع {target.id}"
    wo = db.get(WorkOrder, source.work_order_id) if source.work_order_id else None
    if wo is not None and getattr(wo.status, "value", wo.status) != "done":
        if not target.work_order_id:
            wo.incident_id = target.id
            target.work_order_id = wo.id
            source.work_order_id = None
            note += f" واتنقل أمر الشغل {wo.id} للبلاغ {target.id}"
        else:
            note += f" وأمر الشغل {wo.id} فضل على البلاغ ده لأن {target.id} ليه أمر شغل"
    change_incident_status(db, source, "closed", note, actor)
    db.commit()
    return _one(db, target)


@router.post("/incidents/{incident_id}/triage/confirm")
def confirm_triage(
    incident_id: str,
    body: TriageConfirmRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Confirm the AI triage: apply category/severity, record the reviewer, move received -> triaged."""
    inc = _incident_or_404(db, incident_id, payload)
    actor = actor_name(db, payload)
    changed = False
    if body.category_id and body.category_id != inc.category_id:
        cat = db.get(Category, body.category_id)
        inc.category_id = cat.id
        inc.department_id = cat.department_id
        changed = True
    if body.severity and body.severity != getattr(inc.severity, "value", inc.severity):
        inc.severity = body.severity
        changed = True
    if changed:
        recompute_priority(db, inc)

    first = db.query(Report).filter_by(incident_id=inc.id).order_by(Report.created_at, Report.id).first()
    suggestion = (
        db.query(AISuggestion).filter_by(report_id=first.id, kind="triage").first() if first is not None else None
    )
    if suggestion is not None:
        suggestion.payload = {**(suggestion.payload or {}), "confirmed": True}  # reassign: JSON is not mutable-tracked

    inc.last_reviewed_by = actor
    inc.last_reviewed_at = now_utc()
    if getattr(inc.status, "value", inc.status) == "received":
        label = db.get(Category, inc.category_id).label_ar
        change_incident_status(db, inc, "triaged", f"اتأكّد التصنيف: {label}", actor)
    db.commit()
    return _one(db, inc)


# --------------------------------------------------------------------------- work orders
@router.get("/work-orders")
def list_work_orders(
    status: str | None = None,
    department: str | None = None,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = db.query(WorkOrder)
    scope = staff_department(payload)
    if scope:
        query = query.filter(WorkOrder.department_id == scope)
    if status:
        query = query.filter(WorkOrder.status == status)
    if department:
        dept = db.get(Department, department) or db.query(Department).filter_by(name_ar=department).first()
        query = query.filter(WorkOrder.department_id == (dept.id if dept else department))
    orders = query.order_by(WorkOrder.created_at.desc(), WorkOrder.id.desc()).all()
    return work_orders_view(db, load_ctx(db, []), orders)


def _work_order_or_404(db: Session, wo_id: str, payload: dict) -> WorkOrder:
    wo = db.get(WorkOrder, wo_id)
    if not wo:
        raise _missing()
    scope = staff_department(payload)
    if scope and wo.department_id != scope:
        raise _forbid()
    return wo


def _wo_json(db: Session, wo: WorkOrder) -> dict:
    return work_orders_view(db, load_ctx(db, []), [wo])[0]


@router.get("/work-orders/{wo_id}")
def get_work_order(wo_id: str, payload: dict = Depends(require_staff), db: Session = Depends(get_db)):
    return _wo_json(db, _work_order_or_404(db, wo_id, payload))


@router.post("/work-orders")
def post_work_order(
    body: CreateWorkOrderRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Create a work order (open, or assigned when a team is given). 409 if the target already has one."""
    if not body.incident_id and not body.service_request_id:
        raise HTTPException(status_code=422, detail=INVALID)
    dept = resolve_department(db, body.department)
    scope = staff_department(payload)
    if scope and dept.id != scope:
        raise _forbid()
    actor = actor_name(db, payload)
    due = _parse_dt(body.due_at)

    inc = None
    sr = None
    if body.incident_id:
        inc = _incident_or_404(db, body.incident_id, payload)
        if inc.work_order_id:
            raise HTTPException(status_code=409, detail="البلاغ ده ليه أمر شغل بالفعل")
    if body.service_request_id:
        sr = db.get(ServiceRequest, body.service_request_id)
        if not sr:
            raise _missing()
        service_department = SERVICE_TYPE_DEPARTMENT.get(sr.service_type)
        if scope and service_department != scope:
            raise _forbid()
        if dept.id != service_department:
            raise HTTPException(status_code=422, detail=INVALID)
        if db.query(WorkOrder).filter_by(service_request_id=sr.id).first():
            raise HTTPException(status_code=409, detail="الطلب ده ليه أمر شغل بالفعل")

    if inc is not None and inc.department_id != dept.id:
        # Admin reassignment: the incident follows its work order's department (staff are already
        # limited to their own department above, so they can never move an incident out of scope).
        inc.department_id = dept.id
    wo = create_work_order(
        db,
        inc,
        dept,
        actor,
        service_request_id=sr.id if sr else None,
        team=body.team,
        team_size=body.team_size,
        supervisor=body.supervisor,
        due_at=due,
        tasks=body.tasks,
    )
    if sr is not None and getattr(sr.status, "value", sr.status) in ("received", "triaged"):
        change_service_request_status(db, sr, "assigned", f"اتحوّل لـ{dept.name_ar}", actor)
    db.commit()
    return _wo_json(db, wo)


@router.patch("/work-orders/{wo_id}")
def patch_work_order(
    wo_id: str,
    body: PatchWorkOrderRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Update a work order. in_progress/done need a note and move the linked incident/request with it."""
    wo = _work_order_or_404(db, wo_id, payload)
    note = (body.note or "").strip()
    current = getattr(wo.status, "value", wo.status)
    status_changed = body.status is not None and body.status != current
    moves_linked = body.status in ("in_progress", "done")
    if status_changed and WORK_ORDER_STATUSES.index(body.status) < WORK_ORDER_STATUSES.index(current):
        raise HTTPException(status_code=400, detail="مينفعش ترجّع الحالة لورا")
    if status_changed and moves_linked and not note:
        raise HTTPException(status_code=400, detail=NEEDS_NOTE)
    actor = actor_name(db, payload)

    if body.team is not None:
        wo.team = body.team
    if body.team_size is not None:
        wo.team_size = body.team_size
    if body.supervisor is not None:
        wo.supervisor = body.supervisor
    if body.due_at is not None:
        wo.due_at = _parse_dt(body.due_at)
    if body.tasks is not None:
        wo.tasks = [t.model_dump() for t in body.tasks]  # reassign: JSON is not mutable-tracked

    if status_changed:
        change_work_order_status(db, wo, body.status, note or "تحديث أمر الشغل", actor)
        if moves_linked:
            target = "in_progress" if body.status == "in_progress" else "resolved"
            inc = db.get(Incident, wo.incident_id) if wo.incident_id else None
            if inc and getattr(inc.status, "value", inc.status) not in ("resolved", "closed"):
                change_incident_status(db, inc, target, note, actor)
            sr = db.get(ServiceRequest, wo.service_request_id) if wo.service_request_id else None
            if sr and getattr(sr.status, "value", sr.status) not in ("resolved", "closed"):
                change_service_request_status(db, sr, target, note, actor)
    elif note:
        add_work_order_note(db, wo, note, actor)
    wo.updated_at = now_utc()
    db.commit()
    return _wo_json(db, wo)


# --------------------------------------------------------------------------- service requests
def _sr_scope_ok(sr: ServiceRequest, payload: dict) -> bool:
    scope = staff_department(payload)
    return not scope or SERVICE_TYPE_DEPARTMENT.get(sr.service_type) == scope


def _sr_json(db: Session, srs: list[ServiceRequest]) -> list[dict]:
    ctx = load_ctx(db, [])
    timelines = service_timelines(db, [s.id for s in srs])
    wo_by_sr = {
        w.service_request_id: w.id for w in db.query(WorkOrder).filter(WorkOrder.service_request_id.isnot(None))
    }
    return [admin_service_request(ctx, s, timelines.get(s.id, []), wo_by_sr.get(s.id)) for s in srs]


@router.get("/service-requests")
def list_service_requests(
    status: str | None = None,
    serviceType: str | None = None,
    day: str | None = None,
    payment: str | None = None,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Service requests, day ascending. Staff: their department's service types only."""
    query = db.query(ServiceRequest)
    if status:
        query = query.filter(ServiceRequest.status == status)
    if serviceType:
        query = query.filter(ServiceRequest.service_type == serviceType)
    srs = [s for s in query.all() if _sr_scope_ok(s, payload)]
    if day:
        srs = [s for s in srs if (s.details or {}).get("day") == day]
    if payment:
        srs = [s for s in srs if (s.details or {}).get("payment") == payment]
    slot_order = {"morning": 0, "afternoon": 1}
    srs.sort(
        key=lambda s: (
            (s.details or {}).get("day") or "",
            slot_order.get((s.details or {}).get("slot"), 2),
            s.id,
        )
    )
    return _sr_json(db, srs)


@router.patch("/service-requests/{sr_id}")
def patch_service_request(
    sr_id: str,
    body: PatchServiceRequestRequest,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db),
):
    sr = db.get(ServiceRequest, sr_id)
    if not sr:
        raise _missing()
    if not _sr_scope_ok(sr, payload):
        raise _forbid()
    note = (body.note or "").strip()
    current = getattr(sr.status, "value", sr.status)
    status_changed = body.status is not None and body.status != current
    if status_changed and not note:
        raise HTTPException(status_code=400, detail=NEEDS_NOTE)

    details = dict(sr.details or {})  # reassign below: JSON is not mutable-tracked
    for key, value in (("day", body.day), ("slot", body.slot), ("assignee", body.assignee)):
        if value is not None:
            details[key] = value
    sr.details = details

    actor = actor_name(db, payload)
    if status_changed:
        change_service_request_status(db, sr, body.status, note, actor)
    elif note:
        add_service_request_note(db, sr, note, actor)
    db.commit()
    return _sr_json(db, [sr])[0]


# --------------------------------------------------------------------------- budget
@router.post("/budget/optimize")
def budget_optimize(
    body: BudgetOptimizeRequest,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Knapsack plan (exact over 100 EGP units, costs rounded up); saved so that ``inBudgetPlan`` reflects the last plan. Admin only."""
    plan = optimize_budget(db, body.budget_egp, body.incident_ids)
    db.add(
        BudgetPlan(
            id=next_id(db, "BP"),
            budget_egp=body.budget_egp,
            selected=[i["incidentId"] for i in plan["selected"]],
            skipped=[i["incidentId"] for i in plan["skipped"]],
            total_cost=plan["totalCost"],
            remaining=plan["remaining"],
        )
    )
    db.commit()
    return plan


@router.post("/budget/commit")
def budget_commit(
    body: BudgetCommitRequest,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a work order for each selected incident that has none. Admin only."""
    actor = actor_name(db, payload)
    created = []
    for inc_id in dict.fromkeys(body.incident_ids):
        inc = db.get(Incident, inc_id)
        if not inc or inc.work_order_id or getattr(inc.status, "value", inc.status) in ("resolved", "closed"):
            continue
        dept = db.get(Department, inc.department_id)
        if not dept:
            continue
        created.append(create_work_order(db, inc, dept, actor, move_note=f"اتحوّل لـ{dept.name_ar} ضمن خطة الميزانية"))
    db.commit()
    return work_orders_view(db, load_ctx(db, []), created)


# --------------------------------------------------------------------------- insights / demo
@router.get("/insights")
def get_insights(payload: dict = Depends(require_staff), db: Session = Depends(get_db)):
    return generate_insights(db, staff_department(payload))


@router.post("/demo/reset")
def demo_reset(payload: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Re-seed the database. Admin only, and only when DEMO_RESET_ENABLED=true (404 otherwise)."""
    if not settings.demo_reset_enabled:
        raise _missing()
    reset_session(db)
    return {"status": "ok"}
