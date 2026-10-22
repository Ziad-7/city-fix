"""Optional private-media storage adapter (signed uploads and short-lived signed reads).

When ``app.state.media_storage`` is None (the local demo), uploads use the local stub in
``app.routers.uploads`` and stored paths are returned unchanged. When a storage is configured,
paths sent with a report must have been uploaded by the caller, and reads are signed.
No service-role keys or bucket URLs belong in route code.
"""

import logging
from typing import Protocol

from fastapi import HTTPException, Request

logger = logging.getLogger("fixthecity")


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

    async def read_approved(self, user_id: str, path: str, kind: str, consent: bool) -> bytes:
        """Verify ownership and consent; the caller must redact before any model call."""
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
        # Paths are scoped to the report's author, so sign them against the author (the route has
        # already authorized the reader); signing against an admin reader would always fail.
        owner = view.get("reporterId") or reader_id
        out["photoUris"] = signed_reads(storage, owner, view.get("photoUris", []))
        if view.get("voiceNoteUri"):
            voice = signed_reads(storage, owner, [view["voiceNoteUri"]])
            if voice:
                out["voiceNoteUri"] = voice[0]
            else:
                out.pop("voiceNoteUri")
    if view.get("anonymous") and view.get("reporterId") != reader_id:
        out["reporterId"] = ""
    return out


def signed_reads(storage: MediaStorage, owner_id: str, paths: list[str]) -> list[str]:
    """Short-lived read URLs for ``owner_id``'s paths; a path that cannot be signed is skipped.

    Ownership is still enforced by the storage adapter (a path outside ``owner_id/`` is refused),
    and legacy local-stub paths saved before storage was configured are dropped instead of failing
    the whole response.
    """
    out: list[str] = []
    for path in paths:
        try:
            out.append(storage.sign_read(owner_id, path))
        except HTTPException as error:
            logger.warning("skipped unsignable media path (status %s)", error.status_code)
    return out


def sign_linked_report_photos(incident: dict, reports: list, storage: MediaStorage | None) -> dict:
    """Add ``photoUrls`` (short-lived signed reads) to each ``linkedReports`` entry of an AdminIncident.

    Call only after the route authorized the staff member for this incident (department scope).
    Without a configured storage (local demo) the stored paths are returned as-is.
    """
    by_id = {r.id: r for r in reports}
    linked = []
    for entry in incident.get("linkedReports", []):
        report = by_id.get(entry["id"])
        paths = list(report.photo_paths or []) if report is not None else []
        urls = paths if storage is None else signed_reads(storage, report.reporter_id, paths) if report else []
        linked.append({**entry, "photoUrls": urls})
    return {**incident, "linkedReports": linked}
