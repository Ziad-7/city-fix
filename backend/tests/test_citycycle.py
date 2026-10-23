"""CityCycle: pickups, collectors, weighings, impact, admin, bins and uploads (contract: "CityCycle")."""

from datetime import timedelta

import pytest

from app.config import settings
from app.helpers import now_utc
from tests.conftest import _bearer, citizen_session

COLLECTOR_PHONE = "01022223333"  # seeded verified collector COL-1
PENDING_PHONE = "01033334444"  # seeded pending collector COL-2
NASR = {"lat": 30.0562, "lng": 31.3305}


def future_day(days=2):
    return (now_utc() + timedelta(days=days)).date().isoformat()


def pickup_body(**over):
    body = {
        "items": [{"materialId": "pet_plastic", "estimatedKg": 4}, {"materialId": "e_waste", "estimatedKg": 1}],
        "location": {"lat": 30.0501, "lng": 31.3401, "address": "12 شارع النصر، مدينة نصر", "landmark": "جنب المسجد"},
        "day": future_day(),
        "slot": "morning",
        "mode": "paid",
    }
    body.update(over)
    return body


@pytest.fixture
def collector_h(client):
    return _bearer(citizen_session(client, COLLECTOR_PHONE)["token"])


@pytest.fixture
def pending_h(client):
    return _bearer(citizen_session(client, PENDING_PHONE)["token"])


@pytest.fixture
def pickup(client, citizen_h):
    r = client.post("/recycling/pickups", json=pickup_body(), headers=citizen_h)
    assert r.status_code == 200, r.text
    return r.json()


def weigh(client, h, pid, cid="c-1", material="pet_plastic", kg=4.0):
    return client.post(
        f"/collector/jobs/{pid}/weighings",
        json={"materialId": material, "kg": kg, "source": "manual", "clientId": cid},
        headers=h,
    )


# --------------------------------------------------------------------------- prices and citizen pickups
def test_materials_one_row_each_with_null_price_where_unset(client, citizen_h):
    rows = client.get("/recycling/materials", params={"district": "مدينة نصر أول"}, headers=citizen_h).json()
    assert [r["materialId"] for r in rows][0] == "pet_plastic" and len(rows) == 7
    by = {r["materialId"]: r["priceEgpPerKg"] for r in rows}
    assert by["pet_plastic"] == 5 and by["e_waste"] is None
    other = client.get("/recycling/materials", params={"district": "مكان تاني"}, headers=citizen_h).json()
    assert len(other) == 7 and all(r["priceEgpPerKg"] is None for r in other)


def test_requires_auth(client):
    assert client.get("/recycling/pickups").status_code == 401
    assert client.get("/bins").status_code == 401


def test_create_pickup_estimates_from_price_list(pickup):
    assert pickup["id"].startswith("RCY-") and pickup["status"] == "requested"
    assert pickup["estimatedValueEgp"] == 20  # 4 kg PET x 5; e-waste has no price
    assert pickup["weighings"] == [] and "totalKg" not in pickup
    assert pickup["timeline"][0]["status"] == "requested"


def test_create_pickup_without_any_price_has_no_estimate(client, citizen_h):
    body = pickup_body(items=[{"materialId": "organics", "estimatedKg": 2}])
    r = client.post("/recycling/pickups", json=body, headers=citizen_h).json()
    assert "estimatedValueEgp" not in r


@pytest.mark.parametrize(
    "over",
    [
        {"items": []},
        {"items": [{"materialId": "gold", "estimatedKg": 1}]},
        {"items": [{"materialId": "glass", "estimatedKg": 0}]},
        {"day": "2026-02-31"},
        {"day": "2020-01-01"},
        {"mode": "barter"},
        {"slot": "night"},
    ],
)
def test_create_pickup_validation(client, citizen_h, over):
    assert client.post("/recycling/pickups", json=pickup_body(**over), headers=citizen_h).status_code == 422


def test_list_and_get_own_pickups_only(client, citizen_h, other_citizen_h, pickup):
    mine = client.get("/recycling/pickups", headers=citizen_h).json()
    assert [p["id"] for p in mine][0] == pickup["id"]
    assert client.get("/recycling/pickups", headers=other_citizen_h).json() == []
    assert client.get(f"/recycling/pickups/{pickup['id']}", headers=citizen_h).status_code == 200
    assert client.get(f"/recycling/pickups/{pickup['id']}", headers=other_citizen_h).status_code == 403
    assert client.get("/recycling/pickups/RCY-9999", headers=citizen_h).status_code == 404


