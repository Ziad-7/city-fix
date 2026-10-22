from typing import Annotated

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth import AuthContext, AuthSettings, User, require_role
from app.routers.staff_auth import router
from app.staff_auth import StaffAccount, StaffLoginContext, password_hash
from tests.memory_users import MemoryUsers


class Directory:
    def __init__(self, records):
        self.records = records

    def find_by_email(self, normalized_email):
        return self.records.get(normalized_email)


@pytest.fixture
def staff_api():
    users = MemoryUsers()
    staff_user = User("staff-1", "+201012345678", "staff", "موظف", "roads")
    citizen = User("citizen-1", "+201112345678")
    users.users = {staff_user.id: staff_user, citizen.id: citizen}
    staff_password = password_hash.hash("correct horse battery")
    directory = Directory({"admin@example.com": StaffAccount("staff-1", staff_password, "nasr-city")})
    app = FastAPI()
    app.state.auth_context = AuthContext(AuthSettings("staff-test-secret-" * 3), users)
    app.state.staff_login_context = StaffLoginContext(directory)
    app.include_router(router)

    @app.get("/staff-only")
    def staff_only(
        user: Annotated[User, Depends(require_role("staff", "admin"))],
    ):
        return {"id": user.id, "departmentId": user.department_id}

    return TestClient(app), app, staff_password


def test_staff_login_issues_role_from_database(staff_api):
    client, _, _ = staff_api
    response = client.post(
        "/auth/staff-login",
        json={"email": "ADMIN@EXAMPLE.COM", "password": "correct horse battery"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # Contract StaffSession: { userId, name, title, role, department? (Arabic name), district, token }.
    assert body == {
        "userId": "staff-1",
        "name": "موظف",
        "title": "موظف · roads",
        "role": "staff",
        "department": "roads",
        "district": "nasr-city",
        "token": body["token"],
    }
    assert client.get("/staff-only", headers={"Authorization": "Bearer " + body["token"]}).json() == {
        "id": "staff-1",
        "departmentId": "roads",
    }


@pytest.mark.parametrize(
    "body",
    [
        {"email": "missing@example.com", "password": "no"},
        {"email": "admin@example.com", "password": "wrong"},
        {"email": "admin@example.com", "password": ""},
        {"email": "not-an-email", "password": "wrong"},
    ],
)
def test_staff_login_rejects_invalid_credentials(staff_api, body):
    client, _, _ = staff_api
    response = client.post("/auth/staff-login", json=body)
    assert response.status_code in (401, 422)
    assert "correct horse" not in response.text


def test_staff_login_rate_limit(staff_api):
    client, _, _ = staff_api
    bad = {"email": "admin@example.com", "password": "wrong"}
    for _ in range(5):
        assert client.post("/auth/staff-login", json=bad).status_code == 401
    limited = client.post(
        "/auth/staff-login",
        json={"email": "admin@example.com", "password": "correct horse battery"},
    )
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"


def test_staff_endpoint_unavailable_until_directory_configured():
    app = FastAPI()
    app.state.auth_context = AuthContext(AuthSettings("another-test-secret-" * 2), MemoryUsers())
    app.include_router(router)
    response = TestClient(app).post("/auth/staff-login", json={"email": "admin@example.com", "password": "secret"})
    assert response.status_code == 503
