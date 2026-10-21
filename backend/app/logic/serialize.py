"""Serialization functions for domain entities."""
from sqlalchemy.orm import Session
from app.models import ActivityLog
from app.helpers import iso_z


def work_order_updates(db: Session, wo_id: str) -> list[dict]:
    """Get work order status updates from activity log, oldest first.

    Args:
        db: Database session
        wo_id: Work order ID (e.g., 'WO-318')

    Returns:
        List of dicts with {status, note, actor, at: iso_z}, ordered by time ascending.
    """
    activities = db.query(ActivityLog).filter(
        ActivityLog.entity_type == "work_order",
        ActivityLog.entity_id == wo_id,
    ).order_by(ActivityLog.at).all()

    return [
        {
            "status": activity.status,
            "note": activity.note,
            "actor": activity.actor,
            "at": iso_z(activity.at),
        }
        for activity in activities
    ]
