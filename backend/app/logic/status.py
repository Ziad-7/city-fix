"""Status constants and the single status-change function per entity.

Every status change (incident, service request, work order) goes through one of the
functions below, which also writes an ``activity_log`` row. Timelines are built from it.
"""

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.models import ActivityLog, Incident, ServiceRequest, WorkOrder

OPEN_STATUSES = ("received", "triaged", "assigned", "in_progress")
INCIDENT_STATUSES = (*OPEN_STATUSES, "resolved", "closed")
WORK_ORDER_STATUSES = ("open", "assigned", "in_progress", "done")


def _log(db: Session, entity_type: str, entity_id: str, status: str, note: str, actor: str) -> ActivityLog:
    row = ActivityLog(
        entity_type=entity_type,
        entity_id=entity_id,
        status=status,
        note=note,
        actor=actor,
        kind="status_change",
        at=now_utc(),
    )
    db.add(row)
    db.flush()
    return row


def add_incident_note(db: Session, incident: Incident, note: str, actor: str) -> None:
    """Append a timeline entry with the current status (note-only PATCH)."""
    incident.updated_at = now_utc()
    _log(db, "incident", incident.id, _value(incident.status), note, actor)


def add_service_request_note(db: Session, sr: ServiceRequest, note: str, actor: str) -> None:
    """Append a timeline entry with the current status (note-only PATCH)."""
    _log(db, "service_request", sr.id, _value(sr.status), note, actor)


def add_work_order_note(db: Session, wo: WorkOrder, note: str, actor: str) -> None:
    """Append an update with the current status (note-only PATCH)."""
    wo.updated_at = now_utc()
    _log(db, "work_order", wo.id, _value(wo.status), note, actor)


def _value(status) -> str:
    return getattr(status, "value", status)


def change_incident_status(db: Session, incident: Incident, status: str, note: str, actor: str) -> None:
    """Change incident status and write an activity log entry (note is shown to citizens)."""
    # Reload while holding the PostgreSQL row lock. Two staff requests that
    # began from the same stale ORM object must not both emit a transition.
    state = inspect(incident)
    pending_fields = {
        attribute.key: getattr(incident, attribute.key)
        for attribute in state.attrs
        if attribute.key != "status" and attribute.history.has_changes()
    }
    persisted = db.execute(
        select(Incident).where(Incident.id == incident.id).with_for_update().execution_options(populate_existing=True)
    ).scalar_one_or_none()
    if persisted is not None:
        incident = persisted
        for field, value in pending_fields.items():
            setattr(incident, field, value)
    previous = _value(incident.status)
    incident.status = status
    incident.updated_at = now_utc()
    activity = _log(db, "incident", incident.id, status, note, actor)
    if previous != status:
        from app.logic.notifications import create_status_notifications, incident_status_recipients

        create_status_notifications(
            db,
            event_key=f"incident:{incident.id}:activity:{activity.id}",
            recipient_ids=incident_status_recipients(db, incident.id),
            kind="incident_status",
            resource_id=incident.id,
            status=status,
        )


def change_service_request_status(db: Session, sr: ServiceRequest, status: str, note: str, actor: str) -> None:
    """Change service request status and write an activity log entry."""
    sr.status = status
    _log(db, "service_request", sr.id, status, note, actor)


def change_work_order_status(db: Session, wo: WorkOrder, status: str, note: str, actor: str) -> None:
    """Change work order status and write an activity log entry."""
    wo.status = status
    wo.updated_at = now_utc()
    if status == "done":
        wo.resolved_at = now_utc()
    _log(db, "work_order", wo.id, status, note, actor)
