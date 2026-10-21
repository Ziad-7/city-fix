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
        for loc, count in sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    ]

    # Rising categories: more incidents this week than last week
    categories_this_week = {}
    categories_last_week = {}

    for activity in db.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident",
        ActivityLog.status == "received",
    ).all():
        at = activity.at
        if at.tzinfo is None:
            from datetime import timezone
            at = at.replace(tzinfo=timezone.utc)

        incident = db.query(Incident).filter_by(id=activity.entity_id).first()
        if not incident:
            continue

        if at >= week_ago:
            categories_this_week[incident.category_id] = categories_this_week.get(incident.category_id, 0) + 1
        elif at >= two_weeks_ago:
            categories_last_week[incident.category_id] = categories_last_week.get(incident.category_id, 0) + 1

    rising = []
    for cat_id in categories_this_week:
        this_count = categories_this_week.get(cat_id, 0)
        last_count = categories_last_week.get(cat_id, 0)
        delta = this_count - last_count
        if delta > 0:
            rising.append({"categoryId": cat_id, "delta": delta})

    rising.sort(key=lambda x: x["delta"], reverse=True)

    # Overdue departments: departments with most overdue incidents
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

    overdue_departments = [
        dept_id
        for dept_id, count in sorted(overdue_by_dept.items(), key=lambda x: x[1], reverse=True)
        if count > 0
    ][:3]

    # Generate summary text
    summary = "النظام في وضع جيد"  # Default
    if len(open_incidents) > 50:
        summary = "عدد البلاغات المفتوحة مرتفع جداً"
    elif len(open_incidents) > 30:
        summary = "عدد البلاغات المفتوحة مرتفع"
    elif len(open_incidents) < 5:
        summary = "أداء ممتاز - معظم البلاغات تم حلها"
    elif len(hotspots) > 0 and hotspots[0]["count"] > 5:
        summary = f"تركز المشاكل في {hotspots[0]['address']}"

    return {
        "summary": summary,
        "hotspots": hotspots,
        "risingCategories": rising,
        "overdueDepartments": overdue_departments,
    }
