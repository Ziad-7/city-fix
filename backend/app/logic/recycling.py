"""CityCycle domain helpers: price list, pickup views, pin privacy, impact and earnings.

Weighings are the source of truth for kg and EGP. Prices come only from ``material_prices``.
"""

import re
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.helpers import iso_z, now_utc
from app.logic.serialize import clean, timeline_entry
from app.media import MediaStorage, signed_reads
from app.models import ActivityLog, Collector, MaterialPriceRow, RecyclingPickup, Weighing
from app.recycling_schemas import MATERIAL_IDS

DEFAULT_DISTRICT = "مدينة نصر أول"
ENTITY = "recycling_pickup"
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


# --------------------------------------------------------------------------- prices
def resolve_district(db: Session, name: str | None) -> str:
    """Map a profile/app district label to the price-list district (exact, then containment)."""
    name = (name or "").strip() or DEFAULT_DISTRICT
    known = [d for (d,) in db.query(MaterialPriceRow.district).distinct().all()]
    if name in known:
        return name
    for candidate in known:
        if candidate in name or name in candidate:
            return candidate
    return name


def price_map(db: Session, district: str) -> dict[str, float | None]:
    rows = db.query(MaterialPriceRow).filter(MaterialPriceRow.district == district).all()
    return {r.material_id: r.price_egp_per_kg for r in rows}


def material_prices(db: Session, district: str) -> list[dict]:
    """One row per material; ``priceEgpPerKg`` is null where the district has not set a price."""
    rows = {r.material_id: r for r in db.query(MaterialPriceRow).filter(MaterialPriceRow.district == district).all()}
    out = []
    for material_id in MATERIAL_IDS:
        row = rows.get(material_id)
        out.append(
            {
                "materialId": material_id,
                "district": district,
                "priceEgpPerKg": row.price_egp_per_kg if row else None,
                "updatedAt": iso_z(row.updated_at) if row else iso_z(now_utc()),
            }
        )
    return out


def estimate_value(items: list[dict], prices: dict[str, float | None]) -> float | None:
    total, priced = 0.0, False
    for item in items:
        price = prices.get(item["materialId"])
        if price is not None:
            total += price * item["estimatedKg"]
            priced = True
    return round(total, 2) if priced else None


# --------------------------------------------------------------------------- privacy
def first_name(name: str | None) -> str | None:
    parts = (name or "").split()
    return parts[0] if parts else None


