"""I8: Helpers for overdue calculations."""

from datetime import datetime, timedelta, timezone
from app.models import Incident, Category
from app.helpers import now_utc


def due_at(incident: Incident, category: Category) -> datetime:
    """I8: Calculate due date for an incident based on category target_days."""
    created_at = incident.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    target_days = category.target_days if category else 5
    return created_at + timedelta(days=target_days)


def is_overdue(
    incident: Incident, category: Category, now: datetime | None = None
) -> bool:
    """I8: Check if incident is overdue (past deadline or due within 12h). Open statuses only."""
    if incident.status not in ("received", "triaged", "assigned", "in_progress"):
        return False

    if now is None:
        now = now_utc()

    due = due_at(incident, category)
    hours_until_due = (due - now).total_seconds() / 3600
    return hours_until_due <= 12
