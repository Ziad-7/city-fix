"""Citizen API behaviour (ported from PR #32), run against the real database-backed app.

PR #32 exercised an in-memory demo repository; the same assertions now run through the final
routers. Where the contract differs from that harness, the contract wins (noted inline).
"""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

from app.models import Incident
from tests.conftest import _bearer, citizen_session

PLACE = {"lat": 30.056, "lng": 31.330, "address": "شارع النصر، مدينة نصر"}
# Fresh citizens (the demo number 01012345678 already owns seeded reports).
ONE = "01123456781"
TWO = "01123456782"


def citizen(client, phone):
    return _bearer(citizen_session(client, phone)["token"])


def report_body(**overrides):
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    body.update(overrides)
    return body


def test_report_crud_is_private_and_routes_return_contract_shapes(client):
    one, two = citizen(client, ONE), citizen(client, TWO)
    result = client.post("/reports", headers=one, json=report_body())
    assert result.status_code == 200, result.text
    data = result.json()
    assert set(data) == {"report", "incident"}
    report_id = data["report"]["id"]
    assert report_id.startswith("FTC-")
    assert data["incident"]["id"].startswith("INC-")
    assert data["incident"]["isFollowing"] is True
    assert [r["id"] for r in client.get("/reports", headers=one).json()] == [report_id]
    assert client.get("/reports", headers=two).json() == []
    assert client.get(f"/reports/{report_id}", headers=two).status_code == 403
    assert client.get("/reports/unknown", headers=one).status_code == 404
    assert client.get("/reports", headers={}).status_code == 401


def test_validation_and_anonymous_report_privacy(client, admin_h):
    one = citizen(client, ONE)
    body = report_body(description="short", anonymous=True)
    # Contract: 400 for a report with neither a photo nor a description (this API's validation code).
    assert client.post("/reports", headers=one, json=body).status_code == 400
    body["description"] = "a sufficiently long description"
    created = client.post("/reports", headers=one, json=body).json()
    report_id = created["report"]["id"]
    author = created["report"]["reporterId"]
    assert author  # the author can see their own identity
    assert client.get(f"/reports/{report_id}", headers=one).json()["reporterId"] == author
    response = client.get(f"/reports/{report_id}", headers=admin_h)
    assert response.status_code == 200
    assert response.json()["reporterId"] == ""


class Storage:
    def sign_upload(self, user_id, kind, content_type):
        return "https://storage.example/upload/one", f"{user_id}/random-key"

    def require_uploaded(self, user_id, path, kind):
        if path != f"{user_id}/uploaded-photo":
            raise HTTPException(403, "wrong owner")

    def sign_read(self, user_id, path):
        return f"https://storage.example/read/{path}"


def test_photos_must_be_uploaded_to_the_callers_storage(client):
    session = citizen_session(client, ONE)
    one = _bearer(session["token"])
    user_id = session["userId"]
    body = report_body(description="", photoUris=["local-file-uri"], anonymous=True)

    # Contract: without a configured storage the local upload stub is in use and non-URL values
    # are accepted as already-uploaded paths (PR #32's in-memory harness answered 503 here).
    assert client.post("/reports", headers=one, json=body).status_code == 200

    client.app.state.media_storage = Storage()
    signed = client.post("/uploads/sign", headers=one, json={"kind": "report_photo", "contentType": "image/jpeg"})
    assert signed.status_code == 200
    assert signed.json()["path"].endswith("/random-key")
    assert signed.json()["uploadUrl"] == "https://storage.example/upload/one"
    mismatch = client.post("/uploads/sign", headers=one, json={"kind": "report_photo", "contentType": "audio/mp4"})
    assert mismatch.status_code in (400, 422)  # contract: 400 validation

    body["photoUris"] = ["someone-else/uploaded-photo"]
    assert client.post("/reports", headers=one, json=body).status_code == 403
    body["photoUris"] = [f"{user_id}/uploaded-photo"]
    sent = client.post("/reports", headers=one, json=body)
    assert sent.status_code == 200, sent.text
    assert sent.json()["report"]["photoUris"] == [f"https://storage.example/read/{user_id}/uploaded-photo"]
    listed = client.get("/reports", headers=one).json()
    assert listed[0]["photoUris"] == [f"https://storage.example/read/{user_id}/uploaded-photo"]


