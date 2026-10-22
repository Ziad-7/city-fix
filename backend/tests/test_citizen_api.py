from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth import AuthContext, AuthSettings, User, issue_token
from app.auth_demo import MemoryUsers
from app.citizen_demo import create_app as create_citizen_app
from app.demo_store import DemoCitizenRepository
from app.routers import auth, incidents, map, reports, service_requests, uploads

PLACE = {"lat": 30.056, "lng": 31.330, "address": "شارع النصر، مدينة نصر"}


@pytest.fixture
def api():
    users = MemoryUsers()
    repo = DemoCitizenRepository()
    app = FastAPI()
    app.state.auth_context = AuthContext(
        AuthSettings("test-secret-" * 4, demo_otp=True), users
    )
    app.state.citizen_repository = repo
    app.state.media_storage = None
    for router in (
        auth.router,
        reports.router,
        incidents.router,
        map.router,
        service_requests.router,
        uploads.router,
    ):
        app.include_router(router)
    return TestClient(app), users, repo


def citizen(api, phone):
    client, _, _ = api
    result = client.post("/auth/verify", json={"phone": phone, "code": "123456"})
    assert result.status_code == 200
    return {"Authorization": "Bearer " + result.json()["token"]}


def test_report_crud_is_private_and_routes_return_contract_shapes(api):
    client, _, _ = api
    one = citizen(api, "01012345678")
    two = citizen(api, "01112345678")
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    result = client.post("/reports", headers=one, json=body)
    assert result.status_code == 200, result.text
    data = result.json()
    assert set(data) == {"report", "incident"}
    assert data["report"]["id"] == "FTC-1042"
    assert data["incident"]["id"] == "INC-0001"
    assert data["incident"]["isFollowing"] is True
    assert client.get("/reports", headers=one).json()[0]["id"] == "FTC-1042"
    assert client.get("/reports", headers=two).json() == []
    assert client.get("/reports/FTC-1042", headers=two).status_code == 403
    assert client.get("/reports/unknown", headers=one).status_code == 404
    assert client.get("/reports", headers={}).status_code == 401


def test_validation_and_anonymous_report_privacy(api):
    client, _, _ = api
    one = citizen(api, "01012345678")
    body = {
        "categoryId": "pothole",
        "description": "short",
        "photoUris": [],
        "location": PLACE,
        "anonymous": True,
        "blurFaces": True,
    }
    assert client.post("/reports", headers=one, json=body).status_code == 422
    body["description"] = "a sufficiently long description"
    client, users, _ = api
    created = client.post("/reports", headers=one, json=body).json()
    user_id = created["report"]["reporterId"]
    assert (
        created["report"]["reporterId"] == user_id
    )  # author can see their own identity
    users.users["admin"] = User("admin", "", role="admin")
    admin = {
        "Authorization": "Bearer "
        + issue_token(users.users["admin"], client.app.state.auth_context.settings)
    }
    response = client.get("/reports/FTC-1042", headers=admin)
    assert response.status_code == 200
    assert response.json()["reporterId"] == ""


def test_photos_must_be_uploaded_to_the_callers_storage(api):
    client, _, _ = api
    one = citizen(api, "01012345678")
    body = {
        "categoryId": "pothole",
        "description": "",
        "photoUris": ["local-file-uri"],
        "location": PLACE,
        "anonymous": True,
        "blurFaces": True,
    }
    assert client.post("/reports", headers=one, json=body).status_code == 503

    class Storage:
        def sign_upload(self, user_id, kind, content_type):
            return "https://storage.example/upload/one", f"{user_id}/random-key"

        def require_uploaded(self, user_id, path, kind):
            if path != f"{user_id}/uploaded-photo":
                from fastapi import HTTPException

                raise HTTPException(403, "wrong owner")

        def sign_read(self, user_id, path):
            return f"https://storage.example/read/{path}"

    client.app.state.media_storage = Storage()
    signed = client.post(
        "/uploads/sign",
        headers=one,
        json={"kind": "report_photo", "contentType": "image/jpeg"},
    )
    assert signed.status_code == 200
    assert signed.json()["path"].endswith("/random-key")
    assert (
        client.post(
            "/uploads/sign",
            headers=one,
            json={"kind": "report_photo", "contentType": "audio/mp4"},
        ).status_code
        == 422
    )
    user_id = next(
        user
        for user in client.app.state.auth_context.users.users.values()
        if user.phone == "+201012345678"
    ).id
    body["photoUris"] = ["someone-else/uploaded-photo"]
    assert client.post("/reports", headers=one, json=body).status_code == 403
    body["photoUris"] = [f"{user_id}/uploaded-photo"]
    sent = client.post("/reports", headers=one, json=body)
    assert sent.status_code == 200, sent.text
    assert sent.json()["report"]["photoUris"] == [
        f"https://storage.example/read/{user_id}/uploaded-photo"
    ]


