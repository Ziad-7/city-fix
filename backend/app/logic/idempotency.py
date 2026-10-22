"""Optional ``Idempotency-Key`` support for create endpoints (per user and endpoint scope)."""

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import IdempotencyKey

MAX_KEY_LENGTH = 100


def clean_key(key: str | None) -> str | None:
    key = (key or "").strip()
    if not key:
        return None
    if len(key) > MAX_KEY_LENGTH:
        raise HTTPException(422, "البيانات مش مكتملة")
    return key


def lookup(db: Session, user_id: str, scope: str, key: str | None) -> str | None:
    """Resource id created earlier with this key by this user, if any."""
    if key is None:
        return None
    row = db.query(IdempotencyKey).filter_by(user_id=user_id, scope=scope, key=key).first()
    return (row.resource_id or None) if row else None


def claim(db: Session, user_id: str, scope: str, key: str | None) -> tuple[IdempotencyKey | None, str | None]:
    """Reserve ``key`` before creating anything. Returns ``(row, earlier_resource_id)``.

    A repeat returns the earlier id. Two concurrent first requests race on the unique constraint inside a
    SAVEPOINT, so the loser rolls back only the reservation (no 500) and returns the winner's resource.
    The caller sets ``row.resource_id`` before its single commit.
    """
    if key is None:
        return None, None
    earlier = lookup(db, user_id, scope, key)
    if earlier:
        return None, earlier
    try:
        with db.begin_nested():
            row = IdempotencyKey(user_id=user_id, scope=scope, key=key, resource_id="")
            db.add(row)
            db.flush()
        return row, None
    except IntegrityError:
        return None, lookup(db, user_id, scope, key)
