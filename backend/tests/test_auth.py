from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.auth import (
    AuthContext,
    AuthSettings,
    User,
    current_user,
    require_department,
    require_role,
)
from app.auth_demo import MemoryUsers, create_app
from app.routers.auth import router


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
    assert set(body) == {"userId", "phone", "name", "token"}
    assert body["phone"] == "+201012345678"
    assert login(client).json()["userId"] == body["userId"]
    assert len(users.users) == 1
    headers = {"Authorization": "Bearer " + body["token"]}
    assert client.get("/private", headers=headers).json() == {"id": body["userId"]}
    assert client.get("/admin", headers=headers).status_code == 403


@pytest.mark.parametrize(
    "phone", ["011", "+201012345678", "01312345678", "01012345678\n"]
)
def test_invalid_phones(setup, phone):
    client, users, _ = setup
    assert (
        client.post("/auth/verify", json={"phone": phone, "code": "123456"}).status_code
        == 422
    )
    assert not users.users


def test_wrong_code_and_channel(setup):
    client, users, _ = setup
    assert (
        client.post(
            "/auth/verify", json={"phone": "01012345678", "code": "000000"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/auth/otp", json={"phone": "01012345678", "channel": "email"}
        ).status_code
        == 422
    )
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
    assert (
        client.get(
            "/private", headers={"Authorization": header} if header else {}
        ).status_code
        == 401
    )


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


def test_demo_disabled_by_default(setup, monkeypatch):
    client, users, settings = setup
    client.app.state.auth_context = AuthContext(
        replace(settings, demo_otp=False), users
    )
    assert login(client).status_code == 503
    assert (
        client.post(
            "/auth/otp", json={"phone": "01012345678", "channel": "sms"}
        ).status_code
        == 503
    )
    monkeypatch.delenv("OTP_MODE", raising=False)
    with pytest.raises(RuntimeError):
        create_app()
    monkeypatch.setenv("OTP_MODE", "demo")
    assert login(TestClient(create_app())).status_code == 200


def test_invalid_settings():
    with pytest.raises(ValueError):
        AuthSettings(jwt_secret="short")
    with pytest.raises(ValueError):
        AuthSettings(jwt_secret="x" * 32, token_minutes=0)