def test_cancel_only_while_requested(client, citizen_h, other_citizen_h, collector_h, pickup):
    pid = pickup["id"]
    assert client.post(f"/recycling/pickups/{pid}/cancel", json={}, headers=other_citizen_h).status_code == 403
    r = client.post(f"/recycling/pickups/{pid}/cancel", json={"note": "غيرت رأيي"}, headers=citizen_h)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert r.json()["timeline"][-1]["note"] == "غيرت رأيي"
    assert client.post(f"/recycling/pickups/{pid}/cancel", headers=citizen_h).status_code == 409
    assert client.post(f"/collector/jobs/{pid}/accept", headers=collector_h).status_code == 409


def test_cannot_cancel_after_accept(client, citizen_h, collector_h, pickup):
    client.post(f"/collector/jobs/{pickup['id']}/accept", headers=collector_h)
    assert client.post(f"/recycling/pickups/{pickup['id']}/cancel", headers=citizen_h).status_code == 409


# --------------------------------------------------------------------------- collectors
def test_apply_and_me(client, other_citizen_h):
    assert client.get("/collectors/me", headers=other_citizen_h).status_code == 404
    r = client.post(
        "/collectors/apply",
        json={"name": "سعيد حسن", "district": "مدينة نصر أول", "materials": ["glass", "glass", "metal_cans"]},
        headers=other_citizen_h,
    )
    assert r.status_code == 200
    c = r.json()
    assert c["status"] == "pending" and c["materials"] == ["glass", "metal_cans"] and c["id"].startswith("COL-")
    assert "phone" not in c and "profileId" not in c
    assert client.get("/collectors/me", headers=other_citizen_h).json()["id"] == c["id"]
    again = client.post(
        "/collectors/apply", json={"name": "سعيد", "district": "x", "materials": ["glass"]}, headers=other_citizen_h
    )
    assert again.status_code == 409


def test_unverified_cannot_use_jobs(client, pending_h, other_citizen_h):
    q = {**NASR, "radiusM": 5000}
    assert client.get("/collector/jobs", params=q, headers=pending_h).status_code == 403
    assert client.get("/collector/jobs", params=q, headers=other_citizen_h).status_code == 403
    assert client.post("/collector/jobs/RCY-3001/accept", headers=pending_h).status_code == 403


def test_jobs_are_private_and_sorted(client, citizen_h, collector_h, pickup):
    jobs = client.get("/collector/jobs", params={**NASR, "radiusM": 5000}, headers=collector_h).json()
    ids = [j["id"] for j in jobs]
    assert {"RCY-3001", "RCY-3002", "RCY-3003", "RCY-3004", pickup["id"]} <= set(ids)
    assert [j["distanceM"] for j in jobs] == sorted(j["distanceM"] for j in jobs)
    mine = next(j for j in jobs if j["id"] == pickup["id"])
    assert mine["location"]["address"] == "شارع النصر، مدينة نصر"  # building number dropped
    assert "landmark" not in mine["location"] and "note" not in mine  # free text only after accept
    assert mine["location"]["lat"] == 30.05 and mine["location"]["lng"] == 31.34  # ~100 m rounding
    assert "citizenId" not in mine and "photoUris" not in mine and mine["estimatedKg"] == 5
    far = client.get("/collector/jobs", params={"lat": 31.2, "lng": 29.9, "radiusM": 1000}, headers=collector_h)
    assert far.json() == []
    glass = client.get(
        "/collector/jobs", params={**NASR, "radiusM": 5000, "materialId": "glass"}, headers=collector_h
    ).json()
    assert [j["id"] for j in glass] == ["RCY-3002"]


def test_job_distance_cannot_locate_the_exact_home(client, collector_h, pickup):
    """Distance is measured to the rounded pin, so two nearby query points see consistent coarse values."""
    from app.logic.duplicates import haversine_m

    exact = (30.0501, 31.3401)

    def dist(lat, lng):
        jobs = client.get(
            "/collector/jobs", params={"lat": lat, "lng": lng, "radiusM": 3000}, headers=collector_h
        ).json()
        return next(j for j in jobs if j["id"] == pickup["id"])["distanceM"]

    for q in ((30.0510, 31.3401), (30.0501, 31.3412), (30.0490, 31.3390)):
        assert dist(*q) == round(haversine_m(*q, 30.05, 31.34))  # rounded pin, never the exact one
    assert dist(30.05, 31.34) == 0 and haversine_m(*exact, 30.05, 31.34) > 0


