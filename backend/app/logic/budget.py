"""Budget optimization using 0/1 knapsack DP."""

from math import ceil
from sqlalchemy.orm import Session
from app.models import Incident, Category, WorkOrder


def optimize_budget(
    db: Session, budget_egp: int, incident_ids: list[str] = None
) -> dict:
    """
    Optimize budget allocation using 0/1 knapsack DP.

    Uses units of 100 EGP. When there are ties in value, prefer higher follower count.
    Each selected incident gets a one-line Arabic reason.

    Args:
        db: Database session
        budget_egp: Total budget in EGP
        incident_ids: Optional list of incident IDs to consider (if None, use all open)

    Returns:
        dict with {budgetEgp, selected[], skipped[], totalCost, remaining, coveredPriority, totalPriority, citizensServed, citizensTotal}
    """
    # Get candidate incidents (open, without done work order)
    open_statuses = {"received", "triaged", "assigned", "in_progress"}
    candidates = []

    if incident_ids:
        # Filter to specific incidents
        for inc_id in incident_ids:
            incident = db.query(Incident).filter_by(id=inc_id).first()
            if incident and incident.status in open_statuses:
                # Check if it already has a done work order
                wo = db.query(WorkOrder).filter_by(incident_id=inc_id).first()
                if not wo or wo.status != "done":
                    candidates.append(incident)
    else:
        # All open incidents
        for incident in (
            db.query(Incident).filter(Incident.status.in_(open_statuses)).all()
        ):
            wo = db.query(WorkOrder).filter_by(incident_id=incident.id).first()
            if not wo or wo.status != "done":
                candidates.append(incident)

    # Prepare items: (cost_units, priority, followers, incident)
    # I6: cost_units = ceil(cost / 100 EGP)
    items = []
    for incident in candidates:
        category = db.query(Category).filter_by(id=incident.category_id).first()
        cost = category.estimated_cost_egp if category else 1000
        cost_units = ceil(cost / 100)  # I6: Use ceil instead of floor
        items.append(
            (cost_units, incident.priority_score, incident.followers_count, incident)
        )

    # DP knapsack: dp[w] = max (priority_score, total_followers, items_indices)
    capacity = budget_egp // 100
    dp = {}

    # Base case
    dp[0] = (0, 0, [])  # (total_priority, total_followers, indices)

    # Fill DP table
    for i, (cost_units, priority, followers, incident) in enumerate(items):
        # Traverse in reverse to avoid using the same item twice
        new_dp = dict(dp)
        for w in range(capacity, cost_units - 1, -1):
            if (w - cost_units) in dp:
                prev_priority, prev_followers, prev_indices = dp[w - cost_units]
                new_priority = prev_priority + priority
                new_followers = prev_followers + followers
                new_indices = prev_indices + [i]

                if w not in dp:
                    # No item at this weight yet
                    new_dp[w] = (new_priority, new_followers, new_indices)
                else:
                    # Compare: prioritize priority, then followers
                    old_priority, old_followers, old_indices = dp[w]
                    if (new_priority, new_followers) > (old_priority, old_followers):
                        new_dp[w] = (new_priority, new_followers, new_indices)
        dp = new_dp

    # Find best solution
    best_w = 0
    best_priority = 0
    best_followers = 0
    best_indices = []

    for w in range(capacity + 1):
        if w in dp:
            priority, followers, indices = dp[w]
            if (priority, followers) > (best_priority, best_followers):
                best_w = w
                best_priority = priority
                best_followers = followers
                best_indices = indices

    # Build result
    selected_items = [items[i] for i in best_indices]
    selected_incidents = [items[i][3] for i in best_indices]

    # Calculate reasons for selected items
    selected_list = []
    for cost_units, priority, followers, incident in selected_items:
        cost_egp = cost_units * 100
        category = db.query(Category).filter_by(id=incident.category_id).first()
        cat_label = category.label_ar if category else "مشكلة"

        # Format: "أولوية 78 · قريب من مدرسة · 1,800 جنيه"
        reason_parts = [f"أولوية {priority}"]

        # Add category/sensitive place info
        if incident.sensitive_place:
            reason_parts.append(f"قريب من {incident.sensitive_place}")
        else:
            reason_parts.append(cat_label)

        # Add cost with thousands separator
        cost_str = f"{cost_egp:,}".replace(",", ",")  # Use Arabic thousands
        reason_parts.append(f"{cost_str} جنيه")

        reason = " · ".join(reason_parts)

        selected_list.append(
            {
                "incidentId": incident.id,
                "title": incident.title,
                "categoryId": incident.category_id,
                "costEgp": cost_egp,
                "priorityScore": priority,
                "followers": followers,
                "reason": reason,
            }
        )

    # Calculate reasons for skipped items
    skipped_list = []
    for cost_units, priority, followers, incident in items:
        if incident not in selected_incidents:
            cost_egp = cost_units * 100
            category = db.query(Category).filter_by(id=incident.category_id).first()
            cat_label = category.label_ar if category else "مشكلة"

            # Check if it's a priority issue or budget issue
            # For now: if remaining budget < cost, it's budget; else it's priority
            remaining = (capacity - best_w) * 100
            if remaining < cost_egp:
                # "الميزانية مش مكفّية: محتاج 7,500 جنيه والمتبقي 2,100"
                reason = f"الميزانية مش مكفّية: محتاج {cost_egp:,} جنيه والمتبقي {remaining:,}"
            else:
                # "أولوية أقل من البدائل بنفس التكلفة"
                reason = "أولوية أقل من البدائل بنفس التكلفة"

            skipped_list.append(
                {
                    "incidentId": incident.id,
                    "title": incident.title,
                    "categoryId": incident.category_id,
                    "costEgp": cost_egp,
                    "priorityScore": priority,
                    "followers": followers,
                    "reason": reason,
                }
            )

    total_cost = best_w * 100
    remaining = budget_egp - total_cost

    # Calculate citizens served (sum of followers of selected incidents)
    citizens_served = sum(inc.followers_count for inc in selected_incidents)
    citizens_total = sum(inc.followers_count for inc in candidates)

    return {
        "budgetEgp": budget_egp,
        "selected": selected_list,
        "skipped": skipped_list,
        "totalCost": total_cost,
        "remaining": remaining,
        "coveredPriority": best_priority,
        "totalPriority": sum(priority for _, priority, _, _ in items),
        "citizensServed": citizens_served,
        "citizensTotal": citizens_total,
    }
