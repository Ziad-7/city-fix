"""Expo push adapter and leased, bounded delivery processing."""

from datetime import UTC, datetime, timedelta
from typing import Protocol

import httpx
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.models import Notification, PushDelivery, PushToken

EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"


class PushSender(Protocol):
    def send(self, token: str, title: str, body: str, data: dict[str, str]) -> dict: ...

    def receipts(self, ticket_ids: list[str]) -> dict[str, dict]: ...


class ExpoPushSender:
    """Small synchronous Expo adapter; access credentials are server side only."""

    def __init__(self, access_token: str = "", *, timeout: float = 8.0, client: httpx.Client | None = None):
        self._access_token = access_token
        self._client = client or httpx.Client(timeout=timeout)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self._access_token:
            headers["Authorization"] = f"Bearer {self._access_token}"
        return headers

    def send(self, token: str, title: str, body: str, data: dict[str, str]) -> dict:
        response = self._client.post(
            EXPO_SEND_URL,
            headers=self._headers(),
            json={"to": token, "title": title, "body": body, "data": data},
        )
        response.raise_for_status()
        payload = response.json()
        rows = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(rows, dict):
            return rows
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict):
            raise RuntimeError("Expo push response was malformed")
        return rows[0]

    def receipts(self, ticket_ids: list[str]) -> dict[str, dict]:
        response = self._client.post(
            EXPO_RECEIPTS_URL,
            headers=self._headers(),
            json={"ids": ticket_ids},
        )
        response.raise_for_status()
        payload = response.json()
        rows = payload.get("data") if isinstance(payload, dict) else None
        return rows if isinstance(rows, dict) else {}


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _claim(db: Session, *, limit: int, status: str, lease_minutes: int = 2) -> list[str]:
    now = _now()
    if status == "pending":
        # A worker may have sent successfully then crashed before saving the ticket.
        # The persistent marker turns an expired lease into unknown instead of a blind resend.
        stale = select(PushDelivery.id).where(
            PushDelivery.status == "pending",
            PushDelivery.last_error == "send_started",
            PushDelivery.lease_until < now,
        )
        if db.get_bind().dialect.name == "postgresql":
            stale = stale.with_for_update(skip_locked=True)
        stale_ids = list(db.execute(stale).scalars())
        if stale_ids:
            db.execute(
                update(PushDelivery)
                .where(PushDelivery.id.in_(stale_ids), PushDelivery.status == "pending")
                .values(status="unknown", lease_until=None, last_error="worker_lost_after_send_started")
            )
            db.commit()
    query = (
        select(PushDelivery)
        .where(
            PushDelivery.status == status,
            PushDelivery.next_attempt_at <= now,
            or_(PushDelivery.lease_until.is_(None), PushDelivery.lease_until < now),
        )
        .order_by(PushDelivery.created_at, PushDelivery.id)
        .limit(limit)
    )
    if db.get_bind().dialect.name == "postgresql":
        query = query.with_for_update(skip_locked=True)
    rows = db.execute(query).scalars().all()
    claimed: list[str] = []
    for row in rows:
        result = db.execute(
            update(PushDelivery)
            .where(
                PushDelivery.id == row.id,
                PushDelivery.status == status,
                or_(PushDelivery.lease_until.is_(None), PushDelivery.lease_until < now),
            )
            .values(lease_until=now + timedelta(minutes=lease_minutes))
        )
        if result.rowcount == 1:
            claimed.append(row.id)
    if status == "pending" and claimed:
        for delivery_id in claimed:
            db.execute(
                update(PushDelivery)
                .where(
                    PushDelivery.id == delivery_id,
                    PushDelivery.lease_until == now + timedelta(minutes=lease_minutes),
                )
                .values(attempts=PushDelivery.attempts + 1, last_error="send_started")
            )
    db.commit()
    return claimed


def _retry_delay(attempt: int) -> timedelta:
    return timedelta(seconds=min(3600, 30 * (2 ** max(0, attempt - 1))))


def _leased_delivery(db: Session, delivery_id: str, status: str) -> PushDelivery | None:
    statement = select(PushDelivery).where(
        PushDelivery.id == delivery_id,
        PushDelivery.status == status,
        PushDelivery.lease_until > _now(),
    )
    if db.get_bind().dialect.name == "postgresql":
        statement = statement.with_for_update()
    return db.execute(statement).scalar_one_or_none()


