"""POST /uploads/sign: a signed upload to private storage, or (dev only) a local stub that discards the PUT.

Without configured storage the stub is allowed only when ``settings.local_upload_stub_allowed`` (SQLite/dev by
default, or ``ALLOW_LOCAL_UPLOAD_STUB=true``); otherwise the route answers 503 so uploads never vanish silently.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.admin_auth import current_claims
from app.config import settings
from app.media import MediaStorage, get_media
from app.schemas import UploadSignInput

router = APIRouter(tags=["uploads"])

STORAGE_UNAVAILABLE = "رفع الصور والصوت مش متاح دلوقتي لأن التخزين لسه متظبطش."

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/webm": "webm",
    "audio/3gpp": "3gp",
    "audio/x-caf": "caf",
}


@router.post("/uploads/sign")
def sign_upload(
    body: UploadSignInput,
    request: Request,
    storage: Annotated[MediaStorage | None, Depends(get_media)],
    payload: dict = Depends(current_claims),
):
    """``{ uploadUrl, path }``. Photos need ``image/*``, voice notes ``audio/*``.

    With a configured private storage (``app.state.media_storage``) the URL is a signed upload to an
    owner-scoped random path; otherwise it is the local stub below.
    """
    wanted = "image/" if body.kind == "report_photo" else "audio/"
    if not body.content_type.startswith(wanted):
        raise HTTPException(status_code=400, detail="نوع الملف مش مدعوم")
    if storage is not None:
        url, path = storage.sign_upload(payload["sub"], body.kind, body.content_type)
        return {"uploadUrl": url, "path": path}
    if not settings.local_upload_stub_allowed:
        raise HTTPException(status_code=503, detail=STORAGE_UNAVAILABLE)
    ext = EXTENSIONS.get(body.content_type, body.content_type.split("/", 1)[1].split(";")[0] or "bin")
    folder = "photos" if body.kind == "report_photo" else "voice"
    path = f"{folder}/{payload['sub']}/{uuid.uuid4().hex}.{ext}"
    base = str(request.base_url).rstrip("/")
    return {"uploadUrl": f"{base}/uploads/local/{path}", "path": path}


@router.put("/uploads/local/{path:path}", status_code=204)
async def local_upload(path: str, request: Request) -> Response:
    """Dev stub for the signed URL: reads the body and drops it (404 when the stub is not allowed)."""
    if not settings.local_upload_stub_allowed:
        raise HTTPException(status_code=404, detail="مش موجود")
    await request.body()
    return Response(status_code=204)
