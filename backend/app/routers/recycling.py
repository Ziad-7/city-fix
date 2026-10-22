"""CityCycle: citizen recycling pickups, collector apply/jobs/weighings, impact (contract: "CityCycle")."""

from datetime import datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.admin_auth import current_claims
from app.db import get_db
from app.helpers import iso_z, now_utc
from app.logic.duplicates import haversine_m
from app.logic.ids import next_id
from app.logic.recycling import (
    approx,
    by_material,
    collector_view,
    estimate_value,
    first_name,
    log,
    material_prices,
    parse_bound,
    pickup_view,
    pickup_views,
    price_map,
    resolve_district,
    street_level,
    weighing_view,
)
from app.media import MediaStorage, get_media, validate_media
from app.models import Collector, Profile, RecyclingPickup, Weighing
from app.recycling_schemas import (
    CancelPickupInput,
    CollectorApplyInput,
    CompleteInput,
    MaterialId,
    NewRecyclingPickupInput,
    WeighingInput,
)

router = APIRouter(tags=["recycling"])

NOT_FOUND = "مش موجود"
FORBIDDEN = "مش مسموح"
Claims = Annotated[dict, Depends(current_claims)]
Storage = Annotated[MediaStorage | None, Depends(get_media)]


# --------------------------------------------------------------------------- citizen
@router.get("/recycling/materials")
def list_materials(claims: Claims, district: str | None = None, db: Session = Depends(get_db)):
    """The district price list: one row per material, ``priceEgpPerKg`` null where no price is set."""
    return material_prices(db, resolve_district(db, district))


@router.post("/recycling/pickups")
def create_pickup(body: NewRecyclingPickupInput, storage: Storage, claims: Claims, db: Session = Depends(get_db)):
    if body.day < datetime.now(ZoneInfo("Africa/Cairo")).date().isoformat():
        raise HTTPException(422, "اختار يوم جاي.")
    user_id = claims["sub"]
    validate_media(user_id, body.photo_uris, None, storage)
    profile = db.get(Profile, user_id)
    district = resolve_district(db, profile.district if profile else None)
    items = [{"materialId": i.material_id, "estimatedKg": i.estimated_kg} for i in body.items]
    now = now_utc()
    loc = body.location
    pickup = RecyclingPickup(
        id=next_id(db, "RCY"),
        citizen_id=user_id,
        items=items,
        photo_paths=list(body.photo_uris),
        lat=loc.lat,
        lng=loc.lng,
        address=loc.address,
        landmark=loc.landmark,
        district=district,
        day=body.day,
        slot=body.slot,
        mode=body.mode,
        note=(body.note or "").strip() or None,
        estimated_value_egp=estimate_value(items, price_map(db, district)),
        status="requested",
        created_at=now,
    )
    db.add(pickup)
    db.flush()
    log(db, pickup.id, "requested", "سيتي سايكل", "طلبك وصل وبندوّر على جامع قريب")
    db.commit()
    return pickup_view(db, pickup, viewer="citizen", storage=storage)


@router.get("/recycling/pickups")
def list_my_pickups(storage: Storage, claims: Claims, db: Session = Depends(get_db)):
    rows = (
        db.query(RecyclingPickup)
        .filter(RecyclingPickup.citizen_id == claims["sub"])
        .order_by(RecyclingPickup.created_at.desc(), RecyclingPickup.id.desc())
        .all()
    )
    return pickup_views(db, rows, viewer="citizen", storage=storage)


def _owned(db: Session, pickup_id: str, user_id: str) -> RecyclingPickup:
    pickup = db.get(RecyclingPickup, pickup_id)
    if not pickup:
        raise HTTPException(404, NOT_FOUND)
    if pickup.citizen_id != user_id:
        raise HTTPException(403, FORBIDDEN)
    return pickup


@router.get("/recycling/pickups/{pickup_id}")
def get_pickup(pickup_id: str, storage: Storage, claims: Claims, db: Session = Depends(get_db)):
    return pickup_view(db, _owned(db, pickup_id, claims["sub"]), viewer="citizen", storage=storage)