def test_jobs_exclude_own_household_pickups(client, collector_h):
    client.post("/recycling/pickups", json=pickup_body(), headers=collector_h)
    jobs = client.get("/collector/jobs", params={"lat": 30.0501, "lng": 31.3401, "radiusM": 300}, headers=collector_h)
    assert jobs.json() == []


def test_full_flow(client, citizen_h, collector_h, pickup):
    pid = pickup["id"]
    accepted = client.post(f"/collector/jobs/{pid}/accept", headers=collector_h)
    assert accepted.status_code == 200
    a = accepted.json()
    assert a["status"] == "accepted" and a["collectorName"] == "كريم" and a["location"]["lat"] == 30.0501
    assert a["citizenId"] == "" and "photoUris" in a
    assert client.post(f"/collector/jobs/{pid}/accept", headers=collector_h).status_code == 200  # retry

    # complete needs a weighing
    assert client.post(f"/collector/jobs/{pid}/complete", json={}, headers=collector_h).status_code == 409
    first = weigh(client, collector_h, pid, "c-1", "pet_plastic", 4.5)
    assert first.status_code == 201
    w = first.json()
    assert w["priceEgpPerKg"] == 5 and w["valueEgp"] == 22.5 and w["clientId"] == "c-1"
    repeat = weigh(client, collector_h, pid, "c-1", "pet_plastic", 4.5)
    assert repeat.status_code == 200 and repeat.json()["id"] == w["id"]
    unpriced = weigh(client, collector_h, pid, "c-2", "e_waste", 1.0).json()
    assert unpriced["priceEgpPerKg"] is None and unpriced["valueEgp"] is None

    # household cannot confirm before the collector finishes
    assert client.post(f"/recycling/pickups/{pid}/confirm", headers=citizen_h).status_code == 409
    done = client.post(f"/collector/jobs/{pid}/complete", json={"paidToHouseholdEgp": 22}, headers=collector_h)
    assert done.status_code == 200
    d = done.json()
    assert d["status"] == "weighed" and d["totalKg"] == 5.5 and d["totalValueEgp"] == 22.5
    assert d["paidToHouseholdEgp"] == 22 and "collectorFinishedAt" in d
    assert client.post(f"/collector/jobs/{pid}/complete", json={}, headers=collector_h).status_code == 200
    assert weigh(client, collector_h, pid, "c-3").status_code == 409  # finished

    confirmed = client.post(f"/recycling/pickups/{pid}/confirm", headers=citizen_h)
    assert confirmed.status_code == 200 and confirmed.json()["status"] == "completed"
    assert "confirmedAt" in confirmed.json()
    assert client.post(f"/recycling/pickups/{pid}/confirm", headers=citizen_h).status_code == 200
    statuses = [t["status"] for t in confirmed.json()["timeline"]]
    assert statuses == ["requested", "accepted", "weighed", "weighed", "completed"]

    household = client.get(f"/recycling/pickups/{pid}", headers=citizen_h).json()
    assert household["collectorName"] == "كريم" and len(household["weighings"]) == 2

    mine = client.get("/collector/pickups", headers=collector_h).json()
    assert pid in [p["id"] for p in mine]


def test_first_accept_wins_and_weighing_rules(client, citizen_h, collector_h, pickup, other_citizen_h):
    pid = pickup["id"]
    other = _bearer(citizen_session(client, "01055556666")["token"])
    client.post("/collectors/apply", json={"name": "علي", "district": "x", "materials": ["glass"]}, headers=other)
    from app.models import Collector

    # verify COL via admin API
    admin = _bearer(
        client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"}).json()[
            "token"
        ]
    )
    cid = client.get("/admin/collectors", params={"status": "pending"}, headers=admin).json()
    new_id = next(c["id"] for c in cid if c["name"] == "علي")
    assert client.patch(f"/admin/collectors/{new_id}", json={"status": "verified"}, headers=admin).status_code == 200
    assert Collector  # imported for clarity of the model under test

    assert client.post(f"/collector/jobs/{pid}/accept", headers=collector_h).status_code == 200
    assert client.post(f"/collector/jobs/{pid}/accept", headers=other).status_code == 409
    assert weigh(client, other, pid).status_code == 403  # not the accepting collector
    assert weigh(client, collector_h, pid, kg=0.2).status_code == 422
    assert weigh(client, collector_h, pid, kg=501).status_code == 422
    assert weigh(client, collector_h, "RCY-9999").status_code == 404
    # a household cannot act as a collector on its own pickup
    assert client.post(f"/collector/jobs/{pid}/accept", headers=citizen_h).status_code == 403


