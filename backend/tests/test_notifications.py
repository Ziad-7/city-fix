import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import jwt

from app.logic.status import change_incident_status
from app.models import Category, Incident, Notification, Profile, PushDelivery, PushToken, Report


def _notification(db, recipient_id):
    row = Notification(
        id=str(uuid.uuid4()),
        recipient_id=recipient_id,
        kind="incident_status",
        title="تحديث على بلاغك",
        body="حالة البلاغ اتحدثت.",
        data={"incidentId": "INC-501"},
        event_key=str(uuid.uuid4()),
        created_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(row)
    db.flush()
    return row


def test_notifications_are_private_cursor_paginated_and_mark_read_is_idempotent(client, db, citizen, other_citizen_h):
    first = _notification(db, citizen["id"])
    second = _notification(db, citizen["id"])
    from app.config import settings

    other_id = jwt.decode(
        other_citizen_h["Authorization"].split()[1],
        settings.jwt_secret,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )["sub"]
    foreign = _notification(db, other_id)

    page = client.get("/notifications?limit=1", headers=citizen["headers"])
    assert page.status_code == 200
    assert len(page.json()["items"]) == 1
    assert page.json()["items"][0]["createdAt"].endswith("Z")
    assert page.json()["items"][0]["readAt"] is None
    assert page.json()["nextBeforeId"]
    next_page = client.get(f"/notifications?limit=1&beforeId={page.json()['nextBeforeId']}", headers=citizen["headers"])
    assert next_page.status_code == 200
    assert len(next_page.json()["items"]) == 1
    assert "address" not in page.json()["items"][0]

    assert client.get(f"/notifications?beforeId={foreign.id}", headers=citizen["headers"]).status_code == 404
    assert (
        client.patch(f"/notifications/{foreign.id}", json={"read": True}, headers=citizen["headers"]).status_code == 404
    )

    marked = client.patch(f"/notifications/{first.id}", json={"read": True}, headers=citizen["headers"])
    repeated = client.patch(f"/notifications/{first.id}", json={"read": True}, headers=citizen["headers"])
    assert marked.status_code == 200
    assert marked.json()["readAt"] == repeated.json()["readAt"]
    assert second.id != first.id


def test_push_token_registration_and_delete_are_caller_scoped(client, citizen, other_citizen_h, db):
    token = "ExpoPushToken[device-token_123]"
    register = client.post(
        "/notifications/push-tokens", json={"token": token, "platform": "ios"}, headers=citizen["headers"]
    )
    assert register.status_code == 204
    assert (
        client.request(
            "DELETE", "/notifications/push-tokens", json={"token": token}, headers=other_citizen_h
        ).status_code
        == 204
    )
    from app.models import PushToken

    row = db.query(PushToken).filter_by(token=token).one()
    assert row.user_id == citizen["id"]
    transfer = client.post(
        "/notifications/push-tokens", json={"token": token, "platform": "android"}, headers=other_citizen_h
    )
    assert transfer.status_code == 204
    db.refresh(row)
    assert row.user_id != citizen["id"]
    assert row.platform == "android"
    assert (
        client.post(
            "/notifications/push-tokens", json={"token": "invalid", "platform": "ios"}, headers=citizen["headers"]
        ).status_code
        == 422
    )
    assert (
        client.request(
            "DELETE", "/notifications/push-tokens", json={"token": token}, headers=other_citizen_h
        ).status_code
        == 204
    )
    db.refresh(row)
    assert row.active is False


def test_incident_transition_stages_once_and_caller_rollback_removes_notification(db):
    incident = db.get(Incident, "INC-501")
    previous = getattr(incident.status, "value", incident.status)
    token = PushToken(
        id=str(uuid.uuid4()), user_id="citizen-001", token="ExpoPushToken[notify-test]", platform="android"
    )
    db.add(token)
    db.flush()
    nested = db.begin_nested()
    change_incident_status(db, incident, "triaged" if previous != "triaged" else "received", "test", "staff")
    count = db.query(Notification).filter_by(kind="incident_status").count()
    assert count > 0
    assert db.query(PushDelivery).count() > 0
    nested.rollback()
    assert db.query(Notification).filter_by(kind="incident_status").count() == 0
    assert db.query(PushDelivery).count() == 0


def test_postgres_concurrent_same_incident_transition_notifies_once():
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        import pytest

        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy import create_engine, select
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session

    from alembic import command
    from scripts.migrate import _alembic_config

    base = make_url(source_url)
    database_name = f"member4_notify_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    try:
        command.upgrade(_alembic_config(test_url.render_as_string(hide_password=False)), "head")
        with Session(engine) as db:
            db.add_all([Profile(id="notify-owner", role="citizen"), Category(id="pothole", label_ar="حفرة")])
            db.flush()
            db.add(
                Incident(
                    id="INC-NOTIFY",
                    category_id="pothole",
                    title="Test",
                    status="RECEIVED",
                    lat=30,
                    lng=31,
                    address="Test address",
                )
            )
            db.flush()
            db.add(
                Report(
                    id="FTC-NOTIFY",
                    reporter_id="notify-owner",
                    incident_id="INC-NOTIFY",
                    category_id="pothole",
                    lat=30,
                    lng=31,
                    address="Test address",
                )
            )
            db.commit()

        barrier = threading.Barrier(2)

        def transition():
            with Session(engine) as db:
                incident = db.execute(select(Incident).where(Incident.id == "INC-NOTIFY")).scalar_one()
                barrier.wait(timeout=5)
                change_incident_status(db, incident, "triaged", "Reviewed", "Staff")
                db.commit()

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: transition(), range(2)))
        with Session(engine) as db:
            assert db.query(Notification).filter_by(recipient_id="notify-owner").count() == 1
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))
