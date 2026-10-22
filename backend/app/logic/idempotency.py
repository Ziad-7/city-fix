"""Optional ``Idempotency-Key`` support for create endpoints (per user and endpoint scope)."""

from fastapi import HTTPException
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
    return row.resource_id if row else None


def remember(db: Session, user_id: str, scope: str, key: str | None, resource_id: str) -> None:
    """Record the key in the same transaction as the created resource (unique per user, scope, key)."""
    if key is not None:
        db.add(IdempotencyKey(user_id=user_id, scope=scope, key=key, resource_id=resource_id))
