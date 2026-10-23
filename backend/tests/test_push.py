import uuid
from datetime import UTC, datetime, timedelta

import httpx

from app.models import Notification, PushDelivery, PushToken
from app.push import ExpoPushSender, dispatch_pending, poll_receipts


def _pending(db, user_id):
    token = PushToken(id=str(uuid.uuid4()), user_id=user_id, token="ExpoPushToken[test-device]", platform="ios")
    notification = Notification(
        id=str(uuid.uuid4()),
        recipient_id=user_id,
        kind="incident_status",
        title="Update",
        body="Status changed.",
        data={"incidentId": "INC-501"},
        event_key=str(uuid.uuid4()),
    )
    db.add_all([token, notification])
    db.flush()
    delivery = PushDelivery(
        id=str(uuid.uuid4()), notification_id=notification.id, push_token_id=token.id, status="pending"
    )
    db.add(delivery)
    db.flush()
    return token, delivery


def test_ticket_acceptance_is_not_delivery_until_receipt(db, citizen):
    _, delivery = _pending(db, citizen["id"])

    class Sender:
        def send(self, *args):
            assert not db.in_transaction()
            return {"status": "ok", "id": "ticket-1"}

        def receipts(self, ids):
            assert not db.in_transaction()
            return {"ticket-1": {"status": "ok"}}

    sent = dispatch_pending(db, limit=10, sender=Sender())
    assert sent["ticketed"] == 1
    assert delivery.status == "ticketed"
    assert delivery.next_attempt_at >= datetime.now(UTC).replace(tzinfo=None) + timedelta(minutes=14)
    delivery.next_attempt_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
    db.commit()
    received = poll_receipts(db, limit=10, sender=Sender())
    assert received["delivered"] == 1
    assert delivery.status == "delivered"


def test_missing_async_receipt_stays_ticketed_without_spending_send_retries(db, citizen):
    _, delivery = _pending(db, citizen["id"])
    delivery.status = "ticketed"
    delivery.ticket_id = "ticket-pending"
    delivery.attempts = 1
    db.commit()

    class Sender:
        def send(self, *args):
            raise AssertionError("ticketed rows must not be resent")

        def receipts(self, ids):
            assert not db.in_transaction()
            return {}

    before = datetime.now(UTC).replace(tzinfo=None)
    result = poll_receipts(db, limit=10, sender=Sender())
    assert result["claimed"] == 1
    assert delivery.status == "ticketed"
    assert delivery.attempts == 1
    assert delivery.receipt_attempts == 1
    assert delivery.next_attempt_at >= before + timedelta(minutes=14)
    for _ in range(2):
        delivery.next_attempt_at = before - timedelta(seconds=1)
        db.commit()
        poll_receipts(db, limit=10, sender=Sender())
    assert delivery.status == "unknown"
    assert delivery.attempts == 1
    assert delivery.receipt_attempts == 3


def test_uncertain_send_timeout_becomes_unknown_without_blind_retry(db, citizen):
    _, delivery = _pending(db, citizen["id"])

    class Sender:
        def send(self, *args):
            raise httpx.TimeoutException("timed out")

        def receipts(self, ids):
            return {}

    result = dispatch_pending(db, limit=10, sender=Sender())
    assert result["unknown"] == 1
    assert delivery.status == "unknown"
    assert dispatch_pending(db, limit=10, sender=Sender())["claimed"] == 0


def test_worker_crash_after_claim_is_unknown_and_never_resent(db, citizen):
    _, delivery = _pending(db, citizen["id"])

    class WorkerCrash(BaseException):
        pass

    class Sender:
        def send(self, *args):
            raise WorkerCrash

        def receipts(self, ids):
            return {}

    try:
        dispatch_pending(db, limit=1, sender=Sender())
    except WorkerCrash:
        pass
    else:
        raise AssertionError("simulated worker crash did not escape")
    db.refresh(delivery)
    assert delivery.attempts == 1
    assert delivery.last_error == "send_started"
    delivery.lease_until = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
    db.commit()
    assert dispatch_pending(db, limit=1, sender=Sender())["claimed"] == 0
    assert delivery.status == "unknown"


def test_transient_send_failure_stops_after_three_attempts(db, citizen):
    _, delivery = _pending(db, citizen["id"])

    class Sender:
        def send(self, *args):
            raise RuntimeError("provider down")

        def receipts(self, ids):
            return {}

    for _ in range(3):
        delivery.next_attempt_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(seconds=1)
        db.commit()
        dispatch_pending(db, limit=1, sender=Sender())
    assert delivery.attempts == 3
    assert delivery.status == "failed"


def test_expo_sender_posts_only_registered_token_payload():
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json={"data": {"status": "ok", "id": "ticket"}})

    sender = ExpoPushSender("server-secret", client=httpx.Client(transport=httpx.MockTransport(handler)))
    result = sender.send("ExpoPushToken[test]", "Title", "Body", {"incidentId": "INC-1"})

    assert result["status"] == "ok"
    assert seen[0].headers["Authorization"] == "Bearer server-secret"
    assert seen[0].read()