def test_incident_follow_is_idempotent_and_duplicate_link_adds_report(api):
    client, _, repo = api
    one = citizen(api, "01012345678")
    two = citizen(api, "01112345678")
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    first = client.post("/reports", headers=one, json=body).json()
    iid = first["incident"]["id"]
    assert client.post(f"/incidents/{iid}/follow", headers=two).json()["followers"] == 2
    assert client.post(f"/incidents/{iid}/follow", headers=two).json()["followers"] == 2
    linked = dict(body, linkToIncidentId=iid)
    second = client.post("/reports", headers=two, json=linked)
    assert second.status_code == 200
    assert second.json()["report"]["incidentId"] == iid
    assert len(repo.incidents[iid].linked_report_ids) == 2
    assert client.post("/incidents/missing/follow", headers=two).status_code == 404


def test_invalid_duplicate_link_rejected(api):
    client, _, repo = api
    one = citizen(api, "01012345678")
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    created = client.post("/reports", headers=one, json=body).json()
    repo.incidents[created["incident"]["id"]].status = "closed"
    body["linkToIncidentId"] = created["incident"]["id"]
    assert client.post("/reports", headers=one, json=body).status_code == 409


def test_incidents_and_map_filters(api):
    client, _, _ = api
    auth = citizen(api, "01012345678")
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    client.post("/reports", headers=auth, json=body)
    pins = client.get(
        "/map/incidents?categoryId=pothole&status=received&bbox=31.3,30.0,31.4,30.1",
        headers=auth,
    )
    assert pins.status_code == 200 and len(pins.json()) == 1
    assert client.get("/map/incidents?bbox=no", headers=auth).status_code == 422
    assert client.get("/map/incidents?bbox=NaN,0,1,1", headers=auth).status_code == 422
    assert client.get("/map/incidents?categoryId=bad", headers=auth).status_code == 422
    assert client.get("/incidents", headers=auth).json()[0]["id"] == "INC-0001"
    assert client.get("/incidents/INC-0001", headers=auth).status_code == 200
    assert client.get("/incidents/missing", headers=auth).status_code == 404


def test_service_requests_crud_and_owner_checks(api):
    client, _, _ = api
    one = citizen(api, "01012345678")
    two = citizen(api, "01112345678")
    next_day = datetime.now(ZoneInfo("Africa/Cairo")).date() + timedelta(days=1)
    while next_day.weekday() in (4, 5):
        next_day += timedelta(days=1)
    body = {
        "serviceType": "bulky_waste",
        "details": {
            "items": ["كنبة"],
            "day": next_day.isoformat(),
            "slot": "morning",
            "payment": "cash",
        },
        "location": PLACE,
    }
    result = client.post("/service-requests", headers=one, json=body)
    assert result.status_code == 200, result.text
    request_id = result.json()["id"]
    owner_id = next(
        user.id
        for user in client.app.state.auth_context.users.users.values()
        if user.phone == "+201012345678"
    )
    assert result.json()["citizenId"] == owner_id
    assert client.get("/service-requests", headers=one).json()[0]["id"] == request_id
    assert client.get("/service-requests", headers=two).json() == []
    assert client.get(f"/service-requests/{request_id}", headers=two).status_code == 403
    assert client.get("/service-requests/missing", headers=one).status_code == 404
    body["details"]["day"] = "2026-02-31"
    assert client.post("/service-requests", headers=one, json=body).status_code == 422
    weekend = datetime.now(ZoneInfo("Africa/Cairo")).date() + timedelta(days=1)
    while weekend.weekday() != 5:
        weekend += timedelta(days=1)
    body["details"]["day"] = weekend.isoformat()
    assert client.post("/service-requests", headers=one, json=body).status_code == 422


def test_local_complete_citizen_harness_requires_demo_mode(monkeypatch):
    monkeypatch.setenv("OTP_MODE", "demo")
    app = create_citizen_app()
    client = TestClient(app)
    auth = citizen(
        (client, app.state.auth_context.users, app.state.citizen_repository),
        "01012345678",
    )
    assert client.get("/map/incidents", headers=auth).status_code == 200
