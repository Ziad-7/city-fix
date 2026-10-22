"""Optional private-media storage adapter (signed uploads and short-lived signed reads).

When ``app.state.media_storage`` is None (the local demo), uploads use the local stub in
``app.routers.uploads`` and stored paths are returned unchanged. When a storage is configured,
paths sent with a report must have been uploaded by the caller, and reads are signed.
No service-role keys or bucket URLs belong in route code.
"""

from typing import Protocol

from fastapi import HTTPException, Request


class MediaStorage(Protocol):
    def sign_upload(self, user_id: str, kind: str, content_type: str) -> tuple[str, str]:
        """Return (HTTPS upload URL, new owner-scoped random path), no overwrite."""
        ...

    def require_uploaded(self, user_id: str, path: str, kind: str) -> None:
        """Verify ownership, completed upload, MIME/size and safe path; else raise 4xx."""
        ...

    def sign_read(self, user_id: str, path: str) -> str:
        """Return a short-lived HTTPS read URL after route-level authorization."""
        ...


def get_media(request: Request) -> MediaStorage | None:
    return getattr(request.app.state, "media_storage", None)


def require_media(storage: MediaStorage | None) -> MediaStorage:
    if storage is None:
        raise HTTPException(503, "رفع الصور مش متاح دلوقتي، جرّب تاني بعدين.")
    return storage


def validate_media(user_id: str, photos: list[str], voice: str | None, storage: MediaStorage | None) -> None:
    """With a storage configured, every photo/voice path must be an upload owned by the caller."""
    if storage is None:
        return
    for path in photos:
        storage.require_uploaded(user_id, path, "report_photo")
    if voice:
        storage.require_uploaded(user_id, voice, "voice_note")


def report_for_reader(view: dict, reader_id: str, storage: MediaStorage | None) -> dict:
    """Contract ``Report`` for a reader already authorized (owner or admin).

    Signs media reads when a storage is configured, and hides the reporter id of an anonymous
    report from everyone except its author. Never mutates the persisted paths.
    """
    out = dict(view)
    if storage is not None:
        out["photoUris"] = [storage.sign_read(reader_id, path) for path in view.get("photoUris", [])]
        if view.get("voiceNoteUri"):
            out["voiceNoteUri"] = storage.sign_read(reader_id, view["voiceNoteUri"])
    if view.get("anonymous") and view.get("reporterId") != reader_id:
        out["reporterId"] = ""
    return out
