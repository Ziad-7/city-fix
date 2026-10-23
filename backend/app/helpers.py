"""Helper functions."""

from datetime import UTC, datetime

from fastapi.responses import JSONResponse


def now_utc() -> datetime:
    """Get current time as timezone-aware UTC."""
    return datetime.now(UTC)


def json_response(content) -> JSONResponse:
    """Contract dicts are already JSON-native: skip FastAPI's jsonable_encoder walk (same bytes, less CPU).

    Only for routes without a ``response_model``; the payload must contain nothing but dict/list/str/number/bool/None.
    """
    return JSONResponse(content)


def iso_z(dt: datetime) -> str:
    """Convert datetime to ISO 8601 UTC string with Z suffix."""
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        dt = dt.replace(tzinfo=UTC)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")