@router.post("/recycling/pickups/{pickup_id}/cancel")
def cancel_pickup(
    pickup_id: str,
    storage: Storage,
    claims: Claims,
    body: CancelPickupInput | None = None,
    db: Session = Depends(get_db),
):
    pickup = _owned(db, pickup_id, claims["sub"])
    # Atomic: a collector accepting at the same moment must not be overwritten.
    result = db.execute(
        update(RecyclingPickup)
        .where(RecyclingPickup.id == pickup_id, RecyclingPickup.status == "requested")
        .values(status="cancelled")
    )
    if result.rowcount != 1:  # nothing was written, so there is nothing to roll back
        raise HTTPException(409, "مينفعش تلغي الطلب بعد ما الجامع قبله.")
    note = (body.note.strip() if body and body.note else "") or "المواطن لغى الطلب"
    log(db, pickup.id, "cancelled", "مواطن", note)
    db.commit()
    db.refresh(pickup)
    return pickup_view(db, pickup, viewer="citizen", storage=storage)


@router.post("/recycling/pickups/{pickup_id}/confirm")
def confirm_pickup(pickup_id: str, storage: Storage, claims: Claims, db: Session = Depends(get_db)):
    pickup = _owned(db, pickup_id, claims["sub"])
    if pickup.confirmed_at:  # retry-safe
        return pickup_view(db, pickup, viewer="citizen", storage=storage)
    if pickup.status != "weighed" or not pickup.collector_finished_at:
        raise HTTPException(409, "لسه الجامع مخلّصش.")
    pickup.status = "completed"
    pickup.confirmed_at = now_utc()
    log(db, pickup.id, "completed", "مواطن", "اتأكد الوزن، شكرًا إنك بتدوّر")
    db.commit()
    return pickup_view(db, pickup, viewer="citizen", storage=storage)


@router.get("/me/impact")
def my_impact(
    claims: Claims,
    as_: Annotated[Literal["citizen", "collector"], Query(alias="as")] = "citizen",
    db: Session = Depends(get_db),
):
    """Kg diverted from weighings of pickups the caller's household (or collector job) has finished.

    ``co2AvoidedKg`` is intentionally absent until emission factors are verified.
    """
    user_id = claims["sub"]
    if as_ == "collector":
        collector = db.query(Collector).filter_by(profile_id=user_id).first()
        pickups = (
            db.query(RecyclingPickup)
            .filter(RecyclingPickup.collector_id == collector.id, RecyclingPickup.status.in_(("weighed", "completed")))
            .all()
            if collector
            else []
        )
    else:
        pickups = (
            db.query(RecyclingPickup)
            .filter(RecyclingPickup.citizen_id == user_id, RecyclingPickup.status.in_(("weighed", "completed")))
            .all()
        )
    ids = [p.id for p in pickups]
    weighings = db.query(Weighing).filter(Weighing.pickup_id.in_(ids)).all() if ids else []
    out = {
        "totalKg": round(sum(w.kg for w in weighings), 3),
        "byMaterial": by_material(weighings),
        "pickups": len(pickups),
    }
    if as_ == "collector":
        out["earnedEgp"] = round(sum(w.value_egp or 0 for w in weighings), 2)
    return out


# --------------------------------------------------------------------------- collectors
def _my_collector(db: Session, user_id: str) -> Collector | None:
    return db.query(Collector).filter_by(profile_id=user_id).first()


def _verified(db: Session, user_id: str) -> Collector:
    c = _my_collector(db, user_id)
    if c is None:
        raise HTTPException(403, "سجّل كجامع الأول")
    if c.status != "verified":
        raise HTTPException(403, "حسابك لسه متوثقش")
    return c


@router.post("/collectors/apply")
def apply_collector(body: CollectorApplyInput, claims: Claims, db: Session = Depends(get_db)):
    if _my_collector(db, claims["sub"]) is not None:
        raise HTTPException(409, "انت مسجّل كجامع بالفعل.")
    collector = Collector(
        id=next_id(db, "COL"),
        profile_id=claims["sub"],
        name=body.name,
        district=body.district,
        status="pending",
        materials=list(dict.fromkeys(body.materials)),
        vehicle=(body.vehicle or "").strip() or None,
        joined_at=now_utc(),
    )
    db.add(collector)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "انت مسجّل كجامع بالفعل.") from None
    return collector_view(collector)


