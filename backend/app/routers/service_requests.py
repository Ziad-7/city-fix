from datetime import date, datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException

from app.citizen import Citizen, Repository, check_owner, only_citizen
from app.schemas.citizen import NewServiceRequest, ServiceRequest

router = APIRouter(prefix="/service-requests", tags=["services"])


def check_booking_day(day: str) -> None:
    requested = date.fromisoformat(day)
    today = datetime.now(ZoneInfo("Africa/Cairo")).date()
    if requested <= today:
        raise HTTPException(422, "اختار يوم جاي.")
    # Match the mobile app's Sunday–Thursday service calendar.
    if requested.weekday() in (4, 5):
        raise HTTPException(422, "الخدمة متاحة من الأحد للخميس.")


@router.post("", response_model=ServiceRequest, response_model_exclude_none=True)
def create_request(
    body: NewServiceRequest, user: Citizen, repo: Repository
) -> ServiceRequest:
    only_citizen(user)
    if body.service_type == "bulky_waste":
        check_booking_day(body.details.day)
    return repo.create_service_request(user.id, body)


@router.get("", response_model=list[ServiceRequest], response_model_exclude_none=True)
def list_requests(user: Citizen, repo: Repository) -> list[ServiceRequest]:
    return [r for r in repo.list_service_requests(user.id) if r.citizen_id == user.id]


@router.get(
    "/{request_id}", response_model=ServiceRequest, response_model_exclude_none=True
)
def get_request(request_id: str, user: Citizen, repo: Repository) -> ServiceRequest:
    result = repo.get_service_request(request_id)
    if result is None:
        raise HTTPException(404, "مش لاقيين الطلب ده.")
    check_owner(result.citizen_id, user)
    return result
