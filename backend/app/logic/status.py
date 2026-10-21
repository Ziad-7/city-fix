"""Status change functions that write activity logs."""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import Incident, ServiceRequest, WorkOrder, ActivityLog


def change_incident_status(
    db: Session,
    incident: Incident,
    status: str,
    note: str,
    actor: str,
) -> None:
    """
    Change incident status and write an activity log entry.
    The note is shown to citizens in the timeline.
    """
    incident.status = status
    incident.updated_at = datetime.utcnow()

    activity = ActivityLog(
        entity_type="incident",
        entity_id=incident.id,
        status=status,
        note=note,
        actor=actor,
        kind="status_change",
        at=datetime.utcnow(),
    )
    db.add(activity)
    db.flush()


def change_service_request_status(
    db: Session,
    service_request: ServiceRequest,
    status: str,
    note: str,
    actor: str,
) -> None:
    """
    Change service request status and write an activity log entry.
    """
    service_request.status = status

    activity = ActivityLog(
        entity_type="service_request",
        entity_id=service_request.id,
        status=status,
        note=note,
        actor=actor,
        kind="status_change",
        at=datetime.utcnow(),
    )
    db.add(activity)
    db.flush()


def change_work_order_status(
    db: Session,
    work_order: WorkOrder,
    status: str,
    note: str,
    actor: str,
) -> None:
    """
    Change work order status and write an activity log entry.
    """
    work_order.status = status
    work_order.updated_at = datetime.utcnow()

    if status == "done":
        work_order.resolved_at = datetime.utcnow()

    activity = ActivityLog(
        entity_type="work_order",
        entity_id=work_order.id,
        status=status,
        note=note,
        actor=actor,
        kind="status_change",
        at=datetime.utcnow(),
    )
    db.add(activity)
    db.flush()
