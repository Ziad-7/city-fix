"""Dashboard data aggregation."""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import (
    Incident, ActivityLog, WorkOrder, Department, Category,
    IncidentStatusEnum, ServiceRequest
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
    open_statuses = {"received", "triaged", "assigned", "in_progress"}

    # Parse range
    if range_days == "today":
        since = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_days == "7d":
        since = now - timedelta(days=7)
    elif range_days == "30d":
        since = now - timedelta(days=30)
    else:
        since = now - timedelta(days=30)

    # Load categories and departments once per request
    categories = {c.id: c for c in db.query(Category).all()}
    departments = {d.id: d for d in db.query(Department).all()}

    # Get all incidents
    all_incidents = db.query(Incident).all()
    if staff_department:
        all_incidents = [i for i in all_incidents if i.department_id == staff_department]

    # C1: open = CURRENT open count (all open incidents, never range-filtered)
    open_all = [i for i in all_incidents if i.status in open_statuses]
    open_count = len(open_all)

    # Get resolved incidents in window
    resolved_in_window = []
    for activity in db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.status == "resolved",
    ).all():
        at = activity.at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if at >= since:
            resolved_in_window.append(activity.entity_id)
    unique_resolved_in_window = set(resolved_in_window)

    # Get incidents created in window
    created_in_window = [
        i for i in all_incidents
        if i.created_at.replace(tzinfo=timezone.utc) >= since
    ]

    # C1: openDelta = (created in window) - (resolved in window)
    open_delta = len(created_in_window) - len(unique_resolved_in_window)

    # C1: resolvedThisWeek = resolved within window
    resolved_this_week = len(unique_resolved_in_window)

    # Compute previous window for deltas
    if range_days == "today":
        prev_since = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
        prev_until = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_days == "7d":
        prev_since = now - timedelta(days=14)
        prev_until = now - timedelta(days=7)
    elif range_days == "30d":
        prev_since = now - timedelta(days=60)
        prev_until = now - timedelta(days=30)
    else:
        prev_since = now - timedelta(days=60)
        prev_until = now - timedelta(days=30)

    # Get previous window resolved count
    prev_resolved = []
    for activity in db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.status == "resolved",
    ).all():
        at = activity.at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        if prev_until <= at < since:
            prev_resolved.append(activity.entity_id)
    prev_resolved_count = len(set(prev_resolved))

    # C1: resolvedDelta = current window - previous window
    resolved_delta = resolved_this_week - prev_resolved_count

    # C1: avgResolutionDays from incidents resolved in window
    avg_resolution_days = 0.0
    resolved_incidents_in_window = []
    for inc_id in unique_resolved_in_window:
        incident = db.query(Incident).filter_by(id=inc_id).first()
        if incident:
            resolved_incidents_in_window.append(incident)

    if resolved_incidents_in_window:
        total_days = 0
        for incident in resolved_incidents_in_window:
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
                days = (resolved - created).total_seconds() / 86400
                total_days += days
        avg_resolution_days = round(total_days / len(resolved_incidents_in_window), 1)

    # C1: avgResolutionDeltaDays from previous window
    avg_resolution_delta_days = 0.0
    prev_resolved_incidents = []
    for inc_id in set(prev_resolved):
        incident = db.query(Incident).filter_by(id=inc_id).first()
        if incident:
            prev_resolved_incidents.append(incident)

    if prev_resolved_incidents:
        total_days = 0
        for incident in prev_resolved_incidents:
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
                days = (resolved - created).total_seconds() / 86400
                total_days += days
        prev_avg_resolution_days = round(total_days / len(prev_resolved_incidents), 1)
        avg_resolution_delta_days = round(avg_resolution_days - prev_avg_resolution_days, 1)

    # Count overdue (open incidents past their deadline or due within 12h)
    overdue_count = 0
    overdue_list = []
    for incident in open_all:
        category = categories.get(incident.category_id)
        if not category:
            continue
        created_at = incident.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        due_at = created_at + timedelta(days=category.target_days)

        # C1: overdue OR due within 12h
        hours_until_due = (due_at - now).total_seconds() / 3600
        hours_late = round((now - due_at).total_seconds() / 3600)
        is_overdue = hours_until_due <= 12

        if is_overdue:
            overdue_count += 1
            # C1: hoursLate = round((now - dueAt) hours), negative = remaining
            dept = departments.get(incident.department_id)
            overdue_list.append({
                "incidentId": incident.id,
                "title": incident.title,
                "department": dept.name_ar if dept else "",
                "address": incident.address,
                "priorityScore": incident.priority_score,
                "dueAt": iso_z(due_at),
                "hoursLate": hours_late,
                "external": bool(dept.external_hotline) if dept else False,
                "externalHotline": dept.external_hotline if dept else None,
            })

    # Sort overdue list by priority desc, take top 5
    overdue_list.sort(key=lambda x: x["priorityScore"], reverse=True)
    overdue_list = overdue_list[:5]

    # Remove None externalHotline values
    overdue_list = [
        {k: v for k, v in item.items() if v is not None}
        for item in overdue_list
    ]

    # By category breakdown (open only)
    by_category = {}
    for incident in open_all:
        cat_id = incident.category_id
        by_category[cat_id] = by_category.get(cat_id, 0) + 1

    by_category_list = [
        {"categoryId": cat_id, "count": count}
        for cat_id, count in sorted(by_category.items(), key=lambda x: x[1], reverse=True)
    ]

    # C1: byStatus = open statuses (current) + "resolved" = resolved within window
    by_status = {}
    for incident in open_all:
        status = incident.status
        by_status[status] = by_status.get(status, 0) + 1
    # Add resolved within window
    by_status["resolved"] = resolved_this_week

    by_status_list = [
        {"status": status, "count": count}
        for status, count in by_status.items()
    ]

    # Departments workload (filter by staff_department if provided)
    departments_list = []
    for dept in departments.values():
        if staff_department and dept.id != staff_department:
            continue

        dept_incidents = [i for i in all_incidents if i.department_id == dept.id]
        dept_open = [i for i in dept_incidents if i.status in open_statuses]
        dept_overdue = 0
        for incident in dept_open:
            category = categories.get(incident.category_id)
            if category:
                created_at = incident.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                deadline = created_at + timedelta(days=category.target_days)
                hours_until = (deadline - now).total_seconds() / 3600
                if hours_until <= 12:
                    dept_overdue += 1

        # Avg resolution for this department (from window)
        dept_resolved_in_window = [i for i in dept_incidents if i.id in unique_resolved_in_window]
        dept_avg_res_days = 0.0
        if dept_resolved_in_window:
            total = 0.0
            for incident in dept_resolved_in_window:
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
                    days = (resolved - created).total_seconds() / 86400
                    total += days
            dept_avg_res_days = round(total / len(dept_resolved_in_window), 1)

        # Load percentage (open incidents vs work orders)
        dept_load_pct = 0
        if dept_open:
            dept_work_orders = db.query(WorkOrder).filter_by(department_id=dept.id).all()
            dept_work_orders = [w for w in dept_work_orders if w.status in ("open", "assigned", "in_progress")]
            dept_load_pct = min(100, int(len(dept_work_orders) * 100 / len(dept_open)))

        if len(dept_open) > 0 or dept_overdue > 0:
            dept_dict = {
                "department": dept.name_ar,
                "open": len(dept_open),
                "overdue": dept_overdue,
                "avgResolutionDays": dept_avg_res_days,
                "loadPct": dept_load_pct,
            }
            # C1: Omit None everywhere
            if dept.external_hotline:
                dept_dict["external"] = True
                dept_dict["externalHotline"] = dept.external_hotline
            departments_list.append(dept_dict)

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

    # C1: nav.serviceRequestsOpen = count of service requests not resolved/closed
    service_requests_open = db.query(ServiceRequest).filter(
        ServiceRequest.status.notin_(["resolved", "closed"])
    ).all()
    if staff_department:
        service_requests_open = [
            sr for sr in service_requests_open
            if sr.details.get("department") == staff_department
        ]
    nav = {
        "incidentsOpen": open_count,
        "serviceRequestsOpen": len(service_requests_open),
    }

    return {
        "open": open_count,
        "openDelta": open_delta,
        "overdue": overdue_count,
        "resolvedThisWeek": resolved_this_week,
        "resolvedDelta": resolved_delta,
        "avgResolutionDays": avg_resolution_days,
        "avgResolutionDeltaDays": avg_resolution_delta_days,
        "byCategory": by_category_list,
        "byStatus": by_status_list,
        "overdueList": overdue_list,
        "overdueTotal": overdue_count,
        "departments": departments_list,
        "activity": activity_list,
        "nav": nav,
    }
