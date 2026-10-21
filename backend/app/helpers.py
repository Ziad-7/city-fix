"""Helper functions."""
from datetime import datetime, timezone


def now_utc() -> datetime:
    """Get current time as timezone-aware UTC."""
    return datetime.now(timezone.utc)


def iso_z(dt: datetime) -> str:
    """Convert datetime to ISO 8601 UTC string with Z suffix."""
    if dt.tzinfo is None:
        # Assume naive datetime is UTC
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")
