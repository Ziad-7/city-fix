"""Citizen reports: POST/GET /reports, GET /reports/{id}."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.helpers import now_utc
from app.logic.domain import create_report
from app.logic.serialize import incident_public, load_ctx, report_view
from app.logic.triage import triage_text
from app.models import AISuggestion, Category, Department, Incident, Report
from app.schemas import NewReportInput

router = APIRouter(tags=["reports"])

MIN_DESCRIPTION = 10


def _next_suggestion_id(db: Session) -> str:
    highest = 0
    for (sid,) in db.query(AISuggestion.id).filter(AISuggestion.id.like("AS-%")).all():
        try:
            highest = max(highest, int(sid[3:]))
        except ValueError:
            continue
    return f"AS-{highest + 1:04d}"


@router.post("/reports")
def post_report(body: NewReportInput, payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """Create a report; with ``linkToIncidentId`` attach to that incident (reporter becomes a follower)."""
    if not body.photo_uris and len(body.description.strip()) < MIN_DESCRIPTION:
        raise HTTPException(status_code=400, detail="اكتب وصف أو صوّر المشكلة")
    category = db.get(Category, body.category_id)
    link_to = None
    if body.link_to_incident_id:
        link_to = db.get(Incident, body.link_to_incident_id)
        if not link_to:
            raise HTTPException(status_code=404, detail="مش موجود")

    user_id = payload["sub"]
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
    db.commit()
    ctx = load_ctx(db, [incident], user_id)
    return {"report": report_view(report), "incident": incident_public(ctx, incident)}


@router.get("/reports")
def list_my_reports(payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """The caller's own reports, newest first."""
    rows = (
        db.query(Report)
        .filter(Report.reporter_id == payload["sub"])
        .order_by(Report.created_at.desc(), Report.id.desc())
        .all()
    )
    return [report_view(r) for r in rows]


@router.get("/reports/{report_id}")
def get_report(report_id: str, payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """404 if missing, 403 if not the caller's (admins can read all)."""
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="مش موجود")
    if report.reporter_id != payload["sub"] and payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="مش مسموح")
    return report_view(report)
