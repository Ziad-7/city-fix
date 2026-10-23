"""Demo data for CityCycle: DEMO price list, open pickups, a verified collector, smart bins.

The prices are demo values only; real prices are set per district through ``PUT /admin/material-prices``.
Two materials are left without a price on purpose so the "price to be set" path is visible.
"""

import hashlib
import secrets
from datetime import timedelta

from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.logic.recycling import DEFAULT_DISTRICT, estimate_value, log
from app.models import (
    BinReading,
    Collector,
    MaterialPriceRow,
    Profile,
    RecyclingPickup,
    SmartBin,
    Weighing,
)
from app.recycling_schemas import MATERIAL_IDS

DEMO_PRICES: dict[str, float | None] = {
    "pet_plastic": 5,
    "paper_cardboard": 3,
    "metal_cans": 12,
    "glass": 1,
    "e_waste": None,
    "cooking_oil": 10,
    "organics": None,
}
COLLECTOR_PHONE = "+201022223333"

_HOUSEHOLDS = [
    (
        1,
        3,
        [("pet_plastic", 4), ("paper_cardboard", 6)],
        "paid",
        "morning",
        "شارع عباس العقاد، مدينة نصر",
        "جنب صيدلية السلام",
        30.0562,
        31.3305,
    ),
    (2, 6, [("metal_cans", 3), ("glass", 5)], "paid", "afternoon", "شارع مكرم عبيد، مدينة نصر", None, 30.054, 31.3335),
    (3, 9, [("cooking_oil", 6)], "free", "morning", "شارع الطيران، مدينة نصر", "قدام مدرسة الطيران", 30.059, 31.335),
    (4, 20, [("e_waste", 2), ("organics", 3)], "free", "afternoon", "شارع الحجاز، مدينة نصر", None, 30.052, 31.327),
]

# id, name, lat, lng, fill, temp, battery, minutes since last seen (None = never)
_BINS = [
    ("BIN-011", "صندوق شارع عباس العقاد", 30.0568, 31.3312, 34, 29, 3.9, 10),
    ("BIN-012", "صندوق شارع الطيران", 30.0585, 31.3342, 94, 31, 3.8, 20),
    ("BIN-013", "صندوق شارع مكرم عبيد", 30.0545, 31.3328, 61, 63, 3.7, 5),
    ("BIN-014", "صندوق شارع الحجاز", 30.0522, 31.3282, 48, 30, 3.2, 30),
    ("BIN-015", "صندوق شارع الثورة", 30.0608, 31.3318, None, None, None, None),
    ("BIN-016", "صندوق شارع يوسف عباس", 30.0551, 31.3376, 22, 28, 4.0, 15),
    ("HUB-001", "نقطة تجميع الحي", 30.0558, 31.3295, 55, 30, 4.1, 25),
]


# Synthetic readings so the forecast demo has history: fills (oldest first) one hour apart, the last equal to the
# bin's current fill and recorded at its last-seen time. The forecast needs 3+ clock-synced readings over 1+ hour.
_BIN_HISTORY = {
    "BIN-012": [70, 78, 86, 94],
    "BIN-014": [30, 36, 42, 48],
}


