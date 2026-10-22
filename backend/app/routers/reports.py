from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.citizen import Citizen, Repository, check_owner, only_citizen
from app.media import MediaStorage, get_media, report_for_reader, validate_media
from app.schemas.citizen import NewReport, Report, ReportResult

router = APIRouter(prefix="/reports", tags=["reports"])
Storage = Annotated[MediaStorage | None, Depends(get_media)]


@router.post("", response_model=ReportResult, response_model_exclude_none=True)
def create_report(
    body: NewReport, user: Citizen, repo: Repository, storage: Storage
) -> ReportResult:
    only_citizen(user)
    validate_media(user, body.photo_uris, body.voice_note_uri, storage)
    result = repo.create_report(user.id, body)
    return result.model_copy(
        update={"report": report_for_reader(result.report, user, storage)}
    )


@router.get("", response_model=list[Report], response_model_exclude_none=True)
def list_reports(user: Citizen, repo: Repository, storage: Storage) -> list[Report]:
    return [
        report_for_reader(r, user, storage)
        for r in repo.list_reports(user.id)
        if r.reporter_id == user.id
    ]


@router.get("/{report_id}", response_model=Report, response_model_exclude_none=True)
def get_report(
    report_id: str, user: Citizen, repo: Repository, storage: Storage
) -> Report:
    report = repo.get_report(report_id)
    if report is None:
        raise HTTPException(404, "مش لاقيين البلاغ ده.")
    check_owner(report.reporter_id, user)
    return report_for_reader(report, user, storage)
