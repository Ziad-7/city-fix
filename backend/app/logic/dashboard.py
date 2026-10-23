"""Dashboard aggregation (DashboardStats)."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.helpers import iso_z, now_utc
from app.logic.overdue import aware, due_at, hours_late, is_due_soon, is_open, is_overdue
from app.logic.serialize import SERVICE_TYPE_DEPARTMENT
from app.logic.status import INCIDENT_STATUSES, OPEN_STATUSES
from app.models import ActivityLog, Category, Department, Incident, ServiceRequest, WorkOrder

RANGES = ("today", "7d", "30d")
CAIRO = ZoneInfo("Africa/Cairo")  # the product's calendar: "today" starts at Cairo midnight, not UTC midnight


def window_bounds(range_: str, now: datetime) -> tuple[datetime, datetime]:
    """(since, previous_since): the window is [since, now], the previous one [previous_since, since)."""
    if range_ == "today":
        today = now.astimezone(CAIRO).date()
        since = datetime.combine(today, time.min, tzinfo=CAIRO).astimezone(UTC)
        previous = datetime.combine(today - timedelta(days=1), time.min, tzinfo=CAIRO).astimezone(UTC)
        return since, previous
    days = 7 if range_ == "7d" else 30
    return now - timedelta(days=days), now - timedelta(days=2 * days)


def resolved_at_map(db: Session) -> dict[str, datetime]:
    """Incident id -> time of its latest ``resolved`` activity."""
    out: dict[str, datetime] = {}
    rows = db.query(ActivityLog).filter(ActivityLog.entity_type == "incident", ActivityLog.status == "resolved")
    for a in rows.all():
        at = aware(a.at)
        if a.entity_id not in out or at > out[a.entity_id]:
            out[a.entity_id] = at
    return out


def _avg_days(incs: list[Incident], resolved: dict[str, datetime]) -> float:
    if not incs:
        return 0.0
    total = sum((resolved[i.id] - aware(i.created_at)).total_seconds() / 86400 for i in incs)
    return round(total / len(incs), 1)


def build_dashboard(db: Session, range_: str, staff_department: str | None = None) -> dict:
    now = now_utc()
    since, prev_since = window_bounds(range_, now)
    cats = {c.id: c for c in db.query(Category).all()}
    depts = {d.id: d for d in db.query(Department).all()}

    incidents = db.query(Incident).all()
    if staff_department:
        incidents = [i for i in incidents if i.department_id == staff_department]
    by_id = {i.id: i for i in incidents}
    open_incs = [i for i in incidents if is_open(i)]

    resolved = resolved_at_map(db)
    cur = [by_id[k] for k, at in resolved.items() if k in by_id and since <= at <= now]
    prev = [by_id[k] for k, at in resolved.items() if k in by_id and prev_since <= at < since]
    created_in_window = [i for i in incidents if aware(i.created_at) >= since]

    avg = _avg_days(cur, resolved)
    avg_prev = _avg_days(prev, resolved)

    overdue_count = sum(1 for i in open_incs if is_overdue(i, cats.get(i.category_id), now))
    due_list = sorted(
        (i for i in open_incs if is_due_soon(i, cats.get(i.category_id), now)),
        key=lambda i: (-i.priority_score, i.id),
    )[:5]
    overdue_list = []
    for i in due_list:
        cat = cats.get(i.category_id)
        dept = depts.get(i.department_id)
        item = {
            "incidentId": i.id,
            "title": i.title,
            "department": dept.name_ar if dept else (i.department_id or ""),
            "address": i.address,
            "priorityScore": i.priority_score,
            "dueAt": iso_z(due_at(i, cat)),
            "hoursLate": hours_late(i, cat, now),
            "external": bool(dept and dept.external_hotline),
        }
        if dept and dept.external_hotline:
            item["externalHotline"] = dept.external_hotline
        overdue_list.append(item)

    by_category: dict[str, int] = {}
    for i in open_incs:
        by_category[i.category_id] = by_category.get(i.category_id, 0) + 1
    by_category_list = [
        {"categoryId": c, "count": n} for c, n in sorted(by_category.items(), key=lambda kv: (-kv[1], kv[0]))
    ]

    status_counts = {s: 0 for s in OPEN_STATUSES}
    for i in open_incs:
        status_counts[getattr(i.status, "value", i.status)] += 1
    by_status = [{"status": s, "count": n} for s, n in status_counts.items()]
    by_status.append({"status": "resolved", "count": len(cur)})

    # Departments workload
    rows = []
    for d in depts.values():
        if staff_department and d.id != staff_department:
            continue
        d_open = [i for i in open_incs if i.department_id == d.id]
        if not d_open:
            continue
        d_resolved = [i for i in cur if i.department_id == d.id]
        row = {
            "department": d.name_ar,
            "external": bool(d.external_hotline),
            "open": len(d_open),
            "overdue": sum(1 for i in d_open if is_overdue(i, cats.get(i.category_id), now)),
            "avgResolutionDays": _avg_days(d_resolved, resolved),
        }
        if d.external_hotline:
            row["externalHotline"] = d.external_hotline
        rows.append(row)
    busiest = max((r["open"] for r in rows), default=1)
    for r in rows:
        r["loadPct"] = round(100 * r["open"] / busiest)
    rows.sort(key=lambda r: (-r["open"], r["department"]))

    # Activity feed (latest 8), staff limited to their own incidents / work orders
    q = db.query(ActivityLog).filter(ActivityLog.entity_type.in_(["incident", "work_order", "service_request"]))
    feed = []
    wo_ids: set[str] = set()
    if staff_department:
        wo_ids = {w.id for w in db.query(WorkOrder).filter(WorkOrder.department_id == staff_department)}
    for a in q.order_by(ActivityLog.at.desc(), ActivityLog.id.desc()).limit(500):
        if staff_department:
            allowed = (a.entity_type == "incident" and a.entity_id in by_id) or (
                a.entity_type == "work_order" and a.entity_id in wo_ids
            )
            if not allowed:
                continue
        item = {
            "actor": a.actor,
            "text": a.note or "تحديث",
            "entityId": a.entity_id,
            "at": iso_z(a.at),
        }
        if a.status in INCIDENT_STATUSES:
            item["status"] = a.status
        feed.append(item)
        if len(feed) == 8:
            break

    open_srs = db.query(ServiceRequest).filter(ServiceRequest.status.notin_(["resolved", "closed"])).all()
    if staff_department:
        open_srs = [s for s in open_srs if SERVICE_TYPE_DEPARTMENT.get(s.service_type) == staff_department]

    return {
        "open": len(open_incs),
        "openDelta": len(created_in_window) - len(cur),
        "overdue": overdue_count,
        "resolvedThisWeek": len(cur),
        "resolvedDelta": len(cur) - len(prev),
        "avgResolutionDays": avg,
        "avgResolutionDeltaDays": round(avg - avg_prev, 1) if prev else 0.0,
        "byCategory": by_category_list,
        "byStatus": by_status,
        "overdueList": overdue_list,
        "overdueTotal": overdue_count,
        "departments": rows,
        "activity": feed,
        "nav": {"incidentsOpen": len(open_incs), "serviceRequestsOpen": len(open_srs)},
    }