def seed_citycycle(db: Session) -> None:
    now = now_utc()
    for material_id in MATERIAL_IDS:
        db.add(
            MaterialPriceRow(
                district=DEFAULT_DISTRICT,
                material_id=material_id,
                price_egp_per_kg=DEMO_PRICES[material_id],
                updated_at=now - timedelta(days=1),
            )
        )

    day = (now + timedelta(days=2)).date().isoformat()
    for n, hours, items, mode, slot, address, landmark, lat, lng in _HOUSEHOLDS:
        db.add(Profile(id=f"seed-household-{n}", role="citizen"))
        db.flush()
        created = now - timedelta(hours=hours)
        item_rows = [{"materialId": m, "estimatedKg": kg} for m, kg in items]
        pickup = RecyclingPickup(
            id=f"RCY-{3000 + n}",
            citizen_id=f"seed-household-{n}",
            items=item_rows,
            photo_paths=[],
            lat=lat,
            lng=lng,
            address=address,
            landmark=landmark,
            district=DEFAULT_DISTRICT,
            day=day,
            slot=slot,
            mode=mode,
            estimated_value_egp=estimate_value(item_rows, DEMO_PRICES),
            status="requested",
            created_at=created,
        )
        db.add(pickup)
        db.flush()
        log(db, pickup.id, "requested", "سيتي سايكل", "طلبك وصل وبندوّر على جامع قريب")

    collector_profile = Profile(
        id="collector-001", phone=COLLECTOR_PHONE, name="كريم السيد", role="citizen", district=DEFAULT_DISTRICT
    )
    db.add(collector_profile)
    db.flush()
    verified = Collector(
        id="COL-1",
        profile_id="collector-001",
        name="كريم السيد",
        district=DEFAULT_DISTRICT,
        status="verified",
        materials=["pet_plastic", "paper_cardboard", "metal_cans", "glass"],
        vehicle="تروسيكل",
        joined_at=now - timedelta(days=30),
    )
    pending_profile = Profile(id="collector-002", phone="+201033334444", name="منى علي", role="citizen")
    db.add(pending_profile)
    db.flush()
    pending = Collector(
        id="COL-2",
        profile_id="collector-002",
        name="منى علي",
        district=DEFAULT_DISTRICT,
        status="pending",
        materials=["cooking_oil"],
        joined_at=now - timedelta(days=1),
    )
    db.add_all([verified, pending])
    db.flush()

    # One finished pickup for the demo citizen so /me/impact and the collector's earnings are not empty.
    done = RecyclingPickup(
        id="RCY-3100",
        citizen_id="citizen-001",
        items=[{"materialId": "pet_plastic", "estimatedKg": 5}, {"materialId": "paper_cardboard", "estimatedKg": 8}],
        photo_paths=[],
        lat=30.0575,
        lng=31.3320,
        address="شارع عباس العقاد، مدينة نصر",
        district=DEFAULT_DISTRICT,
        day=(now - timedelta(days=5)).date().isoformat(),
        slot="morning",
        mode="paid",
        estimated_value_egp=49.0,
        status="completed",
        collector_id="COL-1",
        accepted_at=now - timedelta(days=6),
        paid_to_household_egp=48.0,
        collector_finished_at=now - timedelta(days=5),
        confirmed_at=now - timedelta(days=5),
        created_at=now - timedelta(days=7),
    )
    db.add(done)
    db.flush()
    for i, (material, kg) in enumerate((("pet_plastic", 5.5), ("paper_cardboard", 8.0)), start=1):
        price = DEMO_PRICES[material]
        db.add(
            Weighing(
                id=f"WGH-{i}",
                pickup_id="RCY-3100",
                collector_id="COL-1",
                material_id=material,
                kg=kg,
                source="manual",
                price_egp_per_kg=price,
                value_egp=round(price * kg, 2) if price is not None else None,
                client_id=f"seed-{i}",
                at=now - timedelta(days=5),
            )
        )
    log(db, "RCY-3100", "requested", "سيتي سايكل", "طلبك وصل وبندوّر على جامع قريب")
    log(db, "RCY-3100", "accepted", "كريم", "الجامع قبل طلبك وجاي لك")
    log(db, "RCY-3100", "weighed", "كريم", "الجامع خلّص، ومستني تأكيدك للوزن")
    log(db, "RCY-3100", "completed", "مواطن", "اتأكد الوزن، شكرًا إنك بتدوّر")

    for bin_id, name, lat, lng, fill, temp, battery, minutes in _BINS:
        seen = now - timedelta(minutes=minutes) if minutes is not None else None
        # Nobody holds these demo bins' device keys; admins rotate one with PATCH /admin/bins/{id}.
        db.add(
            SmartBin(
                id=bin_id,
                name=name,
                district="مدينة نصر أول",
                department_id="sanitation",
                lat=lat,
                lng=lng,
                device_key_hash=hashlib.sha256(secrets.token_bytes(32)).hexdigest(),
                is_simulated=True,
                last_seq=len(_BIN_HISTORY.get(bin_id, [fill])) if seen else 0,
                fill_pct=fill,
                temp_c=temp,
                battery_v=battery,
                is_full=bool(fill is not None and fill >= 80),
                is_hot=bool(temp is not None and temp >= 60),
                last_seen_at=seen,
            )
        )
        if seen:
            history = _BIN_HISTORY.get(bin_id)
            for seq, past_fill in enumerate(history or [fill], start=1):
                at = seen - timedelta(hours=len(history) - seq) if history else seen
                db.add(
                    BinReading(
                        bin_id=bin_id,
                        seq=seq,
                        recorded_at=at,
                        received_at=at,
                        clock_unsynced=False if history else None,
                        fill_pct=past_fill,
                        temp_c=temp,
                        battery_v=battery,
                        is_full=bool(past_fill >= 80),
                        is_hot=bool(temp >= 60),
                    )
                )
    db.commit()
