"""End-to-end journeys through the real app at bulk-data scale (CI-sized: ~150 incidents, 60 pickups, 8 bins).

Each test seeds the base demo data, adds synthetic bulk rows (scripts/bench_data.py), then walks one feature
the way the clients do. No Gemini key is configured in the test app, so the AI routes answer with their
documented fallbacks.
"""

from datetime import timedelta

import pytest

from app.helpers import now_utc
from app.models import Collector, Profile
from scripts.bench_data import add_bulk

from .conftest import _bearer, citizen_session

BULK = {"incidents": 150, "citizens": 80, "bins": 8, "readings_per_bin": 60, "pickups": 60, "collectors": 8}
REPORT = {
    "categoryId": "pothole",
    "description": "حفرة كبيرة في نص الشارع والعربيات بتقع فيها",
    "photoUris": [],
    "location": {"lat": 30.0535, "lng": 31.3370, "address": "شارع الاختبار، مدينة نصر"},
    "anonymous": False,
    "blurFaces": False,
}


@pytest.fixture
def bulk(db):
    add_bulk(db, **BULK)


def _collector_headers(client, db):
    col = db.get(Collector, "COL-1")
    phone = "0" + db.get(Profile, col.profile_id).phone.removeprefix("+20")
    return _bearer(citizen_session(client, phone)["token"])


# (a) -------------------------------------------------------------------------------------------
def test_walk_health_and_reference_data(client, bulk, admin_h, roads_h, citizen_h):
    health = client.get("/health")
    assert health.status_code == 200 and health.json()["status"] == "ok"
    for headers in (admin_h, roads_h):
        rows = client.get("/admin/departments", headers=headers).json()
        assert {"id", "nameAr", "external"} <= set(rows[0]) and len(rows) >= 9
    assert client.get("/admin/departments", headers=citizen_h).status_code == 403
    assert client.get("/admin/departments").status_code == 401
    assert client.get("/admin/teams", headers=admin_h).status_code == 200


# (b) -------------------------------------------------------------------------------------------
def test_walk_report_to_resolution_and_reopen(client, bulk, admin_h, citizen_h):
    created = client.post("/reports", json=REPORT, headers=citizen_h)
    assert created.status_code == 200, created.text
    incident_id = created.json()["incident"]["id"]

    admin_view = client.get(f"/admin/incidents/{incident_id}", headers=admin_h).json()
    assert admin_view["status"] == "received"
    assert admin_view["triage"]["source"] == "fallback" and admin_view["triage"]["confirmed"] is False  # no Gemini key

    confirmed = client.post(f"/admin/incidents/{incident_id}/triage/confirm", json={}, headers=admin_h)
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "triaged"
    assert confirmed.json()["triage"]["confirmed"] is True

    wo = client.post(
        "/admin/work-orders",
        json={"incidentId": incident_id, "department": admin_view["department"], "team": "فريق أ"},
        headers=admin_h,
    )
    assert wo.status_code == 200, wo.text
    wo_id = wo.json()["id"]
    assert (
        client.patch(f"/admin/work-orders/{wo_id}", json={"status": "in_progress"}, headers=admin_h).status_code == 400
    )
    started = client.patch(
        f"/admin/work-orders/{wo_id}", json={"status": "in_progress", "note": "الفريق وصل الموقع"}, headers=admin_h
    )
    assert started.status_code == 200 and started.json()["status"] == "in_progress"
    assert client.get(f"/incidents/{incident_id}", headers=citizen_h).json()["status"] == "in_progress"

    note = "اتصلحت الحفرة وأعدنا الرصف"
    done = client.patch(f"/admin/work-orders/{wo_id}", json={"status": "done", "note": note}, headers=admin_h)
    assert done.status_code == 200 and done.json()["status"] == "done"

    seen = client.get(f"/incidents/{incident_id}", headers=citizen_h).json()
    assert seen["status"] == "resolved"
    assert seen["timeline"][-1]["note"] == note and seen["timeline"][-1]["status"] == "resolved"

    updates = client.get("/notifications", headers=citizen_h).json()["items"]
    assert any(n["data"].get("incidentId") == incident_id and n["kind"] == "incident_status" for n in updates)

    reopened = client.post(f"/incidents/{incident_id}/reopen", json={"note": "لسه المشكلة موجودة"}, headers=citizen_h)
    assert reopened.status_code == 200 and reopened.json()["status"] == "received"


