"""Insights generation - deterministic Arabic summaries."""

from datetime import timedelta
from sqlalchemy.orm import Session
from app.models import Incident, ActivityLog, Category
from app.helpers import now_utc


def generate_insights(db: Session) -> dict:
    """Generate deterministic insights from data.

    Returns:
        Insights dict with {summary, hotspots[], risingCategories[], overdueDepartments[]}
    """
    now = now_utc()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # Get all incidents
    all_incidents = db.query(Incident).all()
    open_statuses = {"received", "triaged", "assigned", "in_progress"}
    open_incidents = [i for i in all_incidents if i.status in open_statuses]

    # Hotspots: locations with most incidents
    location_counts = {}
    for incident in open_incidents:
        location = incident.address or f"({incident.lat}, {incident.lng})"
        location_counts[location] = location_counts.get(location, 0) + 1

    hotspots = [
        {"address": loc, "count": count}
        for loc, count in sorted(
            location_counts.items(), key=lambda x: x[1], reverse=True
        )[:3]
    ]

    # Rising categories: more incidents this week than last week
    categories_this_week = {}
    categories_last_week = {}

    for activity in (
        db.query(ActivityLog)
        .filter(
            ActivityLog.entity_type == "incident",
            ActivityLog.status == "received",
        )
        .all()
    ):
        at = activity.at
        if at.tzinfo is None:
            from datetime import timezone

            at = at.replace(tzinfo=timezone.utc)

        incident = db.query(Incident).filter_by(id=activity.entity_id).first()
        if not incident:
            continue

        if at >= week_ago:
            categories_this_week[incident.category_id] = (
                categories_this_week.get(incident.category_id, 0) + 1
            )
        elif at >= two_weeks_ago:
            categories_last_week[incident.category_id] = (
                categories_last_week.get(incident.category_id, 0) + 1
            )

    rising = []
    for cat_id in categories_this_week:
        this_count = categories_this_week.get(cat_id, 0)
        last_count = categories_last_week.get(cat_id, 0)
        delta = this_count - last_count
        if delta > 0:
            rising.append({"categoryId": cat_id, "delta": delta})

    rising.sort(key=lambda x: x["delta"], reverse=True)

    # I9: Overdue departments: departments with most overdue incidents
    from app.models import Department

    overdue_by_dept = {}

    for incident in open_incidents:
        category = db.query(Category).filter_by(id=incident.category_id).first()
        if not category:
            continue

        from datetime import timezone

        created_at = incident.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        deadline = created_at + timedelta(days=category.target_days)
        if now > deadline:
            dept_id = incident.department_id
            if dept_id not in overdue_by_dept:
                overdue_by_dept[dept_id] = 0
            overdue_by_dept[dept_id] += 1

    # I9: Return Arabic department names, not IDs
    overdue_department_ids = [
        dept_id
        for dept_id, count in sorted(
            overdue_by_dept.items(), key=lambda x: x[1], reverse=True
        )
        if count > 0
    ][:3]

    overdue_departments = []
    for dept_id in overdue_department_ids:
        dept = db.query(Department).filter_by(id=dept_id).first()
        if dept:
            overdue_departments.append(dept.name_ar)
        else:
            overdue_departments.append(dept_id)

    # I9: Generate Arabic summary with real numbers
    # Count created and resolved in window
    created_this_week = 0
    resolved_this_week = 0
    for activity in (
        db.query(ActivityLog)
        .filter(
            ActivityLog.entity_type == "incident",
            ActivityLog.status == "received",
            ActivityLog.at >= week_ago,
        )
        .all()
    ):
        created_this_week += 1

    for activity in (
        db.query(ActivityLog)
        .filter(
            ActivityLog.entity_type == "incident",
            ActivityLog.at >= week_ago,
        )
        .all()
    ):
        if activity.status in ("resolved", "closed"):
            resolved_this_week += 1

    # Build summary with real numbers
    summary_parts = []
    if created_this_week > 0 or resolved_this_week > 0:
        summary_parts.append(
            f"الأسبوع ده وصل {created_this_week} بلاغ جديد واتحل {resolved_this_week}"
        )

    # Most rising category
    if rising:
        cat = db.query(Category).filter_by(id=rising[0]["categoryId"]).first()
        cat_label = cat.label_ar if cat else rising[0]["categoryId"]
        summary_parts.append(f"أكتر نوع زايد: {cat_label} (+{rising[0]['delta']})")

    # Overdue by department
    for dept_name in overdue_departments[:1]:  # Only mention the worst
        # Count how many overdue
        overdue_count = sum(
            1
            for inc in open_incidents
            if inc.department_id
            in [d.id for d in db.query(Department).all() if d.name_ar == dept_name]
        )
        if overdue_count > 0:
            summary_parts.append(f"{dept_name} عندها {overdue_count} متأخرين")

    summary = ". ".join(summary_parts) if summary_parts else "النظام في وضع جيد"

    return {
        "summary": summary,
        "hotspots": hotspots,
        "risingCategories": rising,
        "overdueDepartments": overdue_departments,
    }
