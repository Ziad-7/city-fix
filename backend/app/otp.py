"""Provider boundary for citizen one-time passwords."""

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from typing import Protocol
from urllib.parse import quote

import httpx
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import OTPChallenge, OTPThrottle


class OTPProviderError(Exception):
    """A safe provider failure with the HTTP status exposed by the API."""

    def __init__(self, status_code: int):
        super().__init__("OTP provider unavailable")
        self.status_code = status_code


class OTPProvider(Protocol):
    def start(self, phone: str, channel: str) -> None: ...

    def check(self, phone: str, code: str) -> bool: ...


def phone_key(phone: str, secret: str) -> str:
    """Return a keyed digest so throttle/challenge rows do not expose phone numbers."""
    return hmac.new(secret.encode(), phone.encode(), hashlib.sha256).hexdigest()


def _naive_utc() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def check_rate_limit(db: Session, phone_hash: str, action: str) -> None:
    """Atomically count a start/check against its ten minute per-phone window."""
    now = _naive_utc()
    table = OTPThrottle.__table__
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        statement = pg_insert(table).values(phone_hash=phone_hash, window_started_at=now, starts=0, checks=0)
        db.execute(statement.on_conflict_do_nothing(index_elements=[table.c.phone_hash]))
    elif dialect == "sqlite":
        statement = sqlite_insert(table).values(phone_hash=phone_hash, window_started_at=now, starts=0, checks=0)
        db.execute(statement.on_conflict_do_nothing(index_elements=[table.c.phone_hash]))
    else:
        raise RuntimeError("OTP throttling requires PostgreSQL or SQLite")
    row = db.execute(
        select(OTPThrottle).where(OTPThrottle.phone_hash == phone_hash).with_for_update()
    ).scalar_one_or_none()
    if row is None:
        db.rollback()
        raise RuntimeError("OTP throttle row could not be initialized")
    if row.window_started_at < now - timedelta(minutes=10):
        row.window_started_at = now
        row.starts = 0
        row.checks = 0
    field = "starts" if action == "start" else "checks"
    ceiling = 5 if action == "start" else 10
    count = getattr(row, field)
    if count >= ceiling:
        db.rollback()
        raise OTPProviderError(429)
    setattr(row, field, count + 1)
    db.commit()


def lock_challenge_generation(db: Session, phone_hash: str) -> None:
    """Serialize provider starts for a phone on its durable throttle row."""
    throttle = db.execute(
        select(OTPThrottle).where(OTPThrottle.phone_hash == phone_hash).with_for_update()
    ).scalar_one_or_none()
    if throttle is None:
        db.rollback()
        raise RuntimeError("OTP throttle row must exist before opening a challenge")


def create_challenge(db: Session, phone_hash: str) -> None:
    """Open a ten-minute generation after the serialized provider start succeeds."""
    now = _naive_utc()
    db.execute(
        update(OTPChallenge)
        .where(OTPChallenge.phone_hash == phone_hash, OTPChallenge.consumed_at.is_(None))
        .values(consumed_at=now)
    )
    db.add(
        OTPChallenge(
            id=str(uuid.uuid4()), phone_hash=phone_hash, created_at=now, expires_at=now + timedelta(minutes=10)
        )
    )
    db.commit()


def consume_challenge(db: Session, challenge_id: str) -> bool:
    """Consume the exact generation observed before provider verification."""
    now = _naive_utc()
    result = db.execute(
        update(OTPChallenge)
        .where(
            OTPChallenge.id == challenge_id,
            OTPChallenge.consumed_at.is_(None),
            OTPChallenge.expires_at > now,
        )
        .values(consumed_at=now)
    )
    db.commit()
    return result.rowcount == 1


def active_challenge_id(db: Session, phone_hash: str) -> str | None:
    now = _naive_utc()
    return db.execute(
        select(OTPChallenge.id)
        .where(
            OTPChallenge.phone_hash == phone_hash,
            OTPChallenge.consumed_at.is_(None),
            OTPChallenge.expires_at > now,
        )
        .order_by(OTPChallenge.created_at.desc(), OTPChallenge.id.desc())
        .limit(1)
    ).scalar_one_or_none()


class TwilioVerifyProvider:
    """Twilio Verify client. Credentials and provider response bodies stay private."""

    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        service_sid: str,
        *,
        timeout: float = 5.0,
        client: httpx.Client | None = None,
    ):
        if not account_sid or not auth_token or not service_sid:
            raise ValueError("Twilio Verify configuration is incomplete")
        self._account_sid = account_sid
        self._service_sid = service_sid
        self._client = client or httpx.Client(timeout=timeout, auth=(account_sid, auth_token))

    @property
    def _base_url(self) -> str:
        return f"https://verify.twilio.com/v2/Services/{quote(self._service_sid, safe='')}"

    def start(self, phone: str, channel: str) -> None:
        if channel not in {"sms", "whatsapp"}:
            raise ValueError("Unsupported OTP channel")
        self._post("Verifications", {"To": phone, "Channel": channel})

    def check(self, phone: str, code: str) -> bool:
        try:
            response = self._post("VerificationCheck", {"To": phone, "Code": code}, result=True)
        except OTPProviderError as exc:
            # Twilio uses 20404 when a verification is expired or no longer exists.
            if exc.status_code == 404:
                return False
            raise
        status = response.get("status")
        if status == "approved":
            return True
        if status in {"pending", "canceled", "expired", "max_attempts_reached"}:
            return False
        raise OTPProviderError(503)

    def _post(self, endpoint: str, data: dict[str, str], *, result: bool = False) -> dict:
        try:
            response = self._client.post(f"{self._base_url}/{endpoint}", data=data)
        except httpx.TimeoutException as exc:
            raise OTPProviderError(504) from exc
        except httpx.HTTPError as exc:
            raise OTPProviderError(503) from exc
        if response.status_code == 429:
            raise OTPProviderError(429)
        if response.status_code == 404:
            raise OTPProviderError(404 if result else 503)
        if not response.is_success:
            raise OTPProviderError(503)
        if not result:
            return {}
        try:
            payload = response.json()
        except ValueError as exc:
            raise OTPProviderError(503) from exc
        return payload if isinstance(payload, dict) else {}
