"""Transactional creation of generic in-app updates and their push work."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, PushDelivery, PushToken


def create_status_notifications(
    db: Session,
    *,
    event_key: str,
    recipient_ids: list[str],
    kind: str,
    resource_id: str,
    status: str,
) -> None:
    """Stage notifications and delivery rows in the caller's domain transaction."""
    if kind not in {"incident_status", "pickup_status"}:
        raise ValueError("Unsupported notification kind")
    key_name = "incidentId" if kind == "incident_status" else "pickupId"
    title = "تحديث على بلاغك" if kind == "incident_status" else "تحديث على طلبك"
    body = "حالة البلاغ اتحدثت." if kind == "incident_status" else "حالة طلب التدوير اتحدثت."
    unique_recipients = list(dict.fromkeys(recipient_ids))
    for recipient_id in unique_recipients:
        existing = db.execute(
            select(Notification.id).where(
                Notification.event_key == event_key,
                Notification.recipient_id == recipient_id,
            )
        ).first()
        if existing:
            continue
        notification = Notification(
            id=str(uuid.uuid4()),
            recipient_id=recipient_id,
            kind=kind,
            title=title,
            body=body,
            data={key_name: resource_id},
            event_key=event_key,
        )
        db.add(notification)
        db.flush()
        tokens = db.execute(
            select(PushToken).where(PushToken.user_id == recipient_id, PushToken.active.is_(True))
        ).scalars()
        for token in tokens:
            db.add(
                PushDelivery(
                    id=str(uuid.uuid4()),
                    notification_id=notification.id,
                    push_token_id=token.id,
                    status="pending",
                )
            )


def incident_status_recipients(db: Session, incident_id: str) -> list[str]:
    """Reporters and followers linked to the incident, deduplicated by profile ID."""
    from app.models import IncidentFollower, Report

    reporters = db.execute(select(Report.reporter_id).where(Report.incident_id == incident_id)).scalars()
    followers = db.execute(
        select(IncidentFollower.user_id).where(IncidentFollower.incident_id == incident_id)
    ).scalars()
    return list(dict.fromkeys([*reporters, *followers]))


def pickup_status_recipients(db: Session, pickup_id: str) -> list[str]:
    """Household and assigned collector profile, deduplicated."""
    from app.models import Collector, RecyclingPickup

    pickup = db.get(RecyclingPickup, pickup_id)
    if pickup is None:
        return []
    recipients = [pickup.citizen_id]
    if pickup.collector_id:
        collector = db.get(Collector, pickup.collector_id)
        if collector:
            recipients.append(collector.profile_id)
    return list(dict.fromkeys(recipients))


def record_pickup_status_notification(
    db: Session, *, pickup_id: str, old_status: str, new_status: str, activity_id: int
) -> None:
    """Stage a status notification only for a real transition, keyed by its timeline row."""
    if old_status == new_status:
        return
    create_status_notifications(
        db,
        event_key=f"pickup:{pickup_id}:activity:{activity_id}",
        recipient_ids=pickup_status_recipients(db, pickup_id),
        kind="pickup_status",
        resource_id=pickup_id,
        status=new_status,
    )
