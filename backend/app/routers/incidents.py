"""Citizen incident routes: list, detail, follow, reopen."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.admin_auth import current_claims, is_staff
from app.db import get_db
from app.logic.domain import ensure_follower, staff_department
from app.logic.serialize import incident_view, load_ctx
from app.logic.status import change_incident_status
from app.models import Incident
from app.schemas import ReopenInput

router = APIRouter(tags=["incidents"])


def _get_or_404(db: Session, incident_id: str) -> Incident:
    inc = db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="مش موجود")
    return inc


def _staff_sees_admin_fields(inc: Incident, payload: dict) -> bool:
    """Admins see admin fields everywhere; staff only for their own department (others get the public shape)."""
    if not is_staff(payload):
        return False
    dept = staff_department(payload)
    return dept is None or inc.department_id == dept


def _view(db: Session, inc: Incident, payload: dict) -> dict:
    return incident_view(load_ctx(db, [inc], payload["sub"]), inc, _staff_sees_admin_fields(inc, payload))


@router.get("/incidents")
def list_incidents(payload: dict = Depends(current_claims), db: Session = Depends(get_db)):
    """All incidents, newest first. Public fields only; staff tokens also get the admin fields."""
    incidents = db.query(Incident).order_by(Incident.created_at.desc(), Incident.id.desc()).all()
    ctx = load_ctx(db, incidents, payload["sub"])
    return [incident_view(ctx, i, _staff_sees_admin_fields(i, payload)) for i in incidents]


@router.get("/incidents/{incident_id}")
def get_incident(incident_id: str, payload: dict = Depends(current_claims), db: Session = Depends(get_db)):
    return _view(db, _get_or_404(db, incident_id), payload)


@router.post("/incidents/{incident_id}/follow")
def follow_incident(incident_id: str, payload: dict = Depends(current_claims), db: Session = Depends(get_db)):
    """Follow ("أنا كمان"): idempotent per user, increments ``followers`` once."""
    inc = _get_or_404(db, incident_id)
    if ensure_follower(db, inc.id, payload["sub"]):
        inc.followers_count = (inc.followers_count or 0) + 1
    db.commit()
    return _view(db, inc, payload)


@router.post("/incidents/{incident_id}/reopen")
def reopen_incident(
    incident_id: str,
    body: ReopenInput,
    payload: dict = Depends(current_claims),
    db: Session = Depends(get_db),
):
    """Reopen ("لسه المشكلة موجودة"): reporter/follower only, only from resolved, back to received."""
    inc = _get_or_404(db, incident_id)
    ctx = load_ctx(db, [inc], payload["sub"])
    if inc.id not in ctx.following:
        raise HTTPException(status_code=403, detail="مش مسموح")
    if getattr(inc.status, "value", inc.status) != "resolved":
        raise HTTPException(status_code=409, detail="البلاغ ده لسه مش متحلّ")
    note = body.note.strip() or "لسه المشكلة موجودة"
    change_incident_status(db, inc, "received", note, "مواطن")
    inc.eta = "خلال ٣ أيام"
    db.commit()
    return _view(db, inc, payload)
