"""The numpy knapsack must pick exactly the subset the original pure-Python DP picked."""

import random
import time

import pytest

from app.logic.budget import UNIT_EGP, Candidate, knapsack


def _reference_knapsack(items: list[Candidate], budget_egp: int) -> list[int]:
    """The original implementation, kept verbatim as the oracle."""
    cap = min(budget_egp // UNIT_EGP, sum(i.units for i in items))
    if cap < 0 or not items:
        return []
    zero = (0, 0)
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


def _cand(n: int, cost: int, priority: int, followers: int) -> Candidate:
    return Candidate(
        incident_id=f"INC-{n}",
        title="t",
        category_id="pothole",
        category_label="x",
        cost_egp=cost,
        priority=priority,
        followers=followers,
    )


def _random_case(seed: int) -> tuple[list[Candidate], int]:
    rnd = random.Random(seed)
    n = rnd.choice([0, 1, 2, 3, 5, 8, 13, 21, 40])
    flavour = seed % 6
    items = []
    for k in range(n):
        if flavour == 0:  # many exact ties
            cost, prio, fol = rnd.choice([100, 200, 300]), rnd.choice([10, 20]), rnd.choice([0, 1])
        elif flavour == 1:  # zero-cost items
            cost, prio, fol = rnd.choice([0, 0, 50, 100]), rnd.randint(0, 100), rnd.randint(0, 5)
        elif flavour == 2:  # costs above the budget
            cost, prio, fol = rnd.randint(5000, 20000), rnd.randint(0, 100), rnd.randint(0, 30)
        elif flavour == 3:  # no followers
            cost, prio, fol = rnd.randint(1, 4000), rnd.randint(0, 100), 0
        else:
            cost, prio, fol = rnd.randint(1, 8000), rnd.randint(0, 100), rnd.randint(0, 50)
        items.append(_cand(k, cost, prio, fol))
    budget = rnd.choice([0, 1, 50, 99, 100, 250, 1000, 5000, 12000, 30000, 60000])
    return items, budget


@pytest.mark.parametrize("seed", range(300))
def test_matches_reference_on_random_instances(seed):
    items, budget = _random_case(seed)
    assert knapsack(items, budget) == _reference_knapsack(items, budget)


def test_never_exceeds_budget_and_handles_empty():
    assert knapsack([], 10_000) == []
    items = [_cand(1, 900, 50, 3), _cand(2, 600, 40, 2)]
    chosen = knapsack(items, 1000)
    assert sum(items[i].cost_egp for i in chosen) <= 1000


def test_large_instance_is_fast():
    rnd = random.Random(1)
    items = [_cand(n, rnd.randint(600, 7500), rnd.randint(0, 100), rnd.randint(0, 40)) for n in range(500)]
    started = time.perf_counter()
    chosen = knapsack(items, 600_000)
    elapsed = time.perf_counter() - started
    assert sum(items[i].cost_egp for i in chosen) <= 600_000
    assert elapsed < 1.0, f"knapsack took {elapsed:.2f}s"
