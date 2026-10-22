"""Due-date and overdue helpers (one place for the rule)."""

from datetime import UTC, datetime, timedelta

from app.helpers import now_utc
from app.logic.status import OPEN_STATUSES
from app.models import Category, Incident

DUE_SOON_HOURS = 12
DEFAULT_TARGET_DAYS = 5


def aware(dt: datetime) -> datetime:
    """Treat naive datetimes (SQLite) as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _status(incident: Incident) -> str:
    return getattr(incident.status, "value", incident.status)


def due_at(incident: Incident, category: Category | None) -> datetime:
    """createdAt + category target days (calendar days)."""
    days = category.target_days if category else DEFAULT_TARGET_DAYS
    return aware(incident.created_at) + timedelta(days=days)


def is_open(incident: Incident) -> bool:
    return _status(incident) in OPEN_STATUSES


def is_overdue(incident: Incident, category: Category | None, now: datetime | None = None) -> bool:
    """Open and past its due date."""
    return is_open(incident) and (now or now_utc()) > due_at(incident, category)


def is_due_soon(incident: Incident, category: Category | None, now: datetime | None = None) -> bool:
    """Open and overdue, or due within the next 12 hours."""
    if not is_open(incident):
        return False
    remaining = due_at(incident, category) - (now or now_utc())
    return remaining <= timedelta(hours=DUE_SOON_HOURS)


def hours_late(incident: Incident, category: Category | None, now: datetime | None = None) -> int:
    """round((now - dueAt) hours); negative means hours remaining."""
    return round((((now or now_utc()) - due_at(incident, category)).total_seconds()) / 3600)
