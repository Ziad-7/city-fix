"""Citizen service requests (CityServe): POST/GET /service-requests, GET /service-requests/{id}."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, is_staff
from app.db import get_db
from app.helpers import now_utc
from app.logic.ids import next_id
from app.logic.serialize import service_request_view, service_timelines
from app.logic.timeline import service_timeline_entry
from app.models import ActivityLog, ServiceRequest
from app.schemas import NewServiceRequestInput

router = APIRouter(tags=["service-requests"])


@router.post("/service-requests")
def post_service_request(
    body: NewServiceRequestInput,
    payload: dict = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Book a service. ``details.payment`` is required for bulky_waste and optional (free) for tree_maintenance."""
    if body.service_type == "bulky_waste" and body.details.payment is None:
        raise HTTPException(status_code=422, detail="البيانات مش مكتملة")
    d = body.details
    details = {"items": d.items, "day": d.day, "slot": d.slot}
    for key, value in (
        ("payment", d.payment),
        ("note", d.note),
        ("workType", d.work_type),
        ("photoUris", d.photo_uris),
    ):
        if value is not None:
            details[key] = value

    now = now_utc()
    loc = body.location
    sr = ServiceRequest(
        id=next_id(db, "SRV"),
        citizen_id=payload["sub"],
        service_type=body.service_type,
        details=details,
        lat=loc.lat,
        lng=loc.lng,
        address=loc.address,
        landmark=loc.landmark,
        status="received",
        paid=False,
        created_at=now,
    )
    db.add(sr)
    db.flush()
    entry = service_timeline_entry("received", now)
    db.add(
        ActivityLog(
            entity_type="service_request",
            entity_id=sr.id,
            status="received",
            note=entry["note"],
            actor=entry["actor"],
            kind="status_change",
            at=now,
        )
    )
    db.commit()
    return service_request_view(sr, service_timelines(db, [sr.id]).get(sr.id, []))


@router.get("/service-requests")
def list_my_service_requests(payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """The caller's service requests, newest first."""
    rows = (
        db.query(ServiceRequest)
        .filter(ServiceRequest.citizen_id == payload["sub"])
        .order_by(ServiceRequest.created_at.desc(), ServiceRequest.id.desc())
        .all()
    )
    timelines = service_timelines(db, [r.id for r in rows])
    return [service_request_view(r, timelines.get(r.id, [])) for r in rows]


@router.get("/service-requests/{sr_id}")
def get_service_request(sr_id: str, payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """404 if missing, 403 if it is not the caller's (staff and admins can read all)."""
    sr = db.get(ServiceRequest, sr_id)
    if not sr:
        raise HTTPException(status_code=404, detail="مش موجود")
    if sr.citizen_id != payload["sub"] and not is_staff(payload):
        raise HTTPException(status_code=403, detail="مش مسموح")
    return service_request_view(sr, service_timelines(db, [sr.id]).get(sr.id, []))
