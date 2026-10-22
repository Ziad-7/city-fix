from app.logic.ids import next_id
from app.models import BudgetPlan


def test_next_budget_plan_id_uses_largest_numeric_suffix(db):
    for number in range(1, 11):
        db.add(
            BudgetPlan(
                id=f"BP-{number}",
                budget_egp=1000,
                selected=[],
                skipped=[],
                total_cost=0,
                remaining=1000,
            )
        )
    db.commit()

    assert next_id(db, "BP") == "BP-11"