def dispatch_pending(db: Session, *, limit: int, sender: PushSender) -> dict[str, int]:
    """Lease and send at most limit pending rows. Ticket acceptance remains ticketed."""
    if not 1 <= limit <= 100:
        raise ValueError("limit must be 1..100")
    totals = {"claimed": 0, "ticketed": 0, "failed": 0, "unknown": 0, "deactivated": 0}
    for _ in range(limit):
        claimed = _claim(db, limit=1, status="pending")
        if not claimed:
            break
        totals["claimed"] += 1
        delivery_id = claimed[0]
        row = db.get(PushDelivery, delivery_id)
        if row is None:
            db.commit()
            continue
        token_id, notification_id, attempts = row.push_token_id, row.notification_id, row.attempts
        token = db.get(PushToken, token_id)
        notification = db.get(Notification, notification_id)
        if token is None or not token.active or notification is None or token.user_id != notification.recipient_id:
            db.commit()
            applied = _finish_send(db, delivery_id, "failed", error="registration_unavailable")
            if applied:
                totals["failed"] += 1
            continue
        payload = (token.token, notification.title, notification.body, dict(notification.data))
        db.commit()  # No database transaction remains open during the provider request.
        try:
            ticket = sender.send(*payload)
        except httpx.TimeoutException:
            # Expo may have accepted the request even though our response timed out.
            if _finish_send(db, delivery_id, "unknown", error="timeout_after_send"):
                totals["unknown"] += 1
            continue
        except Exception:
            outcome = "pending" if attempts < 3 else "failed"
            if _finish_send(db, delivery_id, outcome, error="provider_unavailable", retry=outcome == "pending"):
                if outcome == "failed":
                    totals["failed"] += 1
            continue
        status = ticket.get("status")
        if status == "ok" and ticket.get("id"):
            if _finish_send(db, delivery_id, "ticketed", ticket_id=str(ticket["id"])):
                totals["ticketed"] += 1
        else:
            error = str(ticket.get("details", {}).get("error", "provider_rejected"))
            outcome = (
                "pending" if attempts < 3 and error not in {"DeviceNotRegistered", "InvalidCredentials"} else "failed"
            )
            applied = _finish_send(
                db,
                delivery_id,
                outcome,
                error=error[:100],
                retry=outcome == "pending",
                deactivate=error == "DeviceNotRegistered",
                token_id=token_id,
            )
            if applied and error == "DeviceNotRegistered":
                totals["deactivated"] += 1
            if applied and outcome == "failed":
                totals["failed"] += 1
    return totals


def _finish_send(
    db: Session,
    delivery_id: str,
    status: str,
    *,
    error: str | None = None,
    ticket_id: str | None = None,
    retry: bool = False,
    deactivate: bool = False,
    token_id: str | None = None,
) -> bool:
    row = _leased_delivery(db, delivery_id, "pending")
    if row is None:
        db.commit()
        return False
    row.status = status
    row.last_error = error
    row.lease_until = None
    if retry:
        row.next_attempt_at = _now() + _retry_delay(row.attempts)
    if status == "ticketed":
        row.ticket_id = ticket_id
        row.next_attempt_at = _now() + timedelta(minutes=15)
        row.last_error = None
    if deactivate and token_id:
        token = db.get(PushToken, token_id)
        if token is not None:
            token.active = False
    db.commit()
    return True


def poll_receipts(db: Session, *, limit: int, sender: PushSender) -> dict[str, int]:
    """Poll bounded ticketed rows; only receipt status ok is counted delivered."""
    if not 1 <= limit <= 100:
        raise ValueError("limit must be 1..100")
    delivery_ids = _claim(db, limit=limit, status="ticketed")
    totals = {"claimed": len(delivery_ids), "delivered": 0, "failed": 0, "deactivated": 0}
    snapshots = []
    for delivery_id in delivery_ids:
        row = db.get(PushDelivery, delivery_id)
        if row is not None and row.ticket_id:
            snapshots.append((delivery_id, row.ticket_id, row.push_token_id))
    ticket_ids = [ticket_id for _, ticket_id, _ in snapshots]
    db.commit()  # Receipt polling is also kept outside any database transaction.
    try:
        receipts = sender.receipts(ticket_ids) if ticket_ids else {}
    except Exception:
        receipts = {}
    for delivery_id, ticket_id, token_id in snapshots:
        row = _leased_delivery(db, delivery_id, "ticketed")
        if row is None:
            db.commit()
            continue
        receipt = receipts.get(ticket_id)
        if not receipt:
            # Expo receipts are asynchronous and may take minutes to appear.
            # Track polls separately from sends and bound provider work. An
            # unresolved accepted ticket becomes unknown, never sent again.
            row.receipt_attempts += 1
            if row.receipt_attempts >= 3:
                row.status = "unknown"
                row.last_error = "receipt_unavailable"
            else:
                row.next_attempt_at = _now() + timedelta(minutes=15)
                row.last_error = "receipt_pending"
            row.lease_until = None
            db.commit()
            continue
        if receipt.get("status") == "ok":
            row.status = "delivered"
            row.lease_until = None
            row.last_error = None
            totals["delivered"] += 1
            db.commit()
            continue
        error = str(receipt.get("details", {}).get("error", "receipt_rejected"))
        token = db.get(PushToken, token_id)
        if error == "DeviceNotRegistered" and token is not None:
            token.active = False
            totals["deactivated"] += 1
        row.status = "failed"
        row.last_error = error[:100]
        row.lease_until = None
        totals["failed"] += 1
        db.commit()
    return totals
