import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs

import httpx
import pytest

from app.otp import (
    OTPProviderError,
    TwilioVerifyProvider,
    active_challenge_id,
    check_rate_limit,
    consume_challenge,
    create_challenge,
    lock_challenge_generation,
)


@pytest.mark.parametrize("channel, expected_channel", [("sms", "sms"), ("whatsapp", "whatsapp")])
def test_twilio_verify_uses_selected_channel(channel, expected_channel):
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(201, json={"status": "pending"})

    provider = TwilioVerifyProvider(
        "AC123", "secret", "VA456", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    provider.start("+201012345678", channel)

    assert requests[0].url.path.endswith("/Services/VA456/Verifications")
    assert {key: values[0] for key, values in parse_qs(requests[0].read().decode()).items()} == {
        "To": "+201012345678",
        "Channel": expected_channel,
    }


def test_twilio_verify_checks_code_and_returns_provider_approval():
    def handler(request):
        return httpx.Response(200, json={"status": "approved"})

    provider = TwilioVerifyProvider(
        "AC123", "secret", "VA456", client=httpx.Client(transport=httpx.MockTransport(handler))
    )

    assert provider.check("+201012345678", "654321") is True


def test_twilio_verify_rejects_non_approved_code():
    def handler(request):
        return httpx.Response(200, json={"status": "pending"})

    provider = TwilioVerifyProvider(
        "AC123", "secret", "VA456", client=httpx.Client(transport=httpx.MockTransport(handler))
    )

    assert provider.check("+201012345678", "654321") is False


def test_twilio_missing_verification_check_is_invalid_code_but_start_404_is_provider_error():
    def handler(request):
        return httpx.Response(404, json={"code": 20404})

    provider = TwilioVerifyProvider(
        "AC123", "secret", "VA456", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    assert provider.check("+201012345678", "654321") is False
    with pytest.raises(OTPProviderError) as raised:
        provider.start("+201012345678", "sms")
    assert raised.value.status_code == 503


def test_challenge_rotation_invalidates_prior_generation_and_consumes_exactly_once(db):
    phone_hash = "unit-test-phone-hash"
    check_rate_limit(db, phone_hash, "start")
    lock_challenge_generation(db, phone_hash)
    create_challenge(db, phone_hash)
    first_id = active_challenge_id(db, phone_hash)
    assert first_id

    check_rate_limit(db, phone_hash, "start")
    lock_challenge_generation(db, phone_hash)
    create_challenge(db, phone_hash)
    second_id = active_challenge_id(db, phone_hash)
    assert second_id and second_id != first_id
    assert consume_challenge(db, first_id) is False
    assert consume_challenge(db, second_id) is True
    assert consume_challenge(db, second_id) is False


def test_postgres_concurrent_first_throttle_and_challenge_generation_are_serialized():
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy import create_engine, select
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session

    from alembic import command
    from app.models import OTPChallenge, OTPThrottle
    from scripts.migrate import _alembic_config

    base = make_url(source_url)
    database_name = f"member4_otp_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    digest = "concurrent-first-phone-hash"
    try:
        command.upgrade(_alembic_config(test_url.render_as_string(hide_password=False)), "head")
        barrier = threading.Barrier(2)

        def start_request():
            with Session(engine) as db:
                barrier.wait(timeout=5)
                check_rate_limit(db, digest, "start")

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: start_request(), range(2)))
        with Session(engine) as db:
            throttle = db.get(OTPThrottle, digest)
            assert throttle is not None and throttle.starts == 2

        barrier = threading.Barrier(2)

        def open_generation():
            with Session(engine) as db:
                barrier.wait(timeout=5)
                lock_challenge_generation(db, digest)
                create_challenge(db, digest)

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: open_generation(), range(2)))
        with Session(engine) as db:
            active = list(
                db.execute(
                    select(OTPChallenge.id).where(OTPChallenge.phone_hash == digest, OTPChallenge.consumed_at.is_(None))
                ).scalars()
            )
            assert len(active) == 1
            challenge_id = active[0]

        barrier = threading.Barrier(2)

        def consume():
            with Session(engine) as db:
                barrier.wait(timeout=5)
                return consume_challenge(db, challenge_id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sum(pool.map(lambda _: consume(), range(2))) == 1
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))