def street_level(address: str) -> str:
    """Drop the building number from an address (``12 شارع X`` / ``١٢ شارع X`` / ``شارع X 12``)."""
    text = address.translate(_ARABIC_DIGITS)
    text = re.sub(r"(?i)\b(?:building|bldg|no\.?|عمارة|عقار|رقم|برج)\s*\d+[A-Za-z]?\b", "", text)
    text = re.sub(r"(?<![\w])\d+[A-Za-z]?(?![\w])", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\s*([،,])\s*(?:[،,]\s*)*", r"\1 ", text).strip(" ،,")
    return text.strip()


def approx(value: float) -> float:
    """Round a coordinate to 3 decimals (about 100 m)."""
    return round(value, 3)


# --------------------------------------------------------------------------- views
def weighing_view(w: Weighing) -> dict:
    # price and value are explicit nulls in the contract (not omitted) when the district had no price
    return {
        "id": w.id,
        "pickupId": w.pickup_id,
        "materialId": w.material_id,
        "kg": w.kg,
        "source": w.source,
        **({"scaleId": w.scale_id} if w.scale_id else {}),
        "priceEgpPerKg": w.price_egp_per_kg,
        "valueEgp": w.value_egp,
        "clientId": w.client_id,
        "at": iso_z(w.at),
    }


def totals(weighings: list[Weighing]) -> tuple[float | None, float | None]:
    if not weighings:
        return None, None
    kg = round(sum(w.kg for w in weighings), 3)
    valued = [w.value_egp for w in weighings if w.value_egp is not None]
    return kg, (round(sum(valued), 2) if valued else None)


def pickup_timelines(db: Session, ids: list[str]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {i: [] for i in ids}
    if not ids:
        return out
    rows = (
        db.query(ActivityLog)
        .filter(ActivityLog.entity_type == ENTITY, ActivityLog.entity_id.in_(ids))
        .order_by(ActivityLog.at.asc(), ActivityLog.id.asc())
        .all()
    )
    for a in rows:
        out[a.entity_id].append(timeline_entry(a))
    return out


def log(db: Session, pickup_id: str, status: str, actor: str, note: str) -> None:
    db.add(
        ActivityLog(
            entity_type=ENTITY,
            entity_id=pickup_id,
            status=status,
            note=note,
            actor=actor,
            kind="status_change",
            at=now_utc(),
        )
    )
    db.flush()


def pickup_view(
    db: Session,
    p: RecyclingPickup,
    *,
    viewer: str,
    storage: MediaStorage | None = None,
    collectors: dict[str, Collector] | None = None,
    weighings: list[Weighing] | None = None,
    timeline: list[dict] | None = None,
) -> dict:
    """Contract ``RecyclingPickup``. ``viewer``: ``citizen`` (owner), ``collector`` (accepted job) or ``admin``."""
    if collectors is None:
        collectors = {c.id: c for c in db.query(Collector).filter(Collector.id == p.collector_id).all()}
    if weighings is None:
        weighings = (
            db.query(Weighing).filter(Weighing.pickup_id == p.id).order_by(Weighing.at.asc(), Weighing.id.asc()).all()
        )
    if timeline is None:
        timeline = pickup_timelines(db, [p.id])[p.id]
    collector = collectors.get(p.collector_id) if p.collector_id else None
    total_kg, total_value = totals(weighings)
    photos = list(p.photo_paths or [])
    if viewer in {"citizen", "admin"} and storage is not None:
        photos = signed_reads(storage, p.citizen_id, photos)
    elif viewer == "collector":
        photos = []  # owner-scoped media is not shared with collectors
    view = {
        "id": p.id,
        "citizenId": p.citizen_id,
        "items": p.items,
        "photoUris": photos,
        "location": clean({"lat": p.lat, "lng": p.lng, "address": p.address, "landmark": p.landmark}),
        "day": p.day,
        "slot": p.slot,
        "mode": p.mode,
        "estimatedValueEgp": p.estimated_value_egp,
        "status": p.status,
        "collectorId": p.collector_id,
        "collectorName": first_name(collector.name) if collector else None,
        "weighings": [weighing_view(w) for w in weighings],
        "totalKg": total_kg,
        "totalValueEgp": total_value,
        "paidToHouseholdEgp": p.paid_to_household_egp,
        "collectorFinishedAt": iso_z(p.collector_finished_at) if p.collector_finished_at else None,
        "confirmedAt": iso_z(p.confirmed_at) if p.confirmed_at else None,
        "note": p.note,
        "timeline": timeline,
        "createdAt": iso_z(p.created_at),
    }
    if viewer == "collector":
        view.pop("citizenId")  # never reveals who the household is
        view["citizenId"] = ""
    return clean(view)


def pickup_views(
    db: Session, rows: list[RecyclingPickup], *, viewer: str, storage: MediaStorage | None = None
) -> list[dict]:
    """Bulk version: three queries regardless of the number of rows."""
    ids = [p.id for p in rows]
    collectors = {c.id: c for c in db.query(Collector).all()}
    by_pickup: dict[str, list[Weighing]] = {i: [] for i in ids}
    if ids:
        for w in db.query(Weighing).filter(Weighing.pickup_id.in_(ids)).order_by(Weighing.at.asc(), Weighing.id.asc()):
            by_pickup[w.pickup_id].append(w)
    timelines = pickup_timelines(db, ids)
    return [
        pickup_view(
            db,
            p,
            viewer=viewer,
            storage=storage,
            collectors=collectors,
            weighings=by_pickup[p.id],
            timeline=timelines[p.id],
        )
        for p in rows
    ]


def collector_view(c: Collector) -> dict:
    return clean(
        {
            "id": c.id,
            "name": c.name,
            "district": c.district,
            "status": c.status,
            "materials": list(c.materials or []),
            "vehicle": c.vehicle,
            "joinedAt": iso_z(c.joined_at),
        }
    )


# --------------------------------------------------------------------------- impact and earnings
def by_material(weighings: list[Weighing], with_value: bool = False) -> list[dict]:
    kg: dict[str, float] = {}
    value: dict[str, float] = {}
    for w in weighings:
        kg[w.material_id] = kg.get(w.material_id, 0.0) + w.kg
        value[w.material_id] = value.get(w.material_id, 0.0) + (w.value_egp or 0.0)
    out = []
    for m in MATERIAL_IDS:
        if m in kg:
            row = {"materialId": m, "kg": round(kg[m], 3)}
            if with_value:
                row["valueEgp"] = round(value[m], 2)
            out.append(row)
    return out


def parse_bound(value: str | None, *, end: bool) -> datetime | None:
    """``YYYY-MM-DD`` or ISO datetime -> naive UTC. A bare date's end bound covers the whole day."""
    if not value:
        return None
    try:
        if len(value) == 10:
            d = datetime.fromisoformat(value)
            return d + timedelta(days=1) - timedelta(microseconds=1) if end else d
        d = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.astimezone(UTC).replace(tzinfo=None) if d.tzinfo else d