def test_impact_and_earnings(client, citizen_h, collector_h):
    citizen = client.get("/me/impact", headers=citizen_h).json()
    assert citizen["totalKg"] == 13.5 and citizen["pickups"] == 1 and "earnedEgp" not in citizen
    assert {m["materialId"] for m in citizen["byMaterial"]} == {"pet_plastic", "paper_cardboard"}
    assert "co2AvoidedKg" not in citizen
    as_collector = client.get("/me/impact", params={"as": "collector"}, headers=collector_h).json()
    assert as_collector["totalKg"] == 13.5 and as_collector["earnedEgp"] == 51.5
    assert client.get("/me/impact", params={"as": "x"}, headers=citizen_h).status_code == 422
    nothing = client.get("/me/impact", params={"as": "collector"}, headers=citizen_h).json()
    assert nothing == {"totalKg": 0, "byMaterial": [], "pickups": 0, "earnedEgp": 0}

    today = now_utc().date().isoformat()
    e = client.get("/collector/earnings", params={"from": "2020-01-01", "to": today}, headers=collector_h).json()
    assert e["totalKg"] == 13.5 and e["valueEgp"] == 51.5 and e["paidToHouseholdsEgp"] == 48 and e["jobs"] == 1
    assert client.get("/collector/earnings", params={"from": "bad"}, headers=collector_h).status_code == 422
    assert client.get("/collector/earnings", headers=citizen_h).status_code == 403


# --------------------------------------------------------------------------- admin
def test_admin_endpoints_require_staff(client, citizen_h):
    for path in ("/admin/collectors", "/admin/material-prices", "/admin/payouts", "/admin/recycling/summary"):
        assert client.get(path, headers=citizen_h).status_code == 403


def test_admin_collectors_verify_and_suspend(client, admin_h, pending_h):
    pending = client.get("/admin/collectors", params={"status": "pending"}, headers=admin_h).json()
    assert [c["id"] for c in pending] == ["COL-2"] and pending[0]["phone"] == "+201033334444"
    q = {**NASR, "radiusM": 5000}
    assert client.get("/collector/jobs", params=q, headers=pending_h).status_code == 403
    r = client.patch("/admin/collectors/COL-2", json={"status": "verified", "note": "تم"}, headers=admin_h)
    assert r.json()["status"] == "verified"
    assert client.get("/collector/jobs", params=q, headers=pending_h).status_code == 200
    client.patch("/admin/collectors/COL-2", json={"status": "suspended"}, headers=admin_h)
    assert client.get("/collector/jobs", params=q, headers=pending_h).status_code == 403
    assert client.patch("/admin/collectors/COL-9", json={"status": "verified"}, headers=admin_h).status_code == 404
    assert client.patch("/admin/collectors/COL-2", json={"status": "boss"}, headers=admin_h).status_code == 422


def test_admin_prices_put_is_admin_only(client, admin_h, roads_h, citizen_h):
    body = {"district": "حي جديد", "prices": [{"materialId": "glass", "priceEgpPerKg": 2.5}]}
    assert client.put("/admin/material-prices", json=body, headers=roads_h).status_code == 403
    r = client.put("/admin/material-prices", json=body, headers=admin_h)
    assert r.status_code == 200
    by = {p["materialId"]: p["priceEgpPerKg"] for p in r.json()}
    assert by["glass"] == 2.5 and by["pet_plastic"] is None
    seen = client.get("/recycling/materials", params={"district": "حي جديد"}, headers=citizen_h).json()
    assert {p["materialId"]: p["priceEgpPerKg"] for p in seen}["glass"] == 2.5
    assert client.get("/admin/material-prices", params={"district": "حي جديد"}, headers=roads_h).status_code == 200
    bad = {"district": "x", "prices": [{"materialId": "glass", "priceEgpPerKg": -1}]}
    assert client.put("/admin/material-prices", json=bad, headers=admin_h).status_code == 422


