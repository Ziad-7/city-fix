"""Final review fixes: opaque citizen ids, OTP/config guards, WO status order, scoping, merge, route sweep."""

import re

import pytest

from app.auth import AuthContext, AuthSettings, User, issue_token
from app.config import DEFAULT_JWT_SECRET, Settings, validate_settings
from app.main import app
from app.models import Incident, Profile, WorkOrder
from tests.conftest import _bearer, citizen_session


def test_citizen_ids_opaque_and_collision_free(client):
    a = citizen_session(client, "01099999999")
    b = citizen_session(client, "01199999999")
    assert a["userId"] != b["userId"]
    for s, phone in ((a, "01099999999"), (b, "01199999999")):
        assert phone[-8:] not in s["userId"]
    # same phone again resolves to the same profile
    assert citizen_session(client, "01099999999")["userId"] == a["userId"]
    # demo citizen keeps its seeded id
    assert citizen_session(client)["userId"] == "citizen-001"


def test_citizen_ids_not_leaked_via_reports(client):
    s = citizen_session(client, "01055556666")
    assert "55556666" not in s["userId"]
    assert re.fullmatch(r"citizen-[0-9a-f]{12}", s["userId"])


def test_verify_real_mode_rejects_demo_code(client):
    """Outside OTP_MODE=demo no code is accepted (real delivery is not implemented): 503, no session."""
    context = client.app.state.auth_context
    client.app.state.auth_context = AuthContext(
        AuthSettings(context.settings.jwt_secret, demo_otp=False), context.users
    )
    r = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
    assert r.status_code == 503
    assert "token" not in r.json()
    r = client.post("/auth/otp", json={"phone": "01012345678", "channel": "sms"})
    assert r.status_code == 503


def test_startup_refuses_default_secret_outside_demo():
    with pytest.raises(RuntimeError):
        validate_settings(Settings(otp_mode="real", jwt_secret=DEFAULT_JWT_SECRET))
    validate_settings(Settings(otp_mode="real", jwt_secret="x" * 40))
    validate_settings(Settings(otp_mode="demo", jwt_secret=DEFAULT_JWT_SECRET))


def test_work_order_status_cannot_move_backwards(client, admin_h):
    wo = client.get("/admin/work-orders/WO-318", headers=admin_h).json()
    assert wo["status"] in ("assigned", "in_progress")
    r = client.patch("/admin/work-orders/WO-318", json={"status": "done", "note": "تم"}, headers=admin_h)
    assert r.status_code == 200
    r = client.patch("/admin/work-orders/WO-318", json={"status": "in_progress", "note": "رجوع"}, headers=admin_h)
    assert r.status_code == 400
    assert r.json()["detail"] == "مينفعش ترجّع الحالة لورا"
    r = client.patch("/admin/work-orders/WO-318", json={"status": "done", "note": "تاني"}, headers=admin_h)
    assert r.status_code == 200


def test_staff_without_department_fails_closed(client, db):
    db.add(Profile(id="staff-x", phone=None, name="x", role="staff"))
    db.commit()
    token = issue_token(User("staff-x", "", role="staff"), client.app.state.auth_context.settings)
    h = _bearer(token)
    for path in ("/admin/incidents", "/admin/insights", "/admin/dashboard", "/incidents"):
        assert client.get(path, headers=h).status_code == 403, path


def test_staff_gets_public_shape_for_other_departments(client, roads_h, db):
    other = db.query(Incident).filter(Incident.department_id != "roads").first()
    own = db.query(Incident).filter(Incident.department_id == "roads").first()
    assert "linkedReports" not in client.get(f"/incidents/{other.id}", headers=roads_h).json()
    assert "linkedReports" in client.get(f"/incidents/{own.id}", headers=roads_h).json()
    rows = {r["id"]: r for r in client.get("/incidents", headers=roads_h).json()}
    assert "linkedReports" not in rows[other.id]
    assert "linkedReports" in rows[own.id]


def test_insights_scoped_to_staff_department(client, roads_h, admin_h):
    full = client.get("/admin/insights", headers=admin_h).json()
    scoped = client.get("/admin/insights", headers=roads_h).json()
    assert len(scoped["overdueDepartments"]) <= len(full["overdueDepartments"])
    assert set(scoped["overdueDepartments"]) <= {"صيانة الطرق"}


def _report(client, headers, lat=30.0501):
    body = {
        "categoryId": "garbage",
        "description": "زبالة متراكمة قدام العمارة من أسبوع",
        "photoUris": [],
        "location": {"lat": lat, "lng": 31.3301, "address": "شارع الاختبار، مدينة نصر"},
        "anonymous": False,
        "blurFaces": False,
    }
    return client.post("/reports", json=body, headers=headers).json()["incident"]


def test_merge_rejects_closed_or_resolved_target(client, admin_h, citizen_h, other_citizen_h):
    a = _report(client, citizen_h)
    b = _report(client, other_citizen_h)
    client.patch(f"/incidents/{a['id']}", json={"status": "resolved", "note": "تم"}, headers=admin_h)
    r = client.post(f"/admin/incidents/{b['id']}/merge", json={"intoIncidentId": a["id"]}, headers=admin_h)
    assert r.status_code == 400


def test_merge_moves_open_work_order_to_target_without_one(client, admin_h, citizen_h, other_citizen_h, db):
    a = _report(client, citizen_h)
    b = _report(client, other_citizen_h)
    wo = client.post("/admin/work-orders", json={"incidentId": b["id"], "department": "sanitation"}, headers=admin_h)
    assert wo.status_code == 200, wo.text
    wo_id = wo.json()["id"]
    r = client.post(f"/admin/incidents/{b['id']}/merge", json={"intoIncidentId": a["id"]}, headers=admin_h)
    assert r.status_code == 200
    assert r.json()["workOrderId"] == wo_id
    assert db.get(WorkOrder, wo_id).incident_id == a["id"]
    assert db.get(Incident, b["id"]).work_order_id is None


def test_merge_keeps_work_order_when_target_has_one(client, admin_h, citizen_h, other_citizen_h, db):
    a = _report(client, citizen_h)
    b = _report(client, other_citizen_h)
    wa = client.post("/admin/work-orders", json={"incidentId": a["id"], "department": "sanitation"}, headers=admin_h)
    wb = client.post("/admin/work-orders", json={"incidentId": b["id"], "department": "sanitation"}, headers=admin_h)
    r = client.post(f"/admin/incidents/{b['id']}/merge", json={"intoIncidentId": a["id"]}, headers=admin_h)
    assert r.status_code == 200
    assert r.json()["workOrderId"] == wa.json()["id"]
    assert db.get(WorkOrder, wb.json()["id"]).incident_id == b["id"]
    src = client.get(f"/admin/incidents/{b['id']}", headers=admin_h).json()
    assert wb.json()["id"] in src["timeline"][-1]["note"]


def _admin_routes():
    out = []
    for path, ops in app.openapi()["paths"].items():
        if path.startswith("/admin") or path == "/incidents/{incident_id}":
            for method in ops:
                if path.startswith("/admin") or method == "patch":
                    out.append((method.upper(), re.sub(r"\{[^}]+\}", "x", path)))
    return out


def test_every_admin_route_requires_staff(client, citizen_h):
    routes = _admin_routes()
    assert len(routes) >= 20
    for method, path in routes:
        assert client.request(method, path).status_code == 401, (method, path)
        assert client.request(method, path, headers=citizen_h).status_code == 403, (method, path)
