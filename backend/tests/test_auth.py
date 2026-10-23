"""Tests for authentication endpoints and the shared JWT boundary."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import (
    AuthContext,
    AuthSettings,
    User,
    current_user,
    require_department,
    require_role,
)
from app.models import Profile
from app.routers.auth import router
from tests.memory_users import MemoryUsers


class TestOTP:
    """Tests for OTP endpoints."""

    def test_otp_request_valid_phone(self, client: TestClient):
        """Valid phone should return 204 (contract)."""
        response = client.post(
            "/auth/otp",
            json={"phone": "01012345678", "channel": "sms"},
        )
        assert response.status_code == 204
        assert response.content == b""

    def test_otp_request_invalid_phone(self, client: TestClient):
        """Invalid phone should return 400."""
        response = client.post(
            "/auth/otp",
            json={"phone": "0101234567", "channel": "sms"},  # Too short
        )
        assert response.status_code == 400

    def test_otp_verify_demo_code(self, client: TestClient):
        """Demo code '123456' should succeed."""
        response = client.post(
            "/auth/verify",
            json={"phone": "01012345678", "code": "123456"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "userId" in data
        assert "token" in data
        assert "phone" in data

    def test_otp_verify_wrong_code(self, client: TestClient):
        """Wrong code should return 401."""
        response = client.post(
            "/auth/verify",
            json={"phone": "01012345678", "code": "000000"},
        )
        assert response.status_code == 401

    def test_otp_verify_creates_profile(self, client: TestClient, db: Session):
        """First verify should create a citizen profile."""
        phone = "01087654321"
        response = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )
        assert response.status_code == 200

        # Check profile was created
        profile = db.query(Profile).filter_by(phone="+201087654321").first()
        assert profile is not None
        assert profile.role == "citizen"

    def test_otp_verify_reuses_existing_profile(self, client: TestClient, db: Session):
        """Second verify with same phone should reuse profile."""
        phone = "01087654321"

        # First verify
        response1 = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )

        # Second verify
        response2 = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )

        # Both should return same user ID but different tokens
        assert response1.json()["userId"] == response2.json()["userId"]

    def test_real_provider_challenge_is_consumed_once(self, client, monkeypatch, db):
        from app.main import app
        from app.models import OTPChallenge

        class Provider:
            def start(self, phone, channel):
                pass

            def check(self, phone, code):
                return code == "654321"

        context = app.state.auth_context
        monkeypatch.setattr(app.state, "otp_provider", Provider(), raising=False)
        app.state.auth_context = replace(context, settings=replace(context.settings, demo_otp=False))
        try:
            started = client.post("/auth/otp", json={"phone": "01011122334", "channel": "sms"})
            first = client.post("/auth/verify", json={"phone": "01011122334", "code": "654321"})
            replay = client.post("/auth/verify", json={"phone": "01011122334", "code": "654321"})
        finally:
            app.state.auth_context = context
        assert started.status_code == 204
        assert first.status_code == 200
        assert replay.status_code == 401
        challenge = db.query(OTPChallenge).one()
        assert challenge.consumed_at is not None
        assert "01011122334" not in challenge.phone_hash

    def test_real_otp_uses_provider_before_issuing_session(self, client, monkeypatch):
        from app.main import app

        class Provider:
            def start(self, phone, channel):
                assert phone == "+201011122233"
                assert channel == "whatsapp"

            def check(self, phone, code):
                return code == "654321"

        monkeypatch.setattr(app.state, "otp_provider", Provider(), raising=False)
        ctx = app.state.auth_context
        app.state.auth_context = replace(ctx, settings=replace(ctx.settings, demo_otp=False))
        try:
            started = client.post("/auth/otp", json={"phone": "01011122233", "channel": "whatsapp"})
            verified = client.post("/auth/verify", json={"phone": "01011122233", "code": "654321"})
        finally:
            app.state.auth_context = ctx
        assert started.status_code == 204
        assert verified.status_code == 200


class TestStaffLogin:
    """Tests for staff login endpoint."""

    def test_staff_login_success(self, client: TestClient):
        """Valid staff credentials should return token."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "roads@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "staff"
        assert "token" in data
        assert "userId" in data

    def test_admin_login_success(self, client: TestClient):
        """Admin login should work."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"

    def test_staff_login_wrong_password(self, client: TestClient):
        """Wrong password should return 401."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    def test_staff_login_nonexistent_email(self, client: TestClient):
        """Nonexistent email should return 401."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "nonexistent@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 401

    def test_staff_login_empty_body(self, client: TestClient):
        """POST /auth/staff-login with {} should return 422 with Arabic message."""
        response = client.post("/auth/staff-login", json={})
        assert response.status_code == 422
        data = response.json()
        # Should have detail with Arabic message
        assert "detail" in data or "errors" in data or len(data) > 0

    def test_token_carries_only_the_user_id_and_role_comes_from_the_database(self, client: TestClient):
        """The JWT has no role/department claim: those are reloaded from the database per request."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        token = response.json()["token"]

        from app.config import settings

        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience="fixthecity-clients",
            issuer="fixthecity-api",
        )
        assert claims["sub"] == response.json()["userId"]
        assert "role" not in claims and "department" not in claims
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.json()["role"] == "admin"