def test_admin_pickup_patch_is_admin_only_and_staff_views_are_redacted(client, admin_h, roads_h):
    assert (
        client.patch("/admin/recycling/pickups/RCY-3001", json={"status": "cancelled"}, headers=roads_h).status_code
        == 403
    )
    staff = client.get("/admin/recycling/pickups/RCY-3100", headers=roads_h).json()
    assert staff["location"] == {"address": "مدينة نصر أول"} and "citizenName" not in staff and staff["citizenId"] == ""
    assert staff["district"] == "مدينة نصر أول" and "note" not in staff
    rows = client.get("/admin/recycling/pickups", headers=roads_h).json()
    assert all("lat" not in r["location"] and r["citizenId"] == "" for r in rows)
    full = client.get("/admin/recycling/pickups/RCY-3100", headers=admin_h).json()
    assert "lat" in full["location"] and full["citizenName"] == "أحمد محمد"


def test_admin_cannot_cancel_a_weighed_pickup(client, admin_h, collector_h, pickup):
    pid = pickup["id"]
    client.post(f"/collector/jobs/{pid}/accept", headers=collector_h)
    assert weigh(client, collector_h, pid).status_code == 201
    r = client.patch(f"/admin/recycling/pickups/{pid}", json={"status": "cancelled"}, headers=admin_h)
    assert r.status_code == 409


def test_admin_summary_pickups_payouts(client, admin_h):
    s = client.get("/admin/recycling/summary", headers=admin_h).json()
    assert s["totalKg"] == 13.5 and s["tonnes"] == 0.0135 and s["pickups"] == 5
    assert s["byStatus"]["requested"] == 4 and s["byStatus"]["completed"] == 1
    assert s["byDistrict"] == [{"district": "مدينة نصر أول", "kg": 13.5}]
    assert s["avgResponseMinutes"] is not None
    assert client.get("/admin/recycling/summary", params={"from": "x"}, headers=admin_h).status_code == 422

    listing = client.get("/admin/recycling/pickups", params={"status": "requested"}, headers=admin_h).json()
    assert len(listing) == 4 and listing[0]["district"] == "مدينة نصر أول"
    assert client.get("/admin/recycling/pickups", params={"status": "nope"}, headers=admin_h).status_code == 422
    detail = client.get("/admin/recycling/pickups/RCY-3100", headers=admin_h).json()
    assert detail["citizenName"] == "أحمد محمد" and len(detail["weighings"]) == 2
    assert client.get("/admin/recycling/pickups/RCY-9", headers=admin_h).status_code == 404
    patch = client.patch
    assert (
        patch("/admin/recycling/pickups/RCY-3001", json={"status": "cancelled"}, headers=admin_h).json()["status"]
        == "cancelled"
    )
    assert patch("/admin/recycling/pickups/RCY-3100", json={"status": "cancelled"}, headers=admin_h).status_code == 409
    assert patch("/admin/recycling/pickups/RCY-3002", json={"status": "completed"}, headers=admin_h).status_code == 409
    assert patch("/admin/recycling/pickups/RCY-3002", json={"status": "accepted"}, headers=admin_h).status_code == 422
    unverified = {"status": "accepted", "collectorId": "COL-2"}
    assert patch("/admin/recycling/pickups/RCY-3002", json=unverified, headers=admin_h).status_code == 409
    assign = patch(
        "/admin/recycling/pickups/RCY-3002", json={"status": "accepted", "collectorId": "COL-1"}, headers=admin_h
    )
    assert assign.status_code == 200 and assign.json()["collectorName"] == "كريم"
    assert (
        patch(
            "/admin/recycling/pickups/RCY-3002", json={"status": "accepted", "collectorId": "COL-1"}, headers=admin_h
        ).status_code
        == 409
    )
    noted = patch("/admin/recycling/pickups/RCY-3003", json={"note": "اتصلنا بالعميل"}, headers=admin_h).json()
    assert noted["timeline"][-1]["note"] == "اتصلنا بالعميل" and noted["status"] == "requested"
    assert patch("/admin/recycling/pickups/RCY-3003", json={}, headers=admin_h).status_code == 422

    pay = client.get("/admin/payouts", headers=admin_h).json()
    assert pay == [
        {
            "collectorId": "COL-1",
            "collectorName": "كريم السيد",
            "kg": 13.5,
            "valueEgp": 51.5,
            "paidToHouseholdsEgp": 48,
            "jobs": 1,
        }
    ]
    assert client.get("/admin/payouts", params={"collectorId": "COL-2"}, headers=admin_h).json() == []


