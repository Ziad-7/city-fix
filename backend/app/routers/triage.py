"""POST /triage: keyword classifier + duplicates / already-reported from the database."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.logic.duplicates import duplicate_match, find_nearby
from app.logic.triage import triage_text
from app.models import Category, Department, IncidentFollower, Report
from app.schemas import TriageInput

router = APIRouter(tags=["triage"])


@router.post("/triage")
def post_triage(body: TriageInput, payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """TriageSuggestion. Duplicates: open, same category, within 250 m, excluding incidents the caller
    follows; incidents the caller reported themselves go to ``alreadyReported`` with their report id."""
    departments = {d.id: d.name_ar for d in db.query(Department).all()}
    categories = db.query(Category).all()
    out = triage_text(body.description, categories, departments, body.category_id)
    duplicates: list[dict] = []
    already: list[dict] = []

    if body.location is not None:
        # Search every category the citizen might end up submitting: the top 3 plus their own pick.
        searched = {o["categoryId"] for o in out["options"]}
        if body.category_id:
            searched.add(body.category_id)
        user_id = payload["sub"]
        own_report: dict[str, str] = {}
        for r in db.query(Report).filter(Report.reporter_id == user_id).order_by(Report.created_at, Report.id):
            own_report[r.incident_id] = r.id  # latest report wins
        following = {f.incident_id for f in db.query(IncidentFollower).filter_by(user_id=user_id)}
        for inc, distance in find_nearby(db, body.location.lat, body.location.lng, searched):
            match = duplicate_match(inc, distance)
            if inc.id in own_report:
                already.append(
                    {
                        "incidentId": inc.id,
                        "reportId": own_report[inc.id],
                        "title": inc.title,
                        "categoryId": inc.category_id,
                        "distanceM": match["distanceM"],
                    }
                )
            elif inc.id not in following:
                duplicates.append(match)

    out["duplicates"] = duplicates
    out["alreadyReported"] = already
    return out
