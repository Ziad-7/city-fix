"""Budget optimiser: 0/1 knapsack, exact over cost in units of 100 EGP (costs rounded up)."""

from dataclasses import dataclass
from math import ceil

from sqlalchemy.orm import Session

from app.logic.status import OPEN_STATUSES
from app.models import Category, Incident, WorkOrder

UNIT_EGP = 100
SENSITIVE_KINDS = ("مدرسة", "مستشفى", "حديقة")


@dataclass(frozen=True)
class Candidate:
    incident_id: str
    title: str
    category_id: str
    category_label: str
    cost_egp: int
    priority: int
    followers: int
    sensitive_place: str | None = None

    @property
    def units(self) -> int:
        return ceil(self.cost_egp / UNIT_EGP)


def knapsack(items: list[Candidate], budget_egp: int) -> list[int]:
    """Indices of the best subset: max sum of priority, ties broken by sum of followers.

    DP, exact over 100 EGP units (costs rounded up; value is the tuple (priority, followers), compared lexicographically).
    Total cost in units never exceeds budget_egp // 100, so cost never exceeds the budget.
    """
    cap = min(budget_egp // UNIT_EGP, sum(i.units for i in items))
    if cap < 0 or not items:
        return []
    zero = (0, 0)
    # best[i][w] = best value using the first i items with capacity w
    best = [[zero] * (cap + 1) for _ in range(len(items) + 1)]
    for i, it in enumerate(items, start=1):
        gain = (it.priority, it.followers)
        for w in range(cap + 1):
            skip = best[i - 1][w]
            if it.units <= w:
                prev = best[i - 1][w - it.units]
                take = (prev[0] + gain[0], prev[1] + gain[1])
                best[i][w] = max(skip, take)
            else:
                best[i][w] = skip
    chosen, w = [], cap
    for i in range(len(items), 0, -1):
        if best[i][w] != best[i - 1][w]:
            chosen.append(i - 1)
            w -= items[i - 1].units
    return sorted(chosen)


def _selected_reason(c: Candidate) -> str:
    if c.sensitive_place:
        kind = next((k for k in SENSITIVE_KINDS if c.sensitive_place.startswith(k)), c.sensitive_place)
        middle = f"قريب من {kind}"
    else:
        middle = c.category_label
    return f"أولوية {c.priority} · {middle} · {c.cost_egp:,} جنيه"


def build_plan(items: list[Candidate], budget_egp: int) -> dict:
    """BudgetPlan dict for the candidates under the budget."""
    picked = set(knapsack(items, budget_egp))
    total_cost = sum(items[i].cost_egp for i in picked)
    remaining = budget_egp - total_cost

    def entry(c: Candidate, reason: str) -> dict:
        return {
            "incidentId": c.incident_id,
            "title": c.title,
            "categoryId": c.category_id,
            "costEgp": c.cost_egp,
            "priorityScore": c.priority,
            "followers": c.followers,
            "reason": reason,
        }

    selected = [entry(items[i], _selected_reason(items[i])) for i in sorted(picked, key=lambda i: -items[i].priority)]
    skipped = []
    for i, c in enumerate(items):
        if i in picked:
            continue
        if c.cost_egp > remaining:
            reason = f"الميزانية مش مكفّية: محتاج {c.cost_egp:,} جنيه والمتبقي {remaining:,}"
        else:
            reason = "أولوية أقل من البدائل بنفس التكلفة"
        skipped.append(entry(c, reason))
    skipped.sort(key=lambda e: -e["priorityScore"])

    return {
        "budgetEgp": budget_egp,
        "selected": selected,
        "skipped": skipped,
        "totalCost": total_cost,
        "remaining": remaining,
        "coveredPriority": sum(items[i].priority for i in picked),
        "totalPriority": sum(c.priority for c in items),
        "citizensServed": sum(items[i].followers for i in picked),
        "citizensTotal": sum(c.followers for c in items),
    }


def load_candidates(db: Session, incident_ids: list[str] | None = None) -> list[Candidate]:
    """Open incidents whose work order (if any) is not done; empty/None ids = all."""
    q = db.query(Incident).filter(Incident.status.in_(OPEN_STATUSES))
    if incident_ids:
        q = q.filter(Incident.id.in_(incident_ids))
    cats = {c.id: c for c in db.query(Category).all()}
    done = {w.incident_id for w in db.query(WorkOrder).filter(WorkOrder.status == "done") if w.incident_id}
    out = []
    for i in q.order_by(Incident.id).all():
        if i.id in done:
            continue
        cat = cats.get(i.category_id)
        out.append(
            Candidate(
                incident_id=i.id,
                title=i.title,
                category_id=i.category_id,
                category_label=cat.label_ar if cat else "مشكلة",
                cost_egp=i.estimated_cost_egp or 0,
                priority=i.priority_score,
                followers=i.followers_count,
                sensitive_place=i.sensitive_place,
            )
        )
    return out


def optimize_budget(db: Session, budget_egp: int, incident_ids: list[str] | None = None) -> dict:
    return build_plan(load_candidates(db, incident_ids), budget_egp)