# (c) -------------------------------------------------------------------------------------------
def test_walk_recycling_pickup_to_payout(client, db, bulk, admin_h, citizen_h):
    col_h = _collector_headers(client, db)
    pickup = client.post(
        "/recycling/pickups",
        json={
            "items": [{"materialId": "pet_plastic", "estimatedKg": 4}],
            "location": {"lat": 30.0501, "lng": 31.3401, "address": "12 شارع النصر، مدينة نصر"},
            "day": (now_utc() + timedelta(days=2)).date().isoformat(),
            "slot": "morning",
            "mode": "free",
        },
        headers=citizen_h,
    )
    assert pickup.status_code == 200, pickup.text
    pid = pickup.json()["id"]

    assigned = client.patch(
        f"/admin/recycling/pickups/{pid}", json={"status": "accepted", "collectorId": "COL-1"}, headers=admin_h
    )
    assert assigned.status_code == 200 and assigned.json()["status"] == "accepted"
    weighing = client.post(
        f"/collector/jobs/{pid}/weighings",
        json={"materialId": "pet_plastic", "kg": 4.5, "source": "manual", "clientId": "walk-1"},
        headers=col_h,
    )
    assert weighing.status_code == 201, weighing.text
    finished = client.post(f"/collector/jobs/{pid}/complete", json={"paidToHouseholdEgp": 20}, headers=col_h)
    assert finished.status_code == 200 and finished.json()["status"] == "weighed"
    confirmed = client.post(f"/recycling/pickups/{pid}/confirm", headers=citizen_h)
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "completed"

    payouts = {row["collectorId"]: row for row in client.get("/admin/payouts", headers=admin_h).json()}
    assert payouts["COL-1"]["kg"] >= 4.5 and payouts["COL-1"]["jobs"] >= 1
    impact = client.get("/me/impact", headers=citizen_h).json()
    assert impact["totalKg"] > 0 and impact["pickups"] >= 1


# (d) -------------------------------------------------------------------------------------------
def test_walk_register_bin_ingest_forecast(client, bulk, admin_h):
    registered = client.post(
        "/admin/bins",
        json={
            "id": "BIN-WALK-001",
            "name": "حاوية الاختبار",
            "district": "مدينة نصر أول",
            "departmentId": "sanitation",
            "lat": 30.056,
            "lng": 31.33,
            "isSimulated": True,
        },
        headers=admin_h,
    )
    assert registered.status_code == 201, registered.text
    key = registered.json()["deviceKey"]
    assert key and registered.json()["bin"]["id"] == "BIN-WALK-001"
    full_pct = registered.json()["bin"].get("fullPct", 80)

    now = now_utc()
    readings = [
        {"seq": 1, "at": (now - timedelta(minutes=125)).isoformat(), "fillPct": 40.0, "tempC": 30.0, "batteryV": 3.9},
        {"seq": 2, "at": (now - timedelta(minutes=65)).isoformat(), "fillPct": 62.0, "tempC": 30.0, "batteryV": 3.9},
        {"seq": 3, "at": (now - timedelta(minutes=5)).isoformat(), "fillPct": float(full_pct + 6), "tempC": 31.0,
         "batteryV": 3.9},
    ]  # fmt: skip
    wrong = client.post(
        "/iot/bins/BIN-WALK-001/readings", headers={"X-Device-Key": "nope"}, json={"readings": readings}
    )
    assert wrong.status_code == 401
    sent = client.post("/iot/bins/BIN-WALK-001/readings", headers={"X-Device-Key": key}, json={"readings": readings})
    assert sent.status_code == 202, sent.text
    assert sent.json()["accepted"] == [1, 2, 3]

    fleet = {row["id"]: row for row in client.get("/admin/bins", headers=admin_h).json()}
    assert fleet["BIN-WALK-001"]["status"] == "full"
    forecast = {r["binId"]: r for r in client.get("/admin/bins/forecast", headers=admin_h).json()["items"]}
    assert forecast["BIN-WALK-001"]["method"] == "linear"
    assert forecast["BIN-WALK-001"]["sampleCount"] == 3


# (e) -------------------------------------------------------------------------------------------
def test_walk_ai_routes_without_a_gemini_key(client, bulk, citizen_h):
    triage = client.post("/triage", json={"description": "فيه حفرة كبيرة في الشارع"}, headers=citizen_h)
    assert triage.status_code == 200 and triage.json()["source"] == "fallback"
    assert triage.json()["options"][0]["categoryId"] == "pothole"

    waste = client.post("/ai/waste-classify", json={"path": "photos/x.jpg"}, headers=citizen_h)
    assert waste.status_code == 200 and waste.json()["source"] == "fallback"

    transcript = client.post("/ai/transcribe", json={"path": "voice/x.m4a"}, headers=citizen_h)
    assert transcript.status_code == 503  # no transcription provider configured


# (f) -------------------------------------------------------------------------------------------
def test_walk_staff_scope_and_admin_only_writes(client, bulk, roads_h, admin_h):
    rows = client.get("/admin/incidents", headers=roads_h).json()
    assert len(rows) > 5
    assert {r["department"] for r in rows} == {"صيانة الطرق"}
    total = client.get("/admin/incidents", headers=admin_h).json()
    assert len(total) > len(rows)

    assert client.patch("/admin/collectors/COL-2", json={"status": "verified"}, headers=roads_h).status_code == 403
    assert client.patch("/admin/collectors/COL-2", json={"status": "verified"}, headers=admin_h).status_code == 200
    assert client.post("/admin/budget/optimize", json={"budgetEgp": 50000}, headers=roads_h).status_code == 403
    budget = client.post("/admin/budget/optimize", json={"budgetEgp": 50000}, headers=admin_h)
    assert budget.status_code == 200 and budget.json()["totalCost"] <= 50000
