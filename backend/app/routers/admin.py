"""Admin and staff API routes."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import require_staff, require_admin, current_user
from app.models import (
    Incident, Report, WorkOrder, ServiceRequest, Department, Category,
    IncidentFollower, ActivityLog, BudgetPlan, IncidentStatusEnum, WorkOrderStatusEnum,
    AISuggestion, Profile
)
from app.logic.serialize import admin_incident, work_order, admin_service_request, incident_public
from app.logic.dashboard import build_dashboard
from app.logic.budget import optimize_budget
from app.logic.insights import generate_insights
from app.logic.status import change_incident_status, change_work_order_status, change_service_request_status
from app.logic.ids import next_id
from app.logic.duplicates import find_duplicates
from app.logic.priority import compute_priority
from app.helpers import iso_z, now_utc
from app.seed import TEAMS, seed_db

router = APIRouter(prefix="/admin", tags=["admin"])


# ============================================================================
# Auth endpoints
# ============================================================================

@router.get("/auth/me")
async def get_me(payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """Get current staff/admin user info."""
    # Get the user from JWT
    user_id = payload.get("sub")
    profile = db.query(Profile).filter_by(id=user_id).first()

    if not profile or profile.role not in ("staff", "admin"):
        raise HTTPException(status_code=401, detail="لازم تسجّل دخول")

    return {
        "userId": user_id,
        "name": profile.name,
        "title": profile.prefs.get("title") if profile.prefs else None,
        "role": profile.role,
        "department": payload.get("department"),
        "district": profile.district,
    }


# ============================================================================
# Departments
# ============================================================================

@router.get("/departments")
async def list_departments(
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
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
            if incident.status not in ("received", "triaged", "assigned", "in_progress"):
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
        incidents = [i for i in incidents if q.lower() in i.title.lower() or q.lower() in i.address.lower()]

    # Sort by priority desc
    incidents.sort(key=lambda i: i.priority_score, reverse=True)

    return [admin_incident(db, inc) for inc in incidents]


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
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


@router.patch("/incidents/{incident_id}")
async def patch_incident(
    incident_id: str,
    update: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """
    Update incident.
    - status, severity, categoryId, department, note
    - note is REQUIRED when status changes (400 if missing)
    - Staff can only patch their own department (403)
    """
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Check department access
    if payload.get("role") == "staff":
        staff_dept = payload.get("department")
        if incident.department_id != staff_dept:
            raise HTTPException(status_code=403, detail="مش مسموح")

    # If status is changing, note is required
    if "status" in update and update["status"] != incident.status:
        if "note" not in update or not update["note"]:
            raise HTTPException(status_code=400, detail="اكتب رسالة للمواطنين")

    # Apply updates
    if "status" in update:
        new_status = update["status"]
        note = update.get("note", "")
        actor = payload.get("sub", "staff")
        change_incident_status(db, incident, new_status, note, actor)

    if "severity" in update:
        incident.severity = update["severity"]

    if "categoryId" in update:
        incident.category_id = update["categoryId"]
        # Recompute priority
        category = db.query(Category).filter_by(id=incident.category_id).first()
        days_open = max(0, int((now_utc() - incident.created_at).days))
        priority = compute_priority({
            "severity": incident.severity,
            "near_sensitive_place": bool(incident.sensitive_place),
            "reporters": db.query(Report).filter_by(incident_id=incident.id).count(),
            "days_open": days_open,
            "target_days": category.target_days if category else 5,
            "area_underserved": incident.area_underserved,
        })
        incident.priority_score = priority["score"]
        incident.priority_factors = priority["factors"]

    if "department" in update:
        incident.department_id = update["department"]

    # A3: note-only PATCH appends timeline entry with current status
    if "note" in update and "status" not in update:
        actor = payload.get("sub", "staff")
        activity = ActivityLog(
            entity_type="incident",
            entity_id=incident.id,
            status=incident.status,
            note=update["note"],
            actor=actor,
            kind="status_change",
            at=now_utc(),
        )
        db.add(activity)

    db.commit()
    return admin_incident(db, incident)


@router.get("/incidents/{incident_id}/similar")
async def get_similar_incidents(
    incident_id: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Get duplicate/similar incidents within 250m, same category, open only."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    duplicates = find_duplicates(db, incident)
    return duplicates


@router.post("/incidents/{incident_id}/merge")
async def merge_incidents(
    incident_id: str,
    data: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Merge reports and followers from source into target incident."""
    source = db.query(Incident).filter_by(id=incident_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="مش موجود")

    target_id = data.get("intoIncidentId")
    target = db.query(Incident).filter_by(id=target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Move reports from source to target
    reports = db.query(Report).filter_by(incident_id=source.id).all()
    for report in reports:
        report.incident_id = target.id

    # Move followers from source to target
    followers = db.query(IncidentFollower).filter_by(incident_id=source.id).all()
    for follower in followers:
        # Check if already following target
        existing = db.query(IncidentFollower).filter_by(
            incident_id=target.id,
            user_id=follower.user_id
        ).first()
        if not existing:
            follower.incident_id = target.id

    # Close source with note
    actor = payload.get("sub", "staff")
    change_incident_status(db, source, "closed", f"تم دمج البلاغ في {target_id}", actor)

    # Update target followers count
    target.followers_count = db.query(IncidentFollower).filter_by(incident_id=target.id).count()

    db.commit()
    return admin_incident(db, target)


@router.post("/incidents/{incident_id}/triage/confirm")
async def confirm_triage(
    incident_id: str,
    data: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Confirm AI triage suggestion and move incident from received to triaged."""
    incident = db.query(Incident).filter_by(id=incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="مش موجود")

    # Update incident with triage data
    if "categoryId" in data:
        incident.category_id = data["categoryId"]

    if "severity" in data:
        incident.severity = data["severity"]

    # Mark triage as confirmed in AI suggestions
    first_report = db.query(Report).filter_by(incident_id=incident_id).first()
    if first_report:
        ai_sug = db.query(AISuggestion).filter(
            AISuggestion.report_id == first_report.id,
            AISuggestion.kind == "triage",
        ).first()
        if ai_sug and ai_sug.payload:
            ai_sug.payload["confirmed"] = True

    # Move from received to triaged
    actor = payload.get("sub", "staff")
    change_incident_status(db, incident, "triaged", "تم تصنيف البلاغ", actor)

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
    db: Session = Depends(get_db)
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
    wo_id: str,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
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
    data: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """
    Create work order.
    409 if incident already has a work order.
    Moves incident to 'assigned' (or 'open' if no team).
    """
    incident_id = data.get("incidentId")
    sr_id = data.get("serviceRequestId")

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

    dept_id = data.get("department")
    team = data.get("team")
    team_size = data.get("teamSize")
    supervisor = data.get("supervisor")
    due_at = data.get("dueAt")
    tasks = data.get("tasks", [])

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
        due_at=datetime.fromisoformat(due_at) if due_at else None,
        estimated_cost_egp=data.get("estimatedCostEgp"),
        tasks=[{"label": t, "done": False} for t in tasks] if tasks else [],
    )
    db.add(wo)
    db.flush()

    # Link to incident
    if incident_id:
        incident.work_order_id = wo_id

        # Move incident to assigned
        actor = payload.get("sub", "staff")
        dept = db.query(Department).filter_by(id=dept_id).first()
        dept_name = dept.name_ar if dept else dept_id
        change_incident_status(
            db, incident, "assigned",
            f"اتحوّل لـ{dept_name}",
            actor
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
    data: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
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

    # If status is changing to in_progress/done, note is required
    if "status" in data and data["status"] in ("in_progress", "done"):
        if "note" not in data or not data["note"]:
            raise HTTPException(status_code=400, detail="اكتب رسالة")

    # Apply updates
    if "status" in data:
        new_status = data["status"]
        note = data.get("note", "")
        actor = payload.get("sub", "staff")
        change_work_order_status(db, wo, new_status, note, actor)

        # Move linked incident to same status
        if wo.incident_id:
            incident = db.query(Incident).filter_by(id=wo.incident_id).first()
            if incident and new_status in ("in_progress", "done"):
                incident_status = "in_progress" if new_status == "in_progress" else "resolved"
                change_incident_status(db, incident, incident_status, note, actor)

    if "team" in data:
        wo.team = data["team"]

    if "teamSize" in data:
        wo.team_size = data["teamSize"]

    if "supervisor" in data:
        wo.supervisor = data["supervisor"]

    if "dueAt" in data:
        wo.due_at = datetime.fromisoformat(data["dueAt"]) if data["dueAt"] else None

    if "tasks" in data:
        wo.tasks = data["tasks"]

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
    db: Session = Depends(get_db)
):
    """List service requests, sorted by day ascending."""
    srs = db.query(ServiceRequest).all()

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
    data: dict,
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """
    Update service request.
    Note is required when status changes (400).
    A3: note-only PATCH appends timeline entry.
    """
    sr = db.query(ServiceRequest).filter_by(id=sr_id).first()
    if not sr:
        raise HTTPException(status_code=404, detail="مش موجود")

    # If status is changing, note is required
    if "status" in data and data["status"] != sr.status:
        if "note" not in data or not data["note"]:
            raise HTTPException(status_code=400, detail="اكتب رسالة")

    # Apply updates
    if "status" in data:
        new_status = data["status"]
        note = data.get("note", "")
        actor = payload.get("sub", "staff")
        change_service_request_status(db, sr, new_status, note, actor)

    if "day" in data:
        sr.details["day"] = data["day"]

    if "slot" in data:
        sr.details["slot"] = data["slot"]

    if "assignee" in data:
        sr.details["assignee"] = data["assignee"]

    # A3: note-only PATCH
    if "note" in data and "status" not in data:
        actor = payload.get("sub", "staff")
        activity = ActivityLog(
            entity_type="service_request",
            entity_id=sr.id,
            status=sr.status,
            note=data["note"],
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
    data: dict,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Optimize budget using 0/1 knapsack DP. Admin only."""
    budget_egp = data.get("budgetEgp", 300000)
    incident_ids = data.get("incidentIds")

    plan = optimize_budget(db, budget_egp, incident_ids)

    # Save plan
    from app.logic.ids import next_id
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
    data: dict,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create work orders for selected incidents. Admin only."""
    incident_ids = data.get("incidentIds", [])

    created_wos = []
    for inc_id in incident_ids:
        incident = db.query(Incident).filter_by(id=inc_id).first()
        if not incident or incident.work_order_id:
            continue

        # Create work order
        from app.logic.ids import next_id
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
    payload: dict = Depends(require_staff),
    db: Session = Depends(get_db)
):
    """Get deterministic insights."""
    return generate_insights(db)


# ============================================================================
# Demo
# ============================================================================

@router.post("/demo/reset")
async def reset_demo(
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Re-seed the database. Admin only."""
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
