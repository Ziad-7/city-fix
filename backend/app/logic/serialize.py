"""Serialization functions for domain entities."""
from sqlalchemy.orm import Session
from datetime import timedelta, timezone
from app.models import (
    ActivityLog, Incident, Report, WorkOrder, ServiceRequest,
    Department, Category, IncidentFollower, BudgetPlan
)
from app.helpers import iso_z, now_utc
from app.logic.priority import compute_priority


def work_order_updates(db: Session, wo_id: str) -> list[dict]:
    """Get work order status updates from activity log, oldest first.

    Args:
        db: Database session
        wo_id: Work order ID (e.g., 'WO-318')

    Returns:
        List of dicts with {status, note, actor, at: iso_z}, ordered by time ascending.
    """
    activities = db.query(ActivityLog).filter(
        ActivityLog.entity_type == "work_order",
        ActivityLog.entity_id == wo_id,
    ).order_by(ActivityLog.at).all()

    return [
        {
            "status": activity.status,
            "note": activity.note,
            "actor": activity.actor,
            "at": iso_z(activity.at),
        }
        for activity in activities
    ]


def incident_timeline(db: Session, incident_id: str, oldest_first: bool = True) -> list[dict]:
    """Get incident timeline from activity log.

    Args:
        db: Database session
        incident_id: Incident ID (e.g., 'INC-501')
        oldest_first: Order by time ascending if True, descending if False

    Returns:
        List of timeline entries with {status, note, actor, at: iso_z}
    """
    query = db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.entity_id == incident_id,
    )
    if oldest_first:
        query = query.order_by(ActivityLog.at.asc())
    else:
        query = query.order_by(ActivityLog.at.desc())

    return [
        {
            "status": activity.status,
            "note": activity.note,
            "actor": activity.actor,
            "at": iso_z(activity.at),
        }
        for activity in query.all()
    ]


def incident_public(db: Session, incident: Incident, user_id: str = None) -> dict:
    """Serialize incident for public/citizen view.

    Includes timeline from activity_log and whether the user is following.
    """
    timeline = incident_timeline(db, incident.id, oldest_first=True)

    is_following = False
    if user_id:
        is_following = db.query(IncidentFollower).filter(
            IncidentFollower.incident_id == incident.id,
            IncidentFollower.user_id == user_id,
        ).first() is not None

    result = {
        "id": incident.id,
        "categoryId": incident.category_id,
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "priorityScore": incident.priority_score,
        "priorityFactors": incident.priority_factors,
        "followersCount": incident.followers_count,
        "lat": incident.lat,
        "lng": incident.lng,
        "address": incident.address,
        "landmark": incident.landmark,
        "sensitivePlace": incident.sensitive_place,
        "timeline": timeline,
        "isFollowing": is_following,
        "createdAt": iso_z(incident.created_at),
    }
    # Remove None values
    return {k: v for k, v in result.items() if v is not None}


def admin_incident(db: Session, incident: Incident) -> dict:
    """Serialize incident for admin view.

    Includes admin-specific fields like linkedReports, triage, dueAt, overdue, etc.
    """
    # Get timeline
    timeline = incident_timeline(db, incident.id, oldest_first=True)

    # I1: Get linked reports with source from report data
    linked_reports = []
    for report in db.query(Report).filter_by(incident_id=incident.id).all():
        reporter = db.query(Report).filter_by(id=report.id).first()
        if reporter:
            reporter_name = "بلاغ بدون اسم" if report.anonymous else "مواطن"
        else:
            reporter_name = "مواطن"

        linked_reports.append({
            "id": report.id,
            "reporter": reporter_name,
            "description": report.description,
            "source": report.source if report.source else "app",  # I1: use report.source
            "photoCount": len(report.photo_paths) if report.photo_paths else 0,
            "createdAt": iso_z(report.created_at),
        })

    # Get category for target_days
    category = db.query(Category).filter_by(id=incident.category_id).first()
    target_days = category.target_days if category else 5

    # Calculate dueAt
    created_at = incident.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    due_at = created_at + timedelta(days=target_days)

    # Check if overdue
    now = now_utc()
    is_overdue = incident.status in ("received", "triaged", "assigned", "in_progress") and now > due_at

    # Get department and external info
    dept = db.query(Department).filter_by(id=incident.department_id).first()
    external = False
    external_hotline = None
    if dept and dept.external_hotline:
        external = True
        external_hotline = dept.external_hotline

    # Check if in budget plan (last saved plan)
    in_budget_plan = False
    last_plan = db.query(BudgetPlan).order_by(BudgetPlan.created_at.desc()).first()
    if last_plan and incident.id in last_plan.selected:
        in_budget_plan = True

    # I1: Get last reviewed by/at set by triage confirm
    last_reviewed_by = incident.last_reviewed_by
    last_reviewed_at = iso_z(incident.last_reviewed_at) if incident.last_reviewed_at else None

    # Get triage suggestion if any
    triage = None
    # Get the first report's AI suggestion (simplified)
    first_report = db.query(Report).filter_by(incident_id=incident.id).first()
    if first_report:
        from app.models import AISuggestion
        ai_sug = db.query(AISuggestion).filter(
            AISuggestion.report_id == first_report.id,
            AISuggestion.kind == "triage",
        ).first()
        if ai_sug:
            payload = ai_sug.payload or {}
            triage = {
                "categoryId": payload.get("categoryId"),
                "severity": payload.get("severity"),
                "confidence": payload.get("confidence", 0),
                "confidences": payload.get("confidences", {}),
                "source": payload.get("source", "model"),
                "confirmed": payload.get("confirmed", False),
            }

    result = {
        "id": incident.id,
        "categoryId": incident.category_id,
        "title": incident.title,
        "severity": incident.severity,
        "status": incident.status,
        "priorityScore": incident.priority_score,
        "priorityFactors": incident.priority_factors,
        "followersCount": incident.followers_count,
        "lat": incident.lat,
        "lng": incident.lng,
        "address": incident.address,
        "landmark": incident.landmark,
        "sensitivePlace": incident.sensitive_place,
        "timeline": timeline,
        "linkedReports": linked_reports,
        "triage": triage,
        "dueAt": iso_z(due_at),
        "overdue": is_overdue,
        "external": external,
        "externalHotline": external_hotline,
        "inBudgetPlan": in_budget_plan,
        "lastReviewedBy": last_reviewed_by,
        "lastReviewedAt": last_reviewed_at,
        "createdAt": iso_z(incident.created_at),
    }
    # Remove None values
    return {k: v for k, v in result.items() if v is not None}