# --------------------------------------------------------------------------- bins
def test_public_bins(client, citizen_h):
    bins = client.get("/bins", headers=citizen_h).json()
    by = {b["id"]: b for b in bins}
    assert by["BIN-012"]["state"] == "full" and by["BIN-013"]["state"] == "hot"
    assert by["BIN-014"]["state"] == "low_battery" and by["BIN-015"]["state"] == "offline"
    assert by["BIN-011"]["state"] == "ok" and by["HUB-001"]["kind"] == "hub"
    assert "fillPct" not in by["BIN-015"] and by["BIN-012"]["location"]["lat"] == 30.0585
    assert "deviceKeyHash" not in by["BIN-012"] and "isSimulated" not in by["BIN-012"]
    box = client.get("/bins", params={"bbox": "31.33,30.058,31.34,30.059"}, headers=citizen_h).json()
    assert [b["id"] for b in box] == ["BIN-012"]
    assert client.get("/bins", params={"bbox": "bad"}, headers=citizen_h).status_code == 400


def test_report_full_bin_creates_garbage_incident(client, citizen_h, other_citizen_h):
    before = len(client.get("/reports", headers=citizen_h).json())
    r = client.post("/bins/BIN-012/report-full", json={"note": "الريحة وحشة"}, headers=citizen_h)
    assert r.status_code == 204
    reports = client.get("/reports", headers=citizen_h).json()
    assert len(reports) == before + 1 and reports[0]["categoryId"] == "garbage"
    incident_id = reports[0]["incidentId"]
    inc = client.get(f"/incidents/{incident_id}", headers=citizen_h).json()
    assert inc["categoryId"] == "garbage" and inc["location"]["lat"] == 30.0585
    # same person again: no duplicate; another person joins the same open incident
    assert client.post("/bins/BIN-012/report-full", json={}, headers=citizen_h).status_code == 204
    assert len(client.get("/reports", headers=citizen_h).json()) == before + 1
    assert client.post("/bins/BIN-012/report-full", json={}, headers=other_citizen_h).status_code == 204
    other = client.get("/reports", headers=other_citizen_h).json()
    assert other[0]["incidentId"] == incident_id
    assert client.post("/bins/NOPE/report-full", json={}, headers=citizen_h).status_code == 404


def test_admin_bin_patch_rotates_key_and_revokes(client, admin_h, roads_h):
    key_body = {"seq": 1, "at": None, "fillPct": 10, "tempC": 20, "batteryV": 4}
    assert client.patch("/admin/bins/BIN-011", json={"rotateKey": True}, headers=roads_h).status_code == 403
    r = client.patch("/admin/bins/BIN-011", json={"rotateKey": True, "name": "جديد"}, headers=admin_h).json()
    assert r["bin"]["name"] == "جديد" and len(r["deviceKey"]) > 20
    ok = client.post(
        "/iot/bins/BIN-011/readings",
        json={"readings": [{**key_body, "seq": 2}]},
        headers={"X-Device-Key": r["deviceKey"]},
    )
    assert ok.status_code == 202
    client.patch("/admin/bins/BIN-011", json={"isActive": False}, headers=admin_h)
    denied = client.post(
        "/iot/bins/BIN-011/readings",
        json={"readings": [{**key_body, "seq": 3}]},
        headers={"X-Device-Key": r["deviceKey"]},
    )
    assert denied.status_code == 401
    assert "BIN-011" not in [b["id"] for b in client.get("/bins", headers=admin_h).json()]
    assert client.patch("/admin/bins/NOPE", json={}, headers=admin_h).status_code == 404


def test_hub_weighings_device_auth_and_idempotency(client, admin_h):
    key = client.patch("/admin/bins/HUB-001", json={"rotateKey": True}, headers=admin_h).json()["deviceKey"]
    h = {"X-Device-Key": key}
    body = {"seq": 1, "at": "2026-10-22T10:00:00Z", "material": "glass", "kg": 12.5}
    street_key = client.patch("/admin/bins/BIN-011", json={"rotateKey": True}, headers=admin_h).json()["deviceKey"]
    assert (
        client.post("/iot/hubs/BIN-011/weighings", json=body, headers={"X-Device-Key": street_key}).status_code == 404
    )
    assert client.post("/iot/hubs/HUB-001/weighings", json=body).status_code == 401
    assert client.post("/iot/hubs/HUB-001/weighings", json=body, headers={"X-Device-Key": "wrong"}).status_code == 401
    assert client.post("/iot/hubs/HUB-001/weighings", json=body, headers=h).status_code == 202
    assert client.post("/iot/hubs/HUB-001/weighings", json=body, headers=h).status_code == 202
    assert client.post("/iot/hubs/HUB-001/weighings", json={**body, "kg": 99}, headers=h).status_code == 409
    assert (
        client.post("/iot/hubs/HUB-001/weighings", json={**body, "seq": 2, "pickupId": "RCY-0"}, headers=h).status_code
        == 422
    )
    assert (
        client.post("/iot/hubs/HUB-001/weighings", json={**body, "seq": 3, "material": "gold"}, headers=h).status_code
        == 422
    )


