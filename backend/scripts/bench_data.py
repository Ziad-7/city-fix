"""Synthetic bulk rows for local benchmarks and scale tests.

Synthetic local benchmark rows; never run against a real database (no CLI, no DATABASE_URL).
Everything created here is obviously fake: profiles ``BENCH-C{n}`` have no phone number, bins are
``BIN-BENCH-{n}`` and flagged ``is_simulated``, collectors are ``COL-BENCH-{n}``, pickups are
``RCY-BENCH-{n}``. The caller owns the transaction: this module only ``flush()``es.
"""

import random
from datetime import timedelta

from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.models import (
    ActivityLog,
    BinReading,
    Collector,
    Incident,
    IncidentFollower,
    Profile,
    RecyclingPickup,
    Report,
    ServiceRequest,
    SmartBin,
    Weighing,
    WorkOrder,
)

# (category id, department id) pairs that exist in app.seed
_CATEGORIES = [
    ("pothole", "roads"),
    ("garbage", "sanitation"),
    ("streetlight_out", "lighting"),
    ("broken_sidewalk", "roads"),
    ("sewage_overflow", "sewage"),
    ("stray_dogs", "veterinary"),
    ("fallen_tree", "parks"),
]
_STATUSES = ["received", "triaged", "assigned", "in_progress", "resolved", "closed"]
_PICKUP_STATUSES = ["requested", "accepted", "weighed", "completed"]
_DISTRICT = "مدينة نصر أول"
POPULAR_INCIDENT_ID = "INC-90000"
POPULAR_FOLLOWERS = 25


