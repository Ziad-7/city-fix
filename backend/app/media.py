"""Storage adapter contract: no service-role keys or bucket URLs in routes."""

from typing import Protocol

from fastapi import HTTPException, Request

from app.auth import User
from app.schemas.citizen import Report


class MediaStorage(Protocol):
    def sign_upload(
        self, user_id: str, kind: str, content_type: str
    ) -> tuple[str, str]:
        """Return (HTTPS upload URL, new owner-scoped random path), no overwrite."""
        ...

    def require_uploaded(self, user_id: str, path: str, kind: str) -> None:
        """Verify ownership, completed upload, MIME/size and safe path; else 4xx."""
        ...

    def sign_read(self, user_id: str, path: str) -> str:
        """Return a short-lived HTTPS read URL after route-level authorization."""
        ...

    async def read_approved(
        self, user_id: str, path: str, kind: str, consent: bool
    ) -> bytes:
        """Verify ownership and consent; the caller must redact before any model call."""
        ...


def get_media(request: Request) -> MediaStorage | None:
    return getattr(request.app.state, "media_storage", None)


def require_media(storage: MediaStorage | None) -> MediaStorage:
    if storage is None:
        raise HTTPException(503, "رفع الصور مش متاح دلوقتي، جرّب تاني بعدين.")
    return storage


def validate_media(
    user: User, photos: list[str], voice: str | None, storage: MediaStorage | None
) -> None:
    for path in photos:
        require_media(storage).require_uploaded(user.id, path, "report_photo")
    if voice:
        require_media(storage).require_uploaded(user.id, voice, "voice_note")


def report_for_reader(
    report: Report, user: User, storage: MediaStorage | None
) -> Report:
    # Called only after ownership/admin checks. Never mutate persisted paths.
    photos = [
        require_media(storage).sign_read(user.id, path) for path in report.photo_uris
    ]
    voice = (
        require_media(storage).sign_read(user.id, report.voice_note_uri)
        if report.voice_note_uri
        else None
    )
    return report.model_copy(
        update={
            "photo_uris": photos,
            "voice_note_uri": voice,
            "reporter_id": ""
            if report.anonymous and user.id != report.reporter_id
            else report.reporter_id,
        }
    )
