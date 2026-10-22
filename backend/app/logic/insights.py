"""Deterministic weekly insights computed from the data (Insights)."""

from collections import Counter
from datetime import timedelta

from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.logic.dashboard import resolved_at_map
from app.logic.overdue import aware, is_open, is_overdue
from app.models import Category, Department, Incident


def generate_insights(db: Session, department_id: str | None = None) -> dict:
    now = now_utc()
    week_ago, two_weeks_ago = now - timedelta(days=7), now - timedelta(days=14)
    cats = {c.id: c for c in db.query(Category).all()}
    depts = {d.id: d for d in db.query(Department).all()}
    query = db.query(Incident)
    if department_id:
        query = query.filter(Incident.department_id == department_id)
    incidents = query.all()
    open_incs = [i for i in incidents if is_open(i)]

    hotspot_counts = Counter(i.address for i in open_incs if i.address)
    hotspots = [
        {"address": a, "count": n} for a, n in sorted(hotspot_counts.items(), key=lambda kv: (-kv[1], kv[0]))[:3]
    ]

    this_week = Counter(i.category_id for i in incidents if aware(i.created_at) >= week_ago)
    last_week = Counter(i.category_id for i in incidents if two_weeks_ago <= aware(i.created_at) < week_ago)
    rising = sorted(
        ({"categoryId": c, "delta": n - last_week.get(c, 0)} for c, n in this_week.items() if n > last_week.get(c, 0)),
        key=lambda r: (-r["delta"], r["categoryId"]),
    )

    overdue_by_dept = Counter(
        i.department_id for i in open_incs if i.department_id and is_overdue(i, cats.get(i.category_id), now)
    )
    ranked = sorted(overdue_by_dept.items(), key=lambda kv: (-kv[1], kv[0]))
    overdue_departments = [depts[d].name_ar if d in depts else d for d, _ in ranked[:3]]

    created = sum(this_week.values())
    scoped_ids = {i.id for i in incidents}
    resolved = sum(1 for iid, at in resolved_at_map(db).items() if at >= week_ago and iid in scoped_ids)
    sentences = [f"الأسبوع ده وصل {created} بلاغ جديد واتحل {resolved}"]
    if rising:
        top = rising[0]
        cat = cats.get(top["categoryId"])
        sentences.append(f"أكتر نوع زايد: {cat.label_ar if cat else top['categoryId']} (+{top['delta']})")
    if ranked:
        d, n = ranked[0]
        sentences.append(f"{depts[d].name_ar if d in depts else d} عندها {n} متأخرين")

    return {
        "summary": ". ".join(sentences) + ".",
        "hotspots": hotspots,
        "risingCategories": rising,
        "overdueDepartments": overdue_departments,
    }