# --------------------------------------------------------------------------- uploads fail loudly
def test_uploads_sign_stub_allowed_on_sqlite_by_default(client, citizen_h):
    assert settings.local_upload_stub_allowed is True
    r = client.post("/uploads/sign", json={"kind": "report_photo", "contentType": "image/jpeg"}, headers=citizen_h)
    assert r.status_code == 200 and r.json()["uploadUrl"].endswith(r.json()["path"])


def test_uploads_sign_503_without_storage_when_stub_disallowed(client, citizen_h, monkeypatch):
    monkeypatch.setattr(settings, "allow_local_upload_stub", False)
    r = client.post("/uploads/sign", json={"kind": "report_photo", "contentType": "image/jpeg"}, headers=citizen_h)
    assert r.status_code == 503 and "التخزين" in r.json()["detail"]
    assert client.put("/uploads/local/photos/x/y.jpg", content=b"x").status_code == 404


def test_blank_upload_stub_env_means_unset(monkeypatch):
    from app.config import Settings

    monkeypatch.setenv("ALLOW_LOCAL_UPLOAD_STUB", "")
    assert Settings(_env_file=None).allow_local_upload_stub is None
    monkeypatch.setenv("ALLOW_LOCAL_UPLOAD_STUB", "true")
    assert Settings(_env_file=None).allow_local_upload_stub is True


def test_upload_stub_default_depends_on_database(monkeypatch):
    monkeypatch.setattr(settings, "allow_local_upload_stub", None)
    monkeypatch.setattr(settings, "database_url", "postgresql+psycopg://u:p@db.example/postgres")
    assert settings.local_upload_stub_allowed is False
    monkeypatch.setattr(settings, "allow_local_upload_stub", True)
    assert settings.local_upload_stub_allowed is True
    monkeypatch.setattr(settings, "allow_local_upload_stub", None)
    monkeypatch.setattr(settings, "database_url", "sqlite:///./x.db")
    assert settings.local_upload_stub_allowed is True


# --------------------------------------------------------------------------- migration file
def test_sql_migration_covers_every_citycycle_table():
    from pathlib import Path

    sql = (Path(__file__).parents[1] / "migrations" / "001_citycycle.sql").read_text()
    for table in (
        "material_prices",
        "collectors",
        "recycling_pickups",
        "recycling_weighings",
        "bin_reports",
        "hub_weighings",
        "idempotency_keys",
    ):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in sql
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY" in sql


# --------------------------------------------------------------------------- suspension, atomic cancel, idempotency
def test_suspending_a_collector_releases_accepted_jobs(client, admin_h, collector_h, citizen_h, db):
    accepted = client.post("/collector/jobs/RCY-3001/accept", headers=collector_h).json()
    assert accepted["status"] == "accepted"
    client.post("/collector/jobs/RCY-3002/accept", headers=collector_h)
    assert weigh(client, collector_h, "RCY-3002", "w1", "glass", 2).status_code == 201
    r = client.patch("/admin/collectors/COL-1", json={"status": "suspended"}, headers=admin_h)
    assert r.status_code == 200
    from app.models import Notification

    notices = db.query(Notification).filter_by(data={"pickupId": "RCY-3001"}).all()
    assert {notice.recipient_id for notice in notices} == {"seed-household-1", "collector-001"}
    freed = client.get("/admin/recycling/pickups/RCY-3001", headers=admin_h).json()
    assert freed["status"] == "requested" and "collectorId" not in freed
    assert freed["timeline"][-1]["status"] == "requested" and "اتوقف" in freed["timeline"][-1]["note"]
    held = client.get("/admin/recycling/pickups/RCY-3002", headers=admin_h).json()
    assert held["status"] == "weighed" and held["collectorId"] == "COL-1" and "اتوقف" in held["timeline"][-1]["note"]
    # another verified collector can take the released job
    client.patch("/admin/collectors/COL-2", json={"status": "verified"}, headers=admin_h)
    other = _bearer(citizen_session(client, PENDING_PHONE)["token"])
    assert client.post("/collector/jobs/RCY-3001/accept", headers=other).status_code == 200
    # verifying again does not touch jobs
    client.patch("/admin/collectors/COL-1", json={"status": "verified"}, headers=admin_h)
    assert client.get("/admin/recycling/pickups/RCY-3002", headers=admin_h).json()["collectorId"] == "COL-1"


