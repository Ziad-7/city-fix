"""Upload stubs: POST /uploads/sign returns a local URL that accepts (and discards) a browser PUT.

Real storage (Supabase signed uploads) replaces this later without changing the contract.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.auth import current_user
from app.schemas import UploadSignInput

router = APIRouter(tags=["uploads"])

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
def sign_upload(body: UploadSignInput, request: Request, payload: dict = Depends(current_user)):
    """``{ uploadUrl, path }``. Photos need ``image/*``, voice notes ``audio/*``."""
    wanted = "image/" if body.kind == "report_photo" else "audio/"
    if not body.content_type.startswith(wanted):
        raise HTTPException(status_code=400, detail="نوع الملف مش مدعوم")
    ext = EXTENSIONS.get(body.content_type, body.content_type.split("/", 1)[1].split(";")[0] or "bin")
    folder = "photos" if body.kind == "report_photo" else "voice"
    path = f"{folder}/{payload['sub']}/{uuid.uuid4().hex}.{ext}"
    base = str(request.base_url).rstrip("/")
    return {"uploadUrl": f"{base}/uploads/local/{path}", "path": path}


@router.put("/uploads/local/{path:path}", status_code=204)
async def local_upload(path: str, request: Request) -> Response:
    """Dev stub for the signed URL: reads the body and drops it."""
    await request.body()
    return Response(status_code=204)
