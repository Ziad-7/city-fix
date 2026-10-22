"""Admins and department staff must see the photos of the reports linked to an incident.

Uses the real ``SupabaseMediaStorage`` against an ``httpx.MockTransport`` fake of Supabase Storage,
so the owner-scoped path checks (``<user_id>/<key>``) are the production ones.
"""

import httpx

from app.storage import SupabaseMediaStorage
from tests.conftest import _bearer, citizen_session

PLACE = {"lat": 30.056, "lng": 31.330, "address": "شارع النصر، مدينة نصر"}
PHONE = "01123456791"


def fake_supabase(store: dict[str, bytes]):
    def handle(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/bucket/report-media"):
            return httpx.Response(200, json={"id": "report-media", "public": False})
        if "/object/sign/report-media/" in path:
            key = path.split("/object/sign/report-media/", 1)[1]
            if key not in store:
                return httpx.Response(404, json={"error": "not_found"})
            return httpx.Response(200, json={"signedURL": f"/object/sign/report-media/{key}?token=read"})
        if "/object/report-media/" in path and request.method == "HEAD":
            key = path.split("/object/report-media/", 1)[1]
            if key not in store:
                return httpx.Response(404)
            return httpx.Response(200, headers={"content-type": "image/jpeg", "content-length": str(len(store[key]))})
        return httpx.Response(400)

    return SupabaseMediaStorage("https://project.supabase.co", "test-key", transport=httpx.MockTransport(handle))


def _report_with_photo(client, store):
    session = citizen_session(client, PHONE)
    user_id = session["userId"]
    key = f"{user_id}/photo1.jpg"
    store[key] = b"\xff\xd8 jpeg bytes"
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": [key],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    created = client.post("/reports", headers=_bearer(session["token"]), json=body)
    assert created.status_code == 200, created.text
    return created.json(), key


def test_admin_incident_detail_has_signed_photo_urls(client, admin_h):
    store: dict[str, bytes] = {}
    client.app.state.media_storage = fake_supabase(store)
    created, key = _report_with_photo(client, store)
    incident_id = created["incident"]["id"]

    detail = client.get(f"/admin/incidents/{incident_id}", headers=admin_h)
    assert detail.status_code == 200, detail.text
    linked = {r["id"]: r for r in detail.json()["linkedReports"]}
    entry = linked[created["report"]["id"]]
    assert entry["photoCount"] == 1
    assert entry["photoUrls"] == [f"https://project.supabase.co/storage/v1/object/sign/report-media/{key}?token=read"]


def test_admin_reads_a_citizen_report_with_signed_photos(client, admin_h):
    """GET /reports/{id} by an admin used to 503: paths were signed against the admin's id."""
    store: dict[str, bytes] = {}
    client.app.state.media_storage = fake_supabase(store)
    created, key = _report_with_photo(client, store)

    response = client.get(f"/reports/{created['report']['id']}", headers=admin_h)
    assert response.status_code == 200, response.text
    assert response.json()["photoUris"][0].endswith(f"/report-media/{key}?token=read")


def test_unsignable_legacy_paths_are_skipped_not_fatal(client, admin_h, db):
    """Stub-era paths (``photos/<user>/...``) cannot be signed; the detail must still load."""
    from app.models import Report

    store: dict[str, bytes] = {}
    client.app.state.media_storage = fake_supabase(store)
    created, key = _report_with_photo(client, store)
    report = db.get(Report, created["report"]["id"])
    report.photo_paths = [f"photos/{report.reporter_id}/old.jpg", key]
    db.commit()

    detail = client.get(f"/admin/incidents/{created['incident']['id']}", headers=admin_h)
    assert detail.status_code == 200
    entry = next(r for r in detail.json()["linkedReports"] if r["id"] == report.id)
    assert len(entry["photoUrls"]) == 1 and entry["photoUrls"][0].endswith("?token=read")


def test_other_department_staff_cannot_read_photos(client, roads_h, db):
    from app.models import Incident

    store: dict[str, bytes] = {}
    client.app.state.media_storage = fake_supabase(store)
    created, _ = _report_with_photo(client, store)
    incident = db.get(Incident, created["incident"]["id"])
    incident.department_id = "electricity"
    db.commit()
    assert client.get(f"/admin/incidents/{incident.id}", headers=roads_h).status_code == 403


def test_local_demo_without_storage_returns_paths(client, admin_h):
    client.app.state.media_storage = None
    session = citizen_session(client, PHONE)
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة أمام المدرسة",
        "photoUris": ["photos/x/1.jpg"],
        "location": PLACE,
        "anonymous": False,
        "blurFaces": True,
    }
    created = client.post("/reports", headers=_bearer(session["token"]), json=body).json()
    detail = client.get(f"/admin/incidents/{created['incident']['id']}", headers=admin_h).json()
    entry = next(r for r in detail["linkedReports"] if r["id"] == created["report"]["id"])
    assert entry["photoUrls"] == ["photos/x/1.jpg"]