@router.get("/collectors/me")
def my_collector(claims: Claims, db: Session = Depends(get_db)):
    c = _my_collector(db, claims["sub"])
    if c is None:
        raise HTTPException(404, NOT_FOUND)
    return collector_view(c)


@router.get("/collector/pickups")
def collector_pickups(claims: Claims, db: Session = Depends(get_db)):
    """Jobs this collector accepted (any status), newest first, with the exact pin."""
    c = _verified(db, claims["sub"])
    rows = (
        db.query(RecyclingPickup)
        .filter(RecyclingPickup.collector_id == c.id)
        .order_by(RecyclingPickup.created_at.desc(), RecyclingPickup.id.desc())
        .all()
    )
    return pickup_views(db, rows, viewer="collector")


@router.get("/collector/jobs")
def collector_jobs(
    claims: Claims,
    lat: Annotated[float, Query(ge=-90, le=90)],
    lng: Annotated[float, Query(ge=-180, le=180)],
    radius_m: Annotated[float, Query(alias="radiusM", gt=0, le=50000)],
    material_id: Annotated[MaterialId | None, Query(alias="materialId")] = None,
    db: Session = Depends(get_db),
):
    """Open pickups near a point, nearest first. Street-level address, ~100 m pin, no name or phone."""
    _verified(db, claims["sub"])
    rows = (
        db.query(RecyclingPickup)
        .filter(RecyclingPickup.status == "requested", RecyclingPickup.citizen_id != claims["sub"])
        .all()
    )
    jobs: list[tuple[float, dict]] = []
    for p in rows:
        distance = haversine_m(lat, lng, p.lat, p.lng)
        if distance > radius_m:
            continue
        if material_id and not any(i["materialId"] == material_id for i in p.items):
            continue
        location = {"lat": approx(p.lat), "lng": approx(p.lng), "address": street_level(p.address)}
        if p.landmark:
            location["landmark"] = p.landmark
        job = {
            "id": p.id,
            "items": p.items,
            "location": location,
            "day": p.day,
            "slot": p.slot,
            "mode": p.mode,
            "estimatedKg": round(sum(i["estimatedKg"] for i in p.items), 3),
            "distanceM": round(distance),
        }
        if p.note:
            job["note"] = p.note
        if p.estimated_value_egp is not None:
            job["estimatedValueEgp"] = p.estimated_value_egp
        jobs.append((distance, job))
    jobs.sort(key=lambda t: t[0])
    return [j for _, j in jobs]


def _job(db: Session, job_id: str) -> RecyclingPickup:
    p = db.get(RecyclingPickup, job_id)
    if not p:
        raise HTTPException(404, NOT_FOUND)
    return p


def _mine(db: Session, job_id: str, collector: Collector) -> RecyclingPickup:
    p = _job(db, job_id)
    if p.collector_id != collector.id:
        raise HTTPException(403, FORBIDDEN)
    return p


@router.post("/collector/jobs/{job_id}/accept")
def accept_job(job_id: str, claims: Claims, db: Session = Depends(get_db)):
    collector = _verified(db, claims["sub"])
    pickup = _job(db, job_id)
    if pickup.citizen_id == claims["sub"]:
        raise HTTPException(403, FORBIDDEN)
    if pickup.collector_id == collector.id:  # offline retry
        return pickup_view(db, pickup, viewer="collector")
    now = now_utc()
    # First accept wins: only one UPDATE can match status == requested.
    result = db.execute(
        update(RecyclingPickup)
        .where(
            RecyclingPickup.id == job_id, RecyclingPickup.status == "requested", RecyclingPickup.collector_id.is_(None)
        )
        .values(status="accepted", collector_id=collector.id, accepted_at=now)
    )
    if result.rowcount != 1:  # nothing was written, so there is nothing to roll back
        raise HTTPException(409, "الطلب ده اتاخد أو اتلغى.")
    log(db, job_id, "accepted", first_name(collector.name) or "الجامع", "الجامع قبل طلبك وجاي لك")
    db.commit()
    db.refresh(pickup)
    return pickup_view(db, pickup, viewer="collector")