def work_order(db: Session, wo: WorkOrder) -> dict:
    """Serialize work order with updates and overdue status (C3)."""
    now = now_utc()
    is_overdue = False
    if wo.status in ("open", "assigned", "in_progress") and wo.due_at:
        due_at = wo.due_at
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=timezone.utc)
        is_overdue = now > due_at

    updates = work_order_updates(db, wo.id)

    # C3: Get department Arabic name and external/hotline
    dept = db.query(Department).filter_by(id=wo.department_id).first()
    dept_name = dept.name_ar if dept else wo.department_id
    external = bool(dept.external_hotline) if dept else False
    external_hotline = dept.external_hotline if dept else None

    # C3: title = linked incident title (or service request: "رفع مخلفات كبيرة"/"صيانة أشجار" + " · " + address)
    title = ""
    address = ""
    priority_score = None
    followers = None

    if wo.incident_id:
        incident = db.query(Incident).filter_by(id=wo.incident_id).first()
        if incident:
            title = incident.title
            address = incident.address
            priority_score = incident.priority_score
            followers = incident.followers_count if hasattr(incident, 'followers_count') else 0
    elif wo.service_request_id:
        sr = db.query(ServiceRequest).filter_by(id=wo.service_request_id).first()
        if sr:
            # Map service type to Arabic name
            service_type_map = {
                "bulky_waste": "رفع مخلفات كبيرة",
                "tree_maintenance": "صيانة أشجار",
            }
            sr_type = service_type_map.get(sr.service_type, sr.service_type)
            title = f"{sr_type} · {sr.address}"
            address = sr.address

    result = {
        "id": wo.id,
        "incidentId": wo.incident_id,
        "serviceRequestId": wo.service_request_id,
        "title": title,
        "address": address,
        "department": dept_name,
        "external": external,
        "externalHotline": external_hotline,
        "team": wo.team,
        "teamSize": wo.team_size,
        "supervisor": wo.supervisor,
        "status": wo.status,
        "dueAt": iso_z(wo.due_at) if wo.due_at else None,
        "overdue": is_overdue,
        "estimatedCostEgp": wo.estimated_cost_egp,
        "priorityScore": priority_score,
        "followers": followers,
        "tasks": wo.tasks or [],
        "updates": updates,
        "createdAt": iso_z(wo.created_at),
        "updatedAt": iso_z(wo.updated_at),
        "resolvedAt": iso_z(wo.resolved_at) if wo.resolved_at else None,
    }
    # C1: Remove None values
    return {k: v for k, v in result.items() if v is not None}


def admin_service_request(db: Session, sr: ServiceRequest) -> dict:
    """Serialize service request for admin view (I3)."""
    # I3: Get department from service type mapping
    service_type_to_dept = {
        "bulky_waste": "sanitation",
        "tree_maintenance": "parks",
    }
    dept_id = service_type_to_dept.get(sr.service_type)
    dept = None
    if dept_id:
        dept = db.query(Department).filter_by(id=dept_id).first()

    dept_name = dept.name_ar if dept else None

    # I3: Get assignee and workOrderId from details
    assignee = sr.details.get("assignee") if sr.details else None

    # Find work order linked to this service request
    work_order_id = None
    wo = db.query(WorkOrder).filter_by(service_request_id=sr.id).first()
    if wo:
        work_order_id = wo.id

    result = {
        "id": sr.id,
        "citizenId": sr.citizen_id,
        "serviceType": sr.service_type,
        "details": sr.details,
        "lat": sr.lat,
        "lng": sr.lng,
        "address": sr.address,
        "landmark": sr.landmark,
        "status": sr.status,
        "paid": sr.paid,
        "department": dept_name,
        "assignee": assignee,
        "workOrderId": work_order_id,
        "createdAt": iso_z(sr.created_at),
    }
    # Remove None values
    return {k: v for k, v in result.items() if v is not None}


def map_pin(incident: Incident) -> dict:
    """Serialize incident as a map pin."""
    return {
        "incidentId": incident.id,
        "lat": incident.lat,
        "lng": incident.lng,
        "status": incident.status,
        "severity": incident.severity,
        "title": incident.title,
        "address": incident.address,
    }