def add_bulk(
    db: Session,
    *,
    incidents: int = 700,
    citizens: int = 400,
    bins: int = 60,
    readings_per_bin: int = 336,
    pickups: int = 300,
    collectors: int = 20,
    seed: int = 7,
) -> None:
    """Add deterministic synthetic rows on top of the base seed. Flushes, never commits."""
    rnd = random.Random(seed)
    now = now_utc()
    naive_now = now.replace(tzinfo=None)
    citizens = max(citizens, collectors + 1, 30)

    for u in range(citizens):
        db.add(Profile(id=f"BENCH-C{u}", phone=None, name=f"مواطن تجريبي {u}", role="citizen"))
    db.flush()

    followers_by_incident: dict[str, set[str]] = {}
    for n in range(incidents):
        cat, dept = rnd.choice(_CATEGORIES)
        created = now - timedelta(hours=rnd.randint(1, 24 * 60))
        status = rnd.choice(_STATUSES)
        iid = f"INC-{90000 + n}"
        n_followers = POPULAR_FOLLOWERS if iid == POPULAR_INCIDENT_ID else rnd.randint(1, 4)
        followers = {f"BENCH-C{rnd.randrange(citizens)}" for _ in range(n_followers)}
        if iid == POPULAR_INCIDENT_ID:
            followers = {f"BENCH-C{k}" for k in range(min(POPULAR_FOLLOWERS, citizens))}
        followers_by_incident[iid] = followers
        db.add(
            Incident(
                id=iid,
                category_id=cat,
                title=f"بلاغ تجريبي {n}",
                severity=rnd.choice(["low", "medium", "high"]),
                status=status,
                department_id=dept,
                estimated_cost_egp=rnd.choice([600, 900, 1200, 2200, 3500, 4500, 6000]),
                lat=30.05 + rnd.random() * 0.05,
                lng=31.33 + rnd.random() * 0.05,
                address=f"شارع تجريبي {n % 40}",
                created_at=created,
                updated_at=created,
                priority_score=rnd.randint(0, 100),
                priority_factors=[{"key": "severity", "label": "الخطورة", "points": 15, "max": 40}] * 4,
                followers_count=len(followers),
            )
        )
    db.flush()
    for n in range(incidents):
        iid = f"INC-{90000 + n}"
        cat = db.get(Incident, iid)
        assert cat is not None
        inc_created = cat.created_at
        for k in range(rnd.randint(1, 3)):
            db.add(
                Report(
                    id=f"FTC-{200000 + n * 3 + k}",
                    reporter_id=f"BENCH-C{rnd.randrange(citizens)}",
                    incident_id=iid,
                    category_id=cat.category_id,
                    description="وصف تجريبي",
                    lat=cat.lat,
                    lng=cat.lng,
                    address=cat.address,
                    created_at=inc_created,
                )
            )
        final = cat.status.value if hasattr(cat.status, "value") else str(cat.status)
        for s in ("received", "triaged", final):
            db.add(
                ActivityLog(
                    entity_type="incident", entity_id=iid, status=s, note="تجريبي", actor="bench", at=inc_created
                )
            )
        for uid in followers_by_incident[iid]:
            db.add(IncidentFollower(incident_id=iid, user_id=uid))
    db.flush()

    # a few work orders and service requests (staff screens)
    for n in range(0, min(incidents, 90), 3):
        inc = db.get(Incident, f"INC-{90000 + n}")
        assert inc is not None
        wo_id = f"WO-{80000 + n}"
        db.add(
            WorkOrder(
                id=wo_id,
                incident_id=inc.id,
                department_id=inc.department_id,
                team="فريق تجريبي",
                team_size=3,
                status=rnd.choice(["open", "assigned", "in_progress", "done"]),
                estimated_cost_egp=inc.estimated_cost_egp,
                tasks=[{"label": "معاينة", "done": False}],
            )
        )
        inc.work_order_id = wo_id
    for n in range(min(citizens, 25)):
        db.add(
            ServiceRequest(
                id=f"SRV-{80000 + n}",
                citizen_id=f"BENCH-C{n}",
                service_type=rnd.choice(["bulky_waste", "tree_maintenance"]),
                details={"items": ["كنب قديم"], "day": "2026-11-01", "slot": "morning", "payment": "cash"},
                lat=30.06 + rnd.random() * 0.02,
                lng=31.34,
                address="شارع تجريبي",
                status=rnd.choice(["received", "assigned", "in_progress", "resolved"]),
            )
        )
    db.flush()

    for b in range(bins):
        bid = f"BIN-BENCH-{b}"
        db.add(
            SmartBin(
                id=bid,
                name=f"حاوية تجريبية {b}",
                district=_DISTRICT,
                lat=30.05 + rnd.random() * 0.05,
                lng=31.33 + rnd.random() * 0.05,
                device_key_hash="0" * 64,
                interval_min=30,
                last_seq=readings_per_bin,
                fill_pct=50,
                last_seen_at=naive_now,
                is_simulated=True,
            )
        )
    db.flush()
    for b in range(bins):
        bid = f"BIN-BENCH-{b}"
        offset = rnd.randrange(100)
        for s in range(1, readings_per_bin + 1):
            t = naive_now - timedelta(minutes=30 * (readings_per_bin - s))
            db.add(
                BinReading(
                    bin_id=bid,
                    seq=s,
                    recorded_at=t,
                    received_at=t,
                    device_at=t,
                    clock_unsynced=False,
                    fill_pct=float(min(100, (s + offset) % 100)),
                    is_full=False,
                    is_hot=False,
                )
            )
    db.flush()

    for k in range(collectors):
        db.add(
            Collector(
                id=f"COL-BENCH-{k}",
                profile_id=f"BENCH-C{k}",
                name=f"جامع تجريبي {k}",
                district=_DISTRICT,
                status="verified",
                materials=["plastic", "paper"],
            )
        )
    db.flush()
    for p in range(pickups):
        status = rnd.choice(_PICKUP_STATUSES)
        pid = f"RCY-BENCH-{p}"
        col = f"COL-BENCH-{p % collectors}" if collectors else None
        done = status in ("weighed", "completed")
        db.add(
            RecyclingPickup(
                id=pid,
                citizen_id=f"BENCH-C{collectors + p % (citizens - collectors)}",
                items=[{"materialId": "plastic", "estimatedKg": 3}],
                lat=30.06 + rnd.random() * 0.02,
                lng=31.34 + rnd.random() * 0.02,
                address="شارع تجريبي",
                district=_DISTRICT,
                day="2026-11-01",
                slot="morning",
                mode="free",
                status=status,
                collector_id=None if status == "requested" else col,
                collector_finished_at=now if done else None,
            )
        )
        if done:
            db.flush()
            db.add(
                Weighing(
                    id=f"WGH-BENCH-{p}",
                    pickup_id=pid,
                    collector_id=col,
                    material_id="plastic",
                    kg=3,
                    source="manual",
                    client_id=f"bench-{p}",
                    value_egp=10,
                )
            )
    db.flush()
