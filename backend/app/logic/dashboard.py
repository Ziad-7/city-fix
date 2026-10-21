"""Dashboard data aggregation."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import (
    Incident, ActivityLog, WorkOrder, Department, Category,
    IncidentStatusEnum
)
from app.helpers import iso_z, now_utc


def build_dashboard(db: Session, range_days: str, staff_department: str = None) -> dict:
    """Build dashboard statistics.

    Args:
        db: Database session
        range_days: 'today', '7d', or '30d'
        staff_department: If provided, filter to this department only

    Returns:
        DashboardStats dict with metrics and lists
    """
    now = now_utc()

    # Parse range
    if range_days == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_days == "7d":
        since = now - timedelta(days=7)
    elif range_days == "30d":
        since = now - timedelta(days=30)
    else:
        since = now - timedelta(days=30)

    # Get all incidents (open and closed)
    all_incidents = db.query(Incident).all()
    if staff_department:
        all_incidents = [i for i in all_incidents if i.department_id == staff_department]

    # Filter incidents for this range
    open_statuses = {"received", "triaged", "assigned", "in_progress"}
    incidents_in_range = [
        i for i in all_incidents
        if i.created_at.replace(tzinfo=timezone.utc) >= since
    ]
    open_in_range = [i for i in incidents_in_range if i.status in open_statuses]

    # Count open (all time)
    open_all = [i for i in all_incidents if i.status in open_statuses]
    open_count = len(open_all)

    # Count resolved within the selected range
    resolved_in_range = []
    for activity in db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.status == "resolved",
    ).all():
        at = activity.at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if at >= since:
            resolved_in_range.append(activity.entity_id)

    unique_resolved = set(resolved_in_range)
    resolved_count = len(unique_resolved)

    # Count overdue (open incidents past their deadline)
    overdue_count = 0
    overdue_list = []
    for incident in open_all:
        category = db.query(Category).filter_by(id=incident.category_id).first()
        if not category:
            continue
        created_at = incident.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        deadline = created_at + timedelta(days=category.target_days)
        if now > deadline:
            overdue_count += 1
            hours_late = int((now - deadline).total_seconds() / 3600)
            overdue_list.append({
                "incidentId": incident.id,
                "title": incident.title,
                "department": incident.department_id or "",
                "address": incident.address,
                "priorityScore": incident.priority_score,
                "dueAt": iso_z(deadline),
                "hoursLate": hours_late,
                "external": False,
            })

    # Sort overdue list by priority desc, take top 5
    overdue_list.sort(key=lambda x: x["priorityScore"], reverse=True)
    overdue_list = overdue_list[:5]

    # Compute open delta and resolved delta (change from previous period)
    # For simplicity: compare with double the range
    if range_days == "today":
        prev_since = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
    elif range_days == "7d":
        prev_since = now - timedelta(days=14)
    elif range_days == "30d":
        prev_since = now - timedelta(days=60)
    else:
        prev_since = now - timedelta(days=60)

    prev_open = [
        i for i in all_incidents
        if i.created_at.replace(tzinfo=timezone.utc) >= prev_since
        and i.created_at.replace(tzinfo=timezone.utc) < since
        and i.status in open_statuses
    ]
    open_delta = len(open_in_range) - len(prev_open)

    prev_resolved = []
    for activity in db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.status == "resolved",
    ).all():
        at = activity.at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if prev_since <= at < since:
            prev_resolved.append(activity.entity_id)
    resolved_delta = resolved_count - len(set(prev_resolved))

    # Average resolution days
    resolved_incidents = [
        i for i in all_incidents
        if i.status == "resolved"
    ]
    avg_resolution_days = 0
    avg_resolution_delta_days = 0
    if resolved_incidents:
        total_days = 0
        for incident in resolved_incidents:
            # Find when it was resolved
            resolved_activity = db.query(ActivityLog).filter(
                ActivityLog.entity_type == "incident",
                ActivityLog.entity_id == incident.id,
                ActivityLog.status == "resolved",
            ).first()
            if resolved_activity:
                created = incident.created_at
                resolved = resolved_activity.at
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if resolved.tzinfo is None:
                    resolved = resolved.replace(tzinfo=timezone.utc)
                days = (resolved - created).days
                total_days += days
        avg_resolution_days = int(total_days / len(resolved_incidents)) if resolved_incidents else 0

    # By category breakdown (open only)
    by_category = {}
    for incident in open_all:
        cat_id = incident.category_id
        by_category[cat_id] = by_category.get(cat_id, 0) + 1

    by_category_list = [
        {"categoryId": cat_id, "count": count}
        for cat_id, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    ]

    # By status (open statuses + resolved)
    by_status = {}
    for incident in all_incidents:
        status = incident.status
        if status in open_statuses or status == "resolved":
            by_status[status] = by_status.get(status, 0) + 1

    by_status_list = [
        {"status": status, "count": count}
        for status, count in by_status.items()
    ]

    # Departments workload
    departments_list = []
    depts = db.query(Department).all()
    for dept in depts:
        dept_incidents = [i for i in all_incidents if i.department_id == dept.id]
        dept_open = [i for i in dept_incidents if i.status in open_statuses]
        dept_overdue = 0
        for incident in dept_open:
            category = db.query(Category).filter_by(id=incident.category_id).first()
            if category:
                created_at = incident.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                deadline = created_at + timedelta(days=category.target_days)
                if now > deadline:
                    dept_overdue += 1

        # Avg resolution for this department
        dept_resolved = [i for i in dept_incidents if i.status == "resolved"]
        dept_avg_res_days = 0
        if dept_resolved:
            total = 0
            for incident in dept_resolved:
                resolved_activity = db.query(ActivityLog).filter(
                    ActivityLog.entity_type == "incident",
                    ActivityLog.entity_id == incident.id,
                    ActivityLog.status == "resolved",
                ).first()
                if resolved_activity:
                    created = incident.created_at
                    resolved = resolved_activity.at
                    if created.tzinfo is None:
                        created = created.replace(tzinfo=timezone.utc)
                    if resolved.tzinfo is None:
                        resolved = resolved.replace(tzinfo=timezone.utc)
                    days = (resolved - created).days
                    total += days
            dept_avg_res_days = int(total / len(dept_resolved))

        # Load percentage (open incidents vs work orders)
        dept_load_pct = 0
        if dept_open:
            dept_work_orders = [w for w in db.query(WorkOrder).filter_by(department_id=dept.id).all()
                               if w.status in ("open", "assigned", "in_progress")]
            dept_load_pct = min(100, int(len(dept_work_orders) * 100 / len(dept_open)))

        if len(dept_open) > 0 or dept_overdue > 0:
            departments_list.append({
                "department": dept.name_ar,
                "external": bool(dept.external_hotline),
                "externalHotline": dept.external_hotline,
                "open": len(dept_open),
                "overdue": dept_overdue,
                "avgResolutionDays": dept_avg_res_days,
                "loadPct": dept_load_pct,
            })

    # Activity feed (latest 8 activities)
    activities = db.query(ActivityLog).order_by(ActivityLog.at.desc()).limit(8).all()
    activity_list = [
        {
            "actor": activity.actor,
            "text": activity.note or f"{activity.kind}: {activity.status}",
            "entityId": activity.entity_id,
            "status": activity.status,
            "at": iso_z(activity.at),
        }
        for activity in activities
    ]

    # Nav counts
    nav = {
        "incidentsOpen": len(open_all),
        "serviceRequestsOpen": 0,  # Would need to query ServiceRequest
    }

    return {
        "open": len(open_in_range),
        "openDelta": open_delta,
        "overdue": overdue_count,
        "resolvedThisWeek": resolved_count,
        "resolvedDelta": resolved_delta,
        "avgResolutionDays": avg_resolution_days,
        "avgResolutionDeltaDays": 0,  # Simplified
        "byCategory": by_category_list,
        "byStatus": by_status_list,
        "overdueList": overdue_list,
        "overdueTotal": overdue_count,
        "departments": departments_list,
        "activity": activity_list,
        "nav": nav,
    }
