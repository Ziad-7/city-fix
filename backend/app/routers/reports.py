"""Citizen reports: POST/GET /reports, GET /reports/{id}."""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.admin_auth import current_claims
from app.db import get_db
from app.helpers import now_utc
from app.logic.domain import create_report
from app.logic.duplicates import is_within_radius
from app.logic.idempotency import claim, clean_key
from app.logic.serialize import incident_public, load_ctx, report_view
from app.logic.triage import triage_text
from app.media import MediaStorage, get_media, report_for_reader, validate_media
from app.models import AISuggestion, Category, Department, Incident, Report
from app.schemas import NewReportInput

router = APIRouter(tags=["reports"])

MIN_DESCRIPTION = 10


def is_joinable(incident: Incident, body: NewReportInput) -> bool:
    """Same duplicate rule as triage: open, same category, within 250 m of the new location."""
    status = getattr(incident.status, "value", incident.status)
    if status in ("resolved", "closed") or incident.category_id != body.category_id:
        return False
    return is_within_radius(incident.lat, incident.lng, body.location.lat, body.location.lng)


def _next_suggestion_id(db: Session) -> str:
    highest = 0
    for (sid,) in db.query(AISuggestion.id).filter(AISuggestion.id.like("AS-%")).all():
        try:
            highest = max(highest, int(sid[3:]))
        except ValueError:
            continue
    return f"AS-{highest + 1:04d}"


@router.post("/reports")
def post_report(
    body: NewReportInput,
    storage: Annotated[MediaStorage | None, Depends(get_media)],
    payload: dict = Depends(current_claims),
    db: Session = Depends(get_db),
    idempotency_key: Annotated[str | None, Header()] = None,
):
    """Create a report; with ``linkToIncidentId`` attach to that incident (reporter becomes a follower).

    An optional ``Idempotency-Key`` makes a retry by the same user return the original result.
    """
    key = clean_key(idempotency_key)
    key_row, earlier_id = claim(db, payload["sub"], "report", key)
    earlier = db.get(Report, earlier_id) if earlier_id else None
    if earlier is not None:
        incident = db.get(Incident, earlier.incident_id)
        ctx = load_ctx(db, [incident], payload["sub"])
        return {
            "report": report_for_reader(report_view(earlier), payload["sub"], storage),
            "incident": incident_public(ctx, incident),
        }
    if not body.photo_uris and len(body.description.strip()) < MIN_DESCRIPTION:
        raise HTTPException(status_code=400, detail="اكتب وصف أو صوّر المشكلة")
    category = db.get(Category, body.category_id)
    link_to = None
    if body.link_to_incident_id:
        link_to = db.get(Incident, body.link_to_incident_id)
        if not link_to:
            raise HTTPException(status_code=404, detail="مش موجود")
        if not is_joinable(link_to, body):
            raise HTTPException(status_code=409, detail="البلاغ مش مطابق للمشكلة دي.")

    user_id = payload["sub"]
    validate_media(user_id, body.photo_uris, body.voice_note_uri, storage)
    report, incident = create_report(db, user_id, body, category, link_to)
    if link_to is None:
        # Store the keyword triage so the admin AI card has something to confirm (source: fallback).
        departments = {d.id: d.name_ar for d in db.query(Department).all()}
        suggestion = triage_text(body.description, db.query(Category).all(), departments, body.category_id)
        suggestion.pop("emergency", None)
        db.add(
            AISuggestion(
                id=_next_suggestion_id(db),
                report_id=report.id,
                kind="triage",
                payload={
                    **suggestion,
                    "severity": getattr(incident.severity, "value", incident.severity),
                    "confirmed": False,
                },
                model="keyword-fallback",
                created_at=now_utc(),
            )
        )
    if key_row is not None:
        key_row.resource_id = report.id
    db.commit()
    ctx = load_ctx(db, [incident], user_id)
    return {
        "report": report_for_reader(report_view(report), user_id, storage),
        "incident": incident_public(ctx, incident),
    }


@router.get("/reports")
def list_my_reports(
    storage: Annotated[MediaStorage | None, Depends(get_media)],
    payload: dict = Depends(current_claims),
    db: Session = Depends(get_db),
):
    """The caller's own reports, newest first."""
    rows = (
        db.query(Report)
        .filter(Report.reporter_id == payload["sub"])
        .order_by(Report.created_at.desc(), Report.id.desc())
        .all()
    )
    return [report_for_reader(report_view(r), payload["sub"], storage) for r in rows]


@router.get("/reports/{report_id}")
def get_report(
    report_id: str,
    storage: Annotated[MediaStorage | None, Depends(get_media)],
    payload: dict = Depends(current_claims),
    db: Session = Depends(get_db),
):
    """404 if missing, 403 if not the caller's (admins can read all; an anonymous reporter id stays hidden)."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="مش موجود")
    if report.reporter_id != payload["sub"] and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="مش مسموح")
    return report_for_reader(report_view(report), payload["sub"], storage)