def test_weighing_is_refused_after_admin_cancel(client, admin_h, collector_h, pickup):
    pid = pickup["id"]
    client.post(f"/collector/jobs/{pid}/accept", headers=collector_h)
    assert (
        client.patch(f"/admin/recycling/pickups/{pid}", json={"status": "cancelled"}, headers=admin_h).status_code
        == 200
    )
    assert weigh(client, collector_h, pid).status_code == 409
    assert client.get(f"/admin/recycling/pickups/{pid}", headers=admin_h).json()["weighings"] == []


def test_pickup_idempotency_key(client, citizen_h, other_citizen_h):
    h = {**citizen_h, "Idempotency-Key": "k-1"}
    first = client.post("/recycling/pickups", json=pickup_body(), headers=h)
    again = client.post("/recycling/pickups", json=pickup_body(), headers=h)
    assert first.status_code == again.status_code == 200 and first.json()["id"] == again.json()["id"]
    assert len(client.get("/recycling/pickups", headers=citizen_h).json()) == 2  # seeded RCY-3100 + one
    # another user, or no key, creates a new one
    assert (
        client.post(
            "/recycling/pickups", json=pickup_body(), headers={**other_citizen_h, "Idempotency-Key": "k-1"}
        ).json()["id"]
        != first.json()["id"]
    )
    assert client.post("/recycling/pickups", json=pickup_body(), headers=citizen_h).json()["id"] != first.json()["id"]
    long = {**citizen_h, "Idempotency-Key": "x" * 101}
    assert client.post("/recycling/pickups", json=pickup_body(), headers=long).status_code == 422


def test_report_idempotency_key(client, citizen_h, other_citizen_h):
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة في الشارع قدام المدرسة",
        "photoUris": [],
        "location": {"lat": 30.1, "lng": 31.4, "address": "شارع الاختبار"},
    }
    h = {**citizen_h, "Idempotency-Key": "rep-1"}
    first = client.post("/reports", json=body, headers=h)
    again = client.post("/reports", json=body, headers=h)
    assert first.status_code == again.status_code == 200
    assert first.json()["report"]["id"] == again.json()["report"]["id"]
    assert again.json()["incident"]["id"] == first.json()["incident"]["id"]
    assert len(client.get("/reports", headers=citizen_h).json()) == len(
        {r["id"] for r in client.get("/reports", headers=citizen_h).json()}
    )
    mine = [r for r in client.get("/reports", headers=citizen_h).json() if r["description"] == body["description"]]
    assert len(mine) == 1
    other = client.post("/reports", json=body, headers={**other_citizen_h, "Idempotency-Key": "rep-1"})
    assert other.json()["report"]["id"] != first.json()["report"]["id"]


def test_idempotency_race_returns_the_winner_not_a_500(client, citizen_h, monkeypatch):
    """Both requests passed the first lookup; the loser hits the unique key and gets the original back."""
    from app.logic import idempotency

    h = {**citizen_h, "Idempotency-Key": "race-1"}
    winner = client.post("/recycling/pickups", json=pickup_body(), headers=h).json()
    real = idempotency.lookup
    calls = []

    def blind_first_lookup(*args, **kwargs):
        calls.append(1)
        return None if len(calls) == 1 else real(*args, **kwargs)

    monkeypatch.setattr(idempotency, "lookup", blind_first_lookup)
    loser = client.post("/recycling/pickups", json=pickup_body(), headers=h)
    assert loser.status_code == 200 and loser.json()["id"] == winner["id"]
    mine = [p for p in client.get("/recycling/pickups", headers=citizen_h).json() if p["id"] != "RCY-3100"]
    assert len(mine) == 1

    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة في الشارع قدام المدرسة",
        "location": {"lat": 30.1, "lng": 31.4, "address": "شارع"},
    }
    rh = {**citizen_h, "Idempotency-Key": "race-2"}
    first = client.post("/reports", json=body, headers=rh).json()
    calls.clear()
    again = client.post("/reports", json=body, headers=rh)
    assert again.status_code == 200 and again.json()["report"]["id"] == first["report"]["id"]
