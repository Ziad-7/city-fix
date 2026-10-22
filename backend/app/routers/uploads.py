"""Proposed contract; register explicitly after client-owner agreement."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.citizen import Citizen, only_citizen
from app.media import MediaStorage, get_media, require_media
from app.schemas.uploads import UploadRequest, UploadResponse

router = APIRouter(prefix="/uploads", tags=["uploads (proposed)"])


@router.post("/sign", response_model=UploadResponse)
def sign(
    body: UploadRequest,
    user: Citizen,
    storage: Annotated[MediaStorage | None, Depends(get_media)],
) -> UploadResponse:
    only_citizen(user)
    url, path = require_media(storage).sign_upload(
        user.id, body.kind, body.content_type
    )
    return UploadResponse.model_validate({"uploadUrl": url, "path": path})
