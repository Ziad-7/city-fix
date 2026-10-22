from fastapi import APIRouter, HTTPException

from app.citizen import Citizen, Repository, only_citizen
from app.schemas.citizen import Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[Incident], response_model_exclude_none=True)
def list_incidents(user: Citizen, repo: Repository) -> list[Incident]:
    return repo.list_incidents(user.id)


@router.get("/{incident_id}", response_model=Incident, response_model_exclude_none=True)
def get_incident(incident_id: str, user: Citizen, repo: Repository) -> Incident:
    result = repo.get_incident(incident_id, user.id)
    if result is None:
        raise HTTPException(404, "مش لاقيين المشكلة دي.")
    return result


@router.post(
    "/{incident_id}/follow", response_model=Incident, response_model_exclude_none=True
)
def follow(incident_id: str, user: Citizen, repo: Repository) -> Incident:
    only_citizen(user)
    return repo.follow_incident(incident_id, user.id)
