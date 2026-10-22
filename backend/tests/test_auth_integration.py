"""Integration checks for the shared database-backed authentication setup."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Profile


def test_citizen_login_persists_profile_and_returns_reusable_session(
    client: TestClient, db: Session
) -> None:
    otp = client.post("/auth/otp", json={"phone": "01012345678", "channel": "sms"})
    assert otp.status_code == 204

    first = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
    assert first.status_code == 200
    user_id = first.json()["userId"]
    assert db.query(Profile).filter_by(id=user_id, role="citizen").one()

    second = client.post(
        "/auth/verify", json={"phone": "01012345678", "code": "123456"}
    )
    assert second.status_code == 200
    assert second.json()["userId"] == user_id


def test_staff_login_and_me_use_persisted_role_and_department(
    client: TestClient,
) -> None:
    login = client.post(
        "/auth/staff-login",
        json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
    )
    assert login.status_code == 200
    session = login.json()
    assert session["role"] == "staff"
    assert session["departmentId"] == "roads"

    current = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {session['token']}"}
    )
    assert current.status_code == 200
    assert current.json()["userId"] == session["userId"]
    assert current.json()["departmentId"] == "roads"