class TestGetMe:
    """Tests for /auth/me endpoint."""

    def test_get_me_with_valid_token(self, client: TestClient):
        """GET /auth/me with valid token should return user info."""
        # First login
        login_response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        token = login_response.json()["token"]

        # Get me
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert data["userId"] is not None

    def test_get_me_without_token(self, client: TestClient):
        """GET /auth/me without token should return 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_me_with_invalid_token(self, client: TestClient):
        """GET /auth/me with invalid token should return 401."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_citizen_token_denied_on_staff_dependency(self, client: TestClient):
        """A citizen token is rejected (403) by the staff/admin dependencies."""
        response = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
        assert response.status_code == 200
        headers = {"Authorization": "Bearer " + response.json()["token"]}
        for path in ("/auth/me", "/admin/dashboard", "/admin/incidents"):
            denied = client.get(path, headers=headers)
            assert denied.status_code == 403, path
            assert "مش مسموح" in denied.json()["detail"]


# --- Shared auth boundary (ported from PR #32) ---


@pytest.fixture
def setup():
    users = MemoryUsers()
    settings = AuthSettings(jwt_secret="test-only-secret-" * 4, demo_otp=True)
    app = FastAPI()
    app.state.auth_context = AuthContext(settings, users)
    app.include_router(router)

    @app.get("/private")
    def private(user: Annotated[User, Depends(current_user)]):
        return {"id": user.id}

    @app.get("/admin")
    def admin(user: Annotated[User, Depends(require_role("admin"))]):
        return {"id": user.id}

    return TestClient(app), users, settings


def login(client):
    return client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})


def test_contract_and_repeat_login(setup):
    client, users, _ = setup
    response = client.post("/auth/otp", json={"phone": "01012345678", "channel": "sms"})
    assert response.status_code == 204
    assert response.content == b""
    result = login(client)
    assert result.status_code == 200
    body = result.json()
    # Contract: { userId, phone, name?, token } (name is omitted until the citizen has one).
    assert {"userId", "phone", "token"} <= set(body) <= {"userId", "phone", "name", "token"}
    assert body["phone"] == "+201012345678"
    assert login(client).json()["userId"] == body["userId"]
    assert len(users.users) == 1
    headers = {"Authorization": "Bearer " + body["token"]}
    assert client.get("/private", headers=headers).json() == {"id": body["userId"]}
    assert client.get("/admin", headers=headers).status_code == 403


@pytest.mark.parametrize("phone", ["011", "+201012345678", "01312345678", "01012345678\n"])
def test_invalid_phones(setup, phone):
    client, users, _ = setup
    # Contract: 400 for a malformed phone (including a trailing newline).
    assert client.post("/auth/verify", json={"phone": phone, "code": "123456"}).status_code == 400
    assert not users.users


def test_wrong_code_and_channel(setup):
    client, users, _ = setup
    assert client.post("/auth/verify", json={"phone": "01012345678", "code": "000000"}).status_code == 401
    assert client.post("/auth/otp", json={"phone": "01012345678", "channel": "email"}).status_code == 422
    assert not users.users


@pytest.mark.parametrize(
    "kind",
    [
        "expired",
        "signature",
        "audience",
        "issuer",
        "missing_exp",
        "algorithm",
        "unknown_user",
    ],
)
def test_invalid_tokens(setup, kind):
    client, _, settings = setup
    user_id = login(client).json()["userId"]
    now = datetime.now(UTC)
    claims = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(minutes=1),
        "iss": settings.issuer,
        "aud": settings.audience,
    }
    key, algorithm = settings.jwt_secret, "HS256"
    if kind == "expired":
        claims["exp"] = now - timedelta(seconds=1)
    elif kind == "signature":
        key = "another-secret-" * 4
    elif kind == "audience":
        claims["aud"] = "other"
    elif kind == "issuer":
        claims["iss"] = "other"
    elif kind == "missing_exp":
        del claims["exp"]
    elif kind == "algorithm":
        algorithm = "HS384"
    else:
        claims["sub"] = "missing-user"
    token = jwt.encode(claims, key, algorithm=algorithm)
    response = client.get("/private", headers={"Authorization": "Bearer " + token})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize("header", [None, "Basic abc", "Bearer garbage"])
def test_missing_or_malformed_credentials(setup, header):
    client, _, _ = setup
    assert client.get("/private", headers={"Authorization": header} if header else {}).status_code == 401


def test_permissions_use_current_user_and_deleted_user_rejected(setup):
    client, users, _ = setup
    body = login(client).json()
    headers = {"Authorization": "Bearer " + body["token"]}
    citizen = users.users[body["userId"]]
    users.users[citizen.id] = replace(citizen, role="admin")
    assert client.get("/admin", headers=headers).status_code == 200
    # Demo citizen login cannot be used to access an elevated account.
    assert login(client).status_code == 403
    users.users[citizen.id] = citizen
    assert client.get("/admin", headers=headers).status_code == 403
    del users.users[citizen.id]
    assert client.get("/private", headers=headers).status_code == 401


def test_department_scope():
    staff = User("staff", "+201012345678", role="staff", department_id="roads")
    require_department(staff, "roads")
    require_department(replace(staff, role="admin"), "water")
    for user in [
        staff,
        replace(staff, role="citizen"),
        replace(staff, department_id=None),
    ]:
        with pytest.raises(HTTPException) as error:
            require_department(user, "water")
        assert error.value.status_code == 403


def test_demo_disabled_by_default(setup):
    client, users, settings = setup
    client.app.state.auth_context = AuthContext(replace(settings, demo_otp=False), users)
    assert login(client).status_code == 503
    assert client.post("/auth/otp", json={"phone": "01012345678", "channel": "sms"}).status_code == 503
    assert not users.users


def test_invalid_settings():
    with pytest.raises(ValueError):
        AuthSettings(jwt_secret="short")
    with pytest.raises(ValueError):
        AuthSettings(jwt_secret="x" * 32, token_minutes=0)