@router.post("/collector/jobs/{job_id}/weighings")
def add_weighing(job_id: str, body: WeighingInput, response: Response, claims: Claims, db: Session = Depends(get_db)):
    collector = _verified(db, claims["sub"])
    pickup = _mine(db, job_id, collector)
    existing = db.query(Weighing).filter_by(pickup_id=job_id, client_id=body.client_id).first()
    if existing:  # idempotent retry
        return weighing_view(existing)
    if pickup.status not in ("accepted", "weighed") or pickup.collector_finished_at:
        raise HTTPException(409, "مينفعش تضيف وزن للطلب ده.")
    price = price_map(db, pickup.district).get(body.material_id)
    weighing = Weighing(
        id=next_id(db, "WGH"),
        pickup_id=job_id,
        collector_id=collector.id,
        material_id=body.material_id,
        kg=body.kg,
        source=body.source,
        scale_id=body.scale_id,
        price_egp_per_kg=price,
        value_egp=round(price * body.kg, 2) if price is not None else None,
        client_id=body.client_id,
        at=now_utc(),
    )
    db.add(weighing)
    first = pickup.status == "accepted"
    pickup.status = "weighed"
    try:
        db.flush()
    except IntegrityError:  # concurrent retry with the same clientId
        db.rollback()
        again = db.query(Weighing).filter_by(pickup_id=job_id, client_id=body.client_id).first()
        if again:
            return weighing_view(again)
        raise
    if first:
        log(db, job_id, "weighed", first_name(collector.name) or "الجامع", "الجامع بدأ يوزن الخامات")
    db.commit()
    response.status_code = 201
    return weighing_view(weighing)


@router.post("/collector/jobs/{job_id}/complete")
def complete_job(job_id: str, claims: Claims, body: CompleteInput | None = None, db: Session = Depends(get_db)):
    collector = _verified(db, claims["sub"])
    pickup = _mine(db, job_id, collector)
    if pickup.collector_finished_at:  # retry-safe
        return pickup_view(db, pickup, viewer="collector")
    if pickup.status != "weighed" or not db.query(Weighing).filter_by(pickup_id=job_id).first():
        raise HTTPException(409, "لازم تسجّل وزن الأول.")
    paid = body.paid_to_household_egp if body else None
    pickup.collector_finished_at = now_utc()
    pickup.paid_to_household_egp = paid if pickup.mode == "paid" else None
    log(
        db,
        job_id,
        "weighed",
        first_name(collector.name) or "الجامع",
        "الجامع خلّص، ومستني تأكيدك للوزن",
    )
    db.commit()
    return pickup_view(db, pickup, viewer="collector")


@router.get("/collector/earnings")
def collector_earnings(
    claims: Claims,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: str | None = None,
    db: Session = Depends(get_db),
):
    collector = _verified(db, claims["sub"])
    end = parse_bound(to, end=True) or now_utc().replace(tzinfo=None)
    start = parse_bound(from_, end=False)
    if (from_ and start is None) or (to and parse_bound(to, end=True) is None):
        raise HTTPException(422, "البيانات مش مكتملة")
    if start is None:
        start = end - timedelta(days=30)
    weighings = (
        db.query(Weighing).filter(Weighing.collector_id == collector.id, Weighing.at >= start, Weighing.at <= end).all()
    )
    paid = (
        db.query(RecyclingPickup)
        .filter(
            RecyclingPickup.collector_id == collector.id,
            RecyclingPickup.collector_finished_at >= start,
            RecyclingPickup.collector_finished_at <= end,
        )
        .all()
    )
    return {
        "period": {"from": from_ or iso_z(start), "to": to or iso_z(end)},
        "totalKg": round(sum(w.kg for w in weighings), 3),
        "valueEgp": round(sum(w.value_egp or 0 for w in weighings), 2),
        "paidToHouseholdsEgp": round(sum(p.paid_to_household_egp or 0 for p in paid), 2),
        "byMaterial": [
            {"materialId": r["materialId"], "kg": r["kg"], "valueEgp": r["valueEgp"]}
            for r in by_material(weighings, with_value=True)
        ],
        "jobs": len({w.pickup_id for w in weighings}),
    }
