"""Integration checks for the shared database-backed authentication setup."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Profile, StaffAccount


def test_citizen_login_persists_profile_and_returns_reusable_session(client: TestClient, db: Session) -> None:
    otp = client.post("/auth/otp", json={"phone": "01012345678", "channel": "sms"})
    assert otp.status_code == 204

    first = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
    assert first.status_code == 200
    user_id = first.json()["userId"]
    assert db.query(Profile).filter_by(id=user_id, role="citizen").one()

    second = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
    assert second.status_code == 200
    assert second.json()["userId"] == user_id


def test_staff_login_and_me_use_persisted_role_and_department(
    client: TestClient,
) -> None:
    login = client.post(
        "/auth/staff-login",
        json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
    )
    assert login.status_code == 200
    session = login.json()
    assert session["role"] == "staff"
    # Contract StaffSession.department is the Arabic department name.
    assert session["department"] == "صيانة الطرق"

    current = client.get("/auth/me", headers={"Authorization": f"Bearer {session['token']}"})
    assert current.status_code == 200
    assert current.json()["userId"] == session["userId"]
    assert current.json()["department"] == "صيانة الطرق"
    assert "token" not in current.json()


def _roads_headers(client: TestClient) -> dict:
    login = client.post("/auth/staff-login", json={"email": "roads@cityfix.demo", "password": "FixCity2026!"})
    return {"Authorization": f"Bearer {login.json()['token']}"}


def test_role_and_department_changes_apply_immediately_to_existing_tokens(client: TestClient, db: Session) -> None:
    headers = _roads_headers(client)
    assert client.get("/admin/dashboard", headers=headers).status_code == 200
    account = db.query(StaffAccount).filter_by(email="roads@cityfix.demo").one()

    # Moving the account to another department changes the scope of the same token at once.
    original = account.department_id
    account.department_id = "sanitation"
    db.commit()
    me = client.get("/auth/me", headers=headers)
    assert me.json()["department"] == "هيئة النظافة والتجميل"

    # Losing the department scope fails closed.
    account.department_id = None
    db.commit()
    assert client.get("/admin/dashboard", headers=headers).status_code == 403
    account.department_id = original

    # Demoting the profile to a citizen removes staff access.
    profile = db.get(Profile, account.profile_id)
    profile.role = "citizen"
    db.commit()
    assert client.get("/admin/dashboard", headers=headers).status_code == 403
    assert client.get("/auth/me", headers=headers).status_code == 403

    # Deleting the profile invalidates the token.
    db.delete(profile)
    db.commit()
    assert client.get("/auth/me", headers=headers).status_code == 401
