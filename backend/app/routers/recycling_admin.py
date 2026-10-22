"""Command Center CityCycle routes: recycling summary, pickups, collectors, price list, payouts."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import exists, update
from sqlalchemy.orm import Session

from app.admin_auth import require_admin, require_staff
from app.db import get_db
from app.helpers import now_utc
from app.logic.domain import actor_name
from app.logic.recycling import (
    by_material,
    collector_view,
    first_name,
    log,
    material_prices,
    parse_bound,
    pickup_view,
    pickup_views,
    resolve_district,
)
from app.models import Collector, MaterialPriceRow, Profile, RecyclingPickup, Weighing
from app.recycling_schemas import CollectorPatchInput, CollectorStatus, PickupAdminPatchInput, PricesPutInput

router = APIRouter(prefix="/admin", tags=["admin-citycycle"])
Staff = Annotated[dict, Depends(require_staff)]
Admin = Annotated[dict, Depends(require_admin)]

PICKUP_STATUSES = ("requested", "accepted", "weighed", "completed", "cancelled")


def _range(from_: str | None, to: str | None):
    start, end = parse_bound(from_, end=False), parse_bound(to, end=True)
    if (from_ and start is None) or (to and end is None):
        raise HTTPException(422, "البيانات مش مكتملة")
    return start, end


@router.get("/recycling/summary")
def recycling_summary(
    claims: Staff,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: str | None = None,
    district: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _range(from_, to)
    q = db.query(Weighing, RecyclingPickup).join(RecyclingPickup, RecyclingPickup.id == Weighing.pickup_id)
    if start:
        q = q.filter(Weighing.at >= start)
    if end:
        q = q.filter(Weighing.at <= end)
    if district:
        q = q.filter(RecyclingPickup.district == resolve_district(db, district))
    rows = q.all()
    weighings = [w for w, _ in rows]
    per_district: dict[str, float] = {}
    for w, p in rows:
        per_district[p.district] = per_district.get(p.district, 0.0) + w.kg
    pq = db.query(RecyclingPickup)
    if start:
        pq = pq.filter(RecyclingPickup.created_at >= start)
    if end:
        pq = pq.filter(RecyclingPickup.created_at <= end)
    if district:
        pq = pq.filter(RecyclingPickup.district == resolve_district(db, district))
    pickups = pq.all()
    waits = [(p.accepted_at - p.created_at).total_seconds() / 60 for p in pickups if p.accepted_at]
    total_kg = sum(w.kg for w in weighings)
    return {
        "totalKg": round(total_kg, 3),
        "tonnes": round(total_kg / 1000, 4),
        "byMaterial": by_material(weighings),
        "byDistrict": [{"district": d, "kg": round(kg, 3)} for d, kg in sorted(per_district.items())],
        "pickups": len(pickups),
        "byStatus": {s: sum(1 for p in pickups if p.status == s) for s in PICKUP_STATUSES},
        "avgResponseMinutes": round(sum(waits) / len(waits), 1) if waits else None,
    }


@router.get("/recycling/pickups")
def admin_pickups(
    claims: Staff,
    status: str | None = None,
    district: str | None = None,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    db: Session = Depends(get_db),
):
    if status and status not in PICKUP_STATUSES:
        raise HTTPException(422, "البيانات مش مكتملة")
    start, end = _range(from_, to)
    q = db.query(RecyclingPickup)
    if status:
        q = q.filter(RecyclingPickup.status == status)
    if district:
        q = q.filter(RecyclingPickup.district == resolve_district(db, district))
    if start:
        q = q.filter(RecyclingPickup.created_at >= start)
    if end:
        q = q.filter(RecyclingPickup.created_at <= end)
    rows = q.order_by(RecyclingPickup.created_at.desc(), RecyclingPickup.id.desc()).limit(limit).all()
    return _with_district(pickup_views(db, rows, viewer="admin"), rows, claims)


def _staff_view(view: dict, p: RecyclingPickup, claims: dict) -> dict:
    """Admins see everything; department staff get the district only (no name, exact address or pin)."""
    view["district"] = p.district
    if claims["role"] != "admin":
        view["location"] = {"address": p.district}
        view["citizenId"] = ""
        view["photoUris"] = []
        view.pop("note", None)
    return view


def _with_district(views: list[dict], rows: list[RecyclingPickup], claims: dict) -> list[dict]:
    return [_staff_view(v, p, claims) for v, p in zip(views, rows, strict=True)]


@router.get("/recycling/pickups/{pickup_id}")
def admin_pickup(pickup_id: str, claims: Staff, db: Session = Depends(get_db)):
    p = db.get(RecyclingPickup, pickup_id)
    if not p:
        raise HTTPException(404, "مش موجود")
    view = _staff_view(pickup_view(db, p, viewer="admin"), p, claims)
    profile = db.get(Profile, p.citizen_id)
    if claims["role"] == "admin" and profile and profile.name:
        view["citizenName"] = profile.name
    return view


@router.patch("/recycling/pickups/{pickup_id}")
def admin_patch_pickup(pickup_id: str, body: PickupAdminPatchInput, claims: Admin, db: Session = Depends(get_db)):
    """Dispatch: ``cancelled`` (while requested/accepted), ``accepted`` + ``collectorId`` (assign a verified
    collector to a requested pickup), or a note-only entry. Anything else is ``409``."""
    p = db.get(RecyclingPickup, pickup_id)
    if not p:
        raise HTTPException(404, "مش موجود")
    actor = actor_name(db, claims)
    note = (body.note or "").strip()
    if body.status is None:
        if body.collector_id or not note:
            raise HTTPException(422, "البيانات مش مكتملة")
        log(db, p.id, p.status, actor, note)
    elif body.status == "cancelled":
        # Conditional UPDATE: loses cleanly against a concurrent weighing or accept.
        result = db.execute(
            update(RecyclingPickup)
            .where(
                RecyclingPickup.id == p.id,
                RecyclingPickup.status.in_(("requested", "accepted")),
                ~exists().where(Weighing.pickup_id == RecyclingPickup.id),
            )
            .values(status="cancelled")
        )
        if result.rowcount != 1:
            raise HTTPException(409, "مينفعش يتلغى في الحالة دي.")
        db.refresh(p)
        log(db, p.id, "cancelled", actor, note or "اتلغى من إدارة الحي")
    elif body.status == "accepted":
        collector = db.get(Collector, body.collector_id) if body.collector_id else None
        if collector is None:
            raise HTTPException(422, "البيانات مش مكتملة")
        if collector.status != "verified":
            raise HTTPException(409, "الجامع مش متوثق.")
        if p.status != "requested" or p.collector_id:
            raise HTTPException(409, "الطلب ده اتاخد أو اتلغى.")
        if collector.profile_id == p.citizen_id:
            raise HTTPException(409, "مينفعش الجامع ياخد طلب بتاعه.")
        p.status = "accepted"
        p.collector_id = collector.id
        p.accepted_at = now_utc()
        log(db, p.id, "accepted", actor, note or f"اتحدد الجامع {first_name(collector.name)}")
    else:
        raise HTTPException(409, "الحالة دي بتتغير من الجامع أو المواطن.")
    db.commit()
    view = pickup_view(db, p, viewer="admin")
    view["district"] = p.district
    return view


@router.get("/collectors")
def admin_collectors(
    claims: Staff, status: CollectorStatus | None = None, district: str | None = None, db: Session = Depends(get_db)
):
    q = db.query(Collector)
    if status:
        q = q.filter(Collector.status == status)
    if district:
        q = q.filter(Collector.district == district)
    out = []
    for c in q.order_by(Collector.joined_at.desc(), Collector.id.desc()).all():
        view = collector_view(c)
        view["userId"] = c.profile_id
        profile = db.get(Profile, c.profile_id)
        if profile and profile.phone:
            view["phone"] = profile.phone
        if c.review_note:
            view["note"] = c.review_note
        out.append(view)
    return out


def _release_jobs(db: Session, c: Collector, claims: dict) -> None:
    """A collector who is no longer verified must not keep jobs: accepted ones go back to the open pool;
    ones already weighed (a household is waiting) stay with a timeline flag for staff to follow up."""
    actor = actor_name(db, claims)
    for p in db.query(RecyclingPickup).filter(RecyclingPickup.collector_id == c.id).all():
        if p.status == "accepted":
            has_weighing = db.query(Weighing.id).filter(Weighing.pickup_id == p.id).first() is not None
            if not has_weighing:
                p.status = "requested"
                p.collector_id = None
                p.accepted_at = None
                log(db, p.id, "requested", actor, "الجامع اتوقف، الطلب رجع للقايمة وبندوّر على جامع تاني")
        elif p.status == "weighed" and not p.collector_finished_at:
            log(db, p.id, "weighed", actor, "الجامع اتوقف قبل ما يخلّص، محتاج متابعة من الإدارة")


@router.patch("/collectors/{collector_id}")
def admin_patch_collector(collector_id: str, body: CollectorPatchInput, claims: Staff, db: Session = Depends(get_db)):
    c = db.get(Collector, collector_id)
    if not c:
        raise HTTPException(404, "مش موجود")
    c.status = body.status
    if body.note is not None:
        c.review_note = body.note
    if c.status != "verified":
        _release_jobs(db, c, claims)
    db.commit()
    return collector_view(c)


@router.get("/material-prices")
def admin_prices(claims: Staff, district: str | None = None, db: Session = Depends(get_db)):
    return material_prices(db, resolve_district(db, district))


@router.put("/material-prices")
def admin_put_prices(body: PricesPutInput, claims: Admin, db: Session = Depends(get_db)):
    """Set (or clear, with null) prices for one district. The price list is owned by the district."""
    now = now_utc()
    for entry in body.prices:
        row = db.get(MaterialPriceRow, (body.district, entry.material_id))
        if row is None:
            row = MaterialPriceRow(district=body.district, material_id=entry.material_id)
            db.add(row)
        row.price_egp_per_kg = entry.price_egp_per_kg
        row.updated_at = now
    db.commit()
    return material_prices(db, body.district)


@router.get("/payouts")
def admin_payouts(
    claims: Staff,
    from_: Annotated[str | None, Query(alias="from")] = None,
    to: str | None = None,
    collector_id: Annotated[str | None, Query(alias="collectorId")] = None,
    db: Session = Depends(get_db),
):
    """Per collector: kg, value at the price list and cash paid to households (recorded, not processed)."""
    start, end = _range(from_, to)
    wq = db.query(Weighing)
    pq = db.query(RecyclingPickup).filter(RecyclingPickup.collector_finished_at.isnot(None))
    if start:
        wq = wq.filter(Weighing.at >= start)
        pq = pq.filter(RecyclingPickup.collector_finished_at >= start)
    if end:
        wq = wq.filter(Weighing.at <= end)
        pq = pq.filter(RecyclingPickup.collector_finished_at <= end)
    if collector_id:
        wq = wq.filter(Weighing.collector_id == collector_id)
        pq = pq.filter(RecyclingPickup.collector_id == collector_id)
    totals: dict[str, dict] = {}

    def slot(cid: str) -> dict:
        return totals.setdefault(
            cid, {"collectorId": cid, "kg": 0.0, "valueEgp": 0.0, "paidToHouseholdsEgp": 0.0, "jobs": set()}
        )

    for w in wq.all():
        s = slot(w.collector_id)
        s["kg"] += w.kg
        s["valueEgp"] += w.value_egp or 0
        s["jobs"].add(w.pickup_id)
    for p in pq.all():
        slot(p.collector_id)["paidToHouseholdsEgp"] += p.paid_to_household_egp or 0
    names = {c.id: c.name for c in db.query(Collector).filter(Collector.id.in_(list(totals))).all()} if totals else {}
    return [
        {
            "collectorId": cid,
            "collectorName": names.get(cid),
            "kg": round(s["kg"], 3),
            "valueEgp": round(s["valueEgp"], 2),
            "paidToHouseholdsEgp": round(s["paidToHouseholdsEgp"], 2),
            "jobs": len(s["jobs"]),
        }
        for cid, s in sorted(totals.items())
    ]