def test_incident_follow_is_idempotent_and_duplicate_link_adds_report(client):
    one, two = citizen(client, ONE), citizen(client, TWO)
    first = client.post("/reports", headers=one, json=report_body()).json()
    iid = first["incident"]["id"]
    assert client.post(f"/incidents/{iid}/follow", headers=two).json()["followers"] == 2
    assert client.post(f"/incidents/{iid}/follow", headers=two).json()["followers"] == 2
    second = client.post("/reports", headers=two, json=report_body(linkToIncidentId=iid))
    assert second.status_code == 200, second.text
    assert second.json()["report"]["incidentId"] == iid
    assert len(client.get(f"/incidents/{iid}", headers=two).json()["linkedReportIds"]) == 2
    assert client.post("/incidents/missing/follow", headers=two).status_code == 404


def test_invalid_duplicate_link_rejected(client, db):
    one = citizen(client, ONE)
    created = client.post("/reports", headers=one, json=report_body()).json()
    iid = created["incident"]["id"]
    incident = db.get(Incident, iid)

    far = report_body(linkToIncidentId=iid, location=dict(PLACE, lat=30.2))
    assert client.post("/reports", headers=one, json=far).status_code == 409
    other_category = report_body(linkToIncidentId=iid, categoryId="garbage")
    assert client.post("/reports", headers=one, json=other_category).status_code == 409

    incident.status = "closed"
    db.commit()
    assert client.post("/reports", headers=one, json=report_body(linkToIncidentId=iid)).status_code == 409
    assert client.post("/reports", headers=one, json=report_body(linkToIncidentId="INC-9999")).status_code == 404


def test_incidents_and_map_filters(client):
    auth = citizen(client, ONE)
    created = client.post("/reports", headers=auth, json=report_body()).json()
    iid = created["incident"]["id"]
    pins = client.get("/map/incidents?categoryId=pothole&status=received&bbox=31.3,30.0,31.4,30.1", headers=auth)
    assert pins.status_code == 200
    assert iid in {p["id"] for p in pins.json()}
    # Malformed or out-of-range bounds: contract 400 (PR #32's harness answered 422).
    assert client.get("/map/incidents?bbox=no", headers=auth).status_code == 400
    assert client.get("/map/incidents?bbox=NaN,0,1,1", headers=auth).status_code == 400
    assert client.get("/map/incidents?bbox=0,0,200,1", headers=auth).status_code == 400
    assert client.get("/map/incidents?categoryId=bad", headers=auth).status_code == 422
    assert client.get("/map/incidents?status=bad", headers=auth).status_code == 422
    assert client.get("/incidents", headers=auth).json()[0]["id"] == iid
    assert client.get(f"/incidents/{iid}", headers=auth).status_code == 200
    assert client.get("/incidents/missing", headers=auth).status_code == 404


def test_service_requests_crud_and_owner_checks(client):
    one, two = citizen(client, ONE), citizen(client, TWO)
    next_day = datetime.now(ZoneInfo("Africa/Cairo")).date() + timedelta(days=1)
    while next_day.weekday() in (4, 5):
        next_day += timedelta(days=1)
    body = {
        "serviceType": "bulky_waste",
        "details": {"items": ["كنبة"], "day": next_day.isoformat(), "slot": "morning", "payment": "cash"},
        "location": PLACE,
    }
    result = client.post("/service-requests", headers=one, json=body)
    assert result.status_code == 200, result.text
    request_id = result.json()["id"]
    assert result.json()["citizenId"] == citizen_session(client, ONE)["userId"]
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
    body["details"]["day"] = datetime.now(ZoneInfo("Africa/Cairo")).date().isoformat()
    assert client.post("/service-requests", headers=one, json=body).status_code == 422


@pytest.mark.parametrize("path", ["/reports", "/incidents", "/map/incidents", "/service-requests"])
def test_citizen_routes_require_a_token(client, path):
    assert client.get(path).status_code == 401
