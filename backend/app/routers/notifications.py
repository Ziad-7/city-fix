"""Private notification inbox and explicit push-token registration."""

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.auth import User, current_user
from app.db import get_db
from app.models import Notification, PushToken
from app.notification_schemas import (
    DeletePushTokenInput,
    NotificationItem,
    NotificationList,
    PushTokenInput,
    ReadNotificationInput,
)

router = APIRouter(tags=["notifications"])


def _item(row: Notification) -> NotificationItem:
    return NotificationItem(
        id=row.id,
        kind=row.kind,
        title=row.title,
        body=row.body,
        data=row.data,
        created_at=row.created_at,
        read_at=row.read_at,
    )


@router.get("/notifications", response_model=NotificationList)
def list_notifications(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before_id: Annotated[str | None, Query(alias="beforeId")] = None,
) -> NotificationList:
    query = select(Notification).where(Notification.recipient_id == user.id)
    if before_id is not None:
        cursor = db.execute(
            select(Notification).where(Notification.id == before_id, Notification.recipient_id == user.id)
        ).scalar_one_or_none()
        if cursor is None:
            raise HTTPException(404, "الإشعار مش موجود")
        query = query.where(
            or_(
                Notification.created_at < cursor.created_at,
                and_(Notification.created_at == cursor.created_at, Notification.id < cursor.id),
            )
        )
    rows = (
        db.execute(query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit + 1))
        .scalars()
        .all()
    )
    has_more = len(rows) > limit
    page = rows[:limit]
    return NotificationList(
        items=[_item(row) for row in page], next_before_id=page[-1].id if has_more and page else None
    )


@router.patch("/notifications/{notification_id}", response_model=NotificationItem)
def mark_notification_read(
    notification_id: str,
    body: ReadNotificationInput,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> NotificationItem:
    row = db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.recipient_id == user.id)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "الإشعار مش موجود")
    if row.read_at is None:
        row.read_at = datetime.now(UTC).replace(tzinfo=None)
        db.commit()
        db.refresh(row)
    return _item(row)


@router.post("/notifications/push-tokens", status_code=204)
def register_push_token(
    body: PushTokenInput,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    now = datetime.now(UTC).replace(tzinfo=None)
    table = PushToken.__table__
    values = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "token": body.token,
        "platform": body.platform,
        "active": True,
        "created_at": now,
        "updated_at": now,
    }
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = (
            pg_insert(table)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[table.c.token],
                set_={"user_id": user.id, "platform": body.platform, "active": True, "updated_at": now},
            )
        )
    elif dialect == "sqlite":
        statement = (
            sqlite_insert(table)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[table.c.token],
                set_={"user_id": user.id, "platform": body.platform, "active": True, "updated_at": now},
            )
        )
    else:
        raise RuntimeError("Push-token registration requires PostgreSQL or SQLite")
    db.execute(statement)
    db.commit()
    return Response(status_code=204)


@router.delete("/notifications/push-tokens", status_code=204)
def delete_push_token(
    body: DeletePushTokenInput,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    row = db.execute(
        select(PushToken).where(PushToken.token == body.token, PushToken.user_id == user.id)
    ).scalar_one_or_none()
    if row is not None:
        # Preserve historical deliveries while revoking this registration.
        row.active = False
        db.commit()
    return Response(status_code=204)
