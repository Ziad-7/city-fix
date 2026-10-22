"""Citizen routes: reports, incidents, map, service requests, triage, uploads."""

from app.logic.triage import normalize_ar, triage_text
from app.models import ActivityLog, Category, Department, Incident, IncidentFollower, Report

POTHOLE_SPOT = {"lat": 30.0562, "lng": 31.3305, "address": "شارع عباس العقاد، مدينة نصر"}


def report_body(**over):
    body = {
        "categoryId": "pothole",
        "description": "حفرة كبيرة في نص الشارع والعربيات بتقع فيها",
        "photoUris": [],
        "location": {"lat": 30.0535, "lng": 31.3370, "address": "شارع الاختبار، مدينة نصر"},
        "anonymous": False,
        "blurFaces": False,
    }
    body.update(over)
    return body


PUBLIC_INCIDENT_KEYS = {
    "id", "categoryId", "title", "severity", "priority", "status", "department", "estimatedCostEgp",
    "linkedReportIds", "followers", "location", "areaUnderserved", "timeline", "createdAt", "updatedAt",
    "isFollowing", "sensitivePlace", "workOrderId", "eta",
}  # fmt: skip


# ----------------------------------------------------------------------------- auth
def test_citizen_routes_need_a_token(client):
    for method, path in [
        ("get", "/reports"),
        ("get", "/incidents"),
        ("get", "/incidents/INC-501"),
        ("get", "/map/incidents"),
        ("get", "/service-requests"),
        ("post", "/triage"),
        ("post", "/uploads/sign"),
    ]:
        assert getattr(client, method)(path).status_code == 401, path


# ----------------------------------------------------------------------------- reports
def test_report_validation(client, citizen_h):
    r = client.post("/reports", json=report_body(description="قصير"), headers=citizen_h)
    assert r.status_code == 400 and r.json() == {"detail": "اكتب وصف أو صوّر المشكلة"}
    ok = client.post("/reports", json=report_body(description="", photoUris=["photos/a.jpg"]), headers=citizen_h)
    assert ok.status_code == 200
    assert client.post("/reports", json=report_body(categoryId="nope"), headers=citizen_h).status_code == 422
    assert client.post("/reports", json=report_body(linkToIncidentId="INC-9999"), headers=citizen_h).status_code == 404


def test_new_report_creates_incident_with_priority_and_received_entry(client, db, citizen):
    r = client.post("/reports", json=report_body(severity="high"), headers=citizen["headers"]).json()
    inc, rep = r["incident"], r["report"]
    assert rep["reporterId"] == citizen["id"] and rep["incidentId"] == inc["id"]
    assert rep["id"].startswith("FTC-") and inc["id"].startswith("INC-")
    assert inc["status"] == "received" and inc["severity"] == "high"
    assert inc["followers"] == 1 and inc["isFollowing"] is True
    assert inc["linkedReportIds"] == [rep["id"]]
    assert inc["priority"]["score"] == sum(f["points"] for f in inc["priority"]["factors"]) >= 28
    assert [t["status"] for t in inc["timeline"]] == ["received"]
    assert inc["department"] == "صيانة الطرق" and inc["title"].startswith("حفرة")
    assert set(inc) <= PUBLIC_INCIDENT_KEYS
    ids = [i.id for i in db.query(Incident).all()]
    assert len(ids) == len(set(ids))


def test_link_report_adds_follower_once_and_reprioritises(client, db, other_citizen_h):
    before = client.get("/incidents/INC-504", headers=other_citizen_h).json()
    body = report_body(categoryId="garbage", linkToIncidentId="INC-504")
    r = client.post("/reports", json=body, headers=other_citizen_h).json()
    assert r["incident"]["id"] == "INC-504" and r["incident"]["followers"] == before["followers"] + 1
    assert len(r["incident"]["linkedReportIds"]) == len(before["linkedReportIds"]) + 1
    assert r["incident"]["priority"]["score"] >= before["priority"]["score"]
    again = client.post("/reports", json=body, headers=other_citizen_h).json()
    assert again["incident"]["followers"] == before["followers"] + 1  # already a follower: no extra


def test_reports_list_and_get_permissions(client, citizen_h, other_citizen_h, admin_h, roads_h):
    mine = client.get("/reports", headers=citizen_h).json()
    assert "FTC-1042" in [r["id"] for r in mine]
    assert mine == sorted(mine, key=lambda r: r["createdAt"], reverse=True)
    assert client.get("/reports", headers=other_citizen_h).json() == []
    one = client.get("/reports/FTC-1042", headers=citizen_h).json()
    assert one["incidentId"] == "INC-501" and one["photoUris"] is not None and "location" in one
    assert client.get("/reports/FTC-1042", headers=other_citizen_h).status_code == 403
    assert client.get("/reports/FTC-1042", headers=admin_h).status_code == 200
    assert client.get("/reports/FTC-1042", headers=roads_h).status_code == 403
    assert client.get("/reports/FTC-0", headers=citizen_h).status_code == 404


# ----------------------------------------------------------------------------- incidents
def test_incident_list_and_detail_are_public(client, db, citizen_h):
    items = client.get("/incidents", headers=citizen_h).json()
    assert len(items) == db.query(Incident).count()
    created = [i["createdAt"] for i in items]
    assert created == sorted(created, reverse=True)
    assert all("linkedReports" not in i and "triage" not in i and "overdue" not in i for i in items)
    assert all(set(i) <= PUBLIC_INCIDENT_KEYS for i in items)
    by_id = {i["id"]: i for i in items}
    assert by_id["INC-501"]["isFollowing"] is True  # reported FTC-1042
    assert by_id["INC-503"]["isFollowing"] is False
    detail = client.get("/incidents/INC-501", headers=citizen_h).json()
    assert detail["id"] == "INC-501" and detail["timeline"] and detail["isFollowing"] is True
    assert client.get("/incidents/INC-0", headers=citizen_h).status_code == 404


def test_staff_token_gets_admin_fields_on_citizen_route(client, admin_h):
    d = client.get("/incidents/INC-501", headers=admin_h).json()
    assert {"linkedReports", "dueAt", "overdue", "inBudgetPlan"} <= set(d)
    assert all(r["reporter"] in ("مواطن", "بلاغ بدون اسم") for r in d["linkedReports"])
    assert all(
        set(r) == {"id", "reporter", "description", "source", "photoCount", "createdAt"} for r in d["linkedReports"]
    )


def test_follow_is_idempotent(client, db, other_citizen_h):
    base = client.get("/incidents/INC-503", headers=other_citizen_h).json()
    assert base["isFollowing"] is False
    first = client.post("/incidents/INC-503/follow", headers=other_citizen_h).json()
    second = client.post("/incidents/INC-503/follow", headers=other_citizen_h).json()
    assert first["followers"] == second["followers"] == base["followers"] + 1
    assert first["isFollowing"] is True
    assert db.query(IncidentFollower).filter_by(incident_id="INC-503").count() == 1
    assert client.post("/incidents/INC-0/follow", headers=other_citizen_h).status_code == 404


def test_follow_by_reporter_does_not_double_count(client, citizen_h):
    base = client.get("/incidents/INC-501", headers=citizen_h).json()
    assert client.post("/incidents/INC-501/follow", headers=citizen_h).json()["followers"] == base["followers"]


def test_get_and_patch_share_the_incident_path(client, citizen_h, other_citizen_h, admin_h):
    assert client.get("/incidents/INC-501", headers=citizen_h).status_code == 200
    assert client.patch("/incidents/INC-501", json={"note": "x"}, headers=citizen_h).status_code == 403
    assert client.patch("/incidents/INC-501", json={"note": "x"}).status_code == 401
    assert client.patch("/incidents/INC-501", json={"note": "ملاحظة"}, headers=admin_h).status_code == 200


def test_round_trip_report_admin_status_citizen_timeline(client, db, admin_h, citizen_h):
    created = client.post("/reports", json=report_body(), headers=citizen_h).json()["incident"]
    listed = client.get("/admin/incidents", headers=admin_h).json()
    assert created["id"] in [i["id"] for i in listed]
    admin_view = next(i for i in listed if i["id"] == created["id"])
    assert admin_view["linkedReports"][0]["reporter"] == "مواطن"
    assert admin_view["triage"]["source"] == "fallback" and admin_view["triage"]["confirmed"] is False

    note = "الفريق في الطريق ليكم وهنخلّص النهارده"
    assert (
        client.patch(f"/incidents/{created['id']}", json={"status": "in_progress"}, headers=admin_h).status_code == 400
    )
    patched = client.patch(f"/incidents/{created['id']}", json={"status": "in_progress", "note": note}, headers=admin_h)
    assert patched.status_code == 200

    seen = client.get(f"/incidents/{created['id']}", headers=citizen_h).json()
    assert seen["status"] == "in_progress"
    assert seen["timeline"][-1]["note"] == note and seen["timeline"][-1]["status"] == "in_progress"
    assert [t["status"] for t in seen["timeline"]] == ["received", "in_progress"]
    assert db.query(ActivityLog).filter_by(entity_id=created["id"]).count() == 2


def test_reopen_rules(client, db, citizen_h, other_citizen_h, admin_h):
    # INC-503 is resolved; citizen-001 is not a follower yet
    assert client.post("/incidents/INC-503/reopen", json={"note": "x"}, headers=other_citizen_h).status_code == 403
    client.post("/incidents/INC-503/follow", headers=other_citizen_h)
    assert client.post("/incidents/INC-504/reopen", json={"note": "x"}, headers=citizen_h).status_code in (403, 409)
    r = client.post("/incidents/INC-503/reopen", json={"note": "لسه المشكلة موجودة"}, headers=other_citizen_h)
    assert r.status_code == 200 and r.json()["status"] == "received"
    assert r.json()["timeline"][-1]["note"] == "لسه المشكلة موجودة"
    # no longer resolved: reopening again is a conflict
    assert client.post("/incidents/INC-503/reopen", json={"note": "x"}, headers=other_citizen_h).status_code == 409


# ----------------------------------------------------------------------------- map
def test_map_filters(client, db, citizen_h):
    pins = client.get("/map/incidents", headers=citizen_h).json()
    assert len(pins) == db.query(Incident).count()
    assert all(set(p) == {"id", "categoryId", "title", "status", "severity", "lat", "lng"} for p in pins)

    resolved = client.get("/map/incidents?status=resolved", headers=citizen_h).json()
    assert {p["id"] for p in resolved} == {i.id for i in db.query(Incident).filter_by(status="resolved")}
    pot = client.get("/map/incidents?categoryId=pothole", headers=citizen_h).json()
    assert pot and all(p["categoryId"] == "pothole" for p in pot)

    box = "31.325,30.050,31.335,30.060"
    inside = client.get(f"/map/incidents?bbox={box}", headers=citizen_h).json()
    want = {i.id for i in db.query(Incident) if 31.325 <= i.lng <= 31.335 and 30.050 <= i.lat <= 30.060}
    assert {p["id"] for p in inside} == want and 0 < len(want) < len(pins)
    combo = client.get(f"/map/incidents?bbox={box}&status=resolved&categoryId=pothole", headers=citizen_h).json()
    assert all(p["status"] == "resolved" and p["categoryId"] == "pothole" for p in combo)
    assert client.get("/map/incidents?bbox=1,2,3", headers=citizen_h).status_code == 400
    assert client.get("/map/incidents?bbox=a,b,c,d", headers=citizen_h).status_code == 400


# ----------------------------------------------------------------------------- service requests
def sr_body(service_type="bulky_waste", **details):
    d = {"items": ["كنبة قديمة"], "day": "2030-05-01", "slot": "morning", "payment": "cash"}
    d.update(details)
    return {"serviceType": service_type, "details": d, "location": POTHOLE_SPOT}


def test_service_request_create_get_list(client, citizen_h, other_citizen_h, admin_h):
    created = client.post("/service-requests", json=sr_body(note="الدور التالت"), headers=citizen_h)
    assert created.status_code == 200
    sr = created.json()
    assert sr["id"].startswith("SRV-") and sr["status"] == "received"
    assert sr["details"] == {
        "items": ["كنبة قديمة"], "day": "2030-05-01", "slot": "morning", "payment": "cash", "note": "الدور التالت",
    }  # fmt: skip
    assert [t["status"] for t in sr["timeline"]] == ["received"]
    assert client.get(f"/service-requests/{sr['id']}", headers=citizen_h).json() == sr
    assert client.get(f"/service-requests/{sr['id']}", headers=other_citizen_h).status_code == 403
    assert client.get(f"/service-requests/{sr['id']}", headers=admin_h).status_code == 200
    assert client.get("/service-requests/SRV-1", headers=citizen_h).status_code == 404
    mine = client.get("/service-requests", headers=citizen_h).json()
    assert sr["id"] in [s["id"] for s in mine] and "SRV-2001" in [s["id"] for s in mine]
    assert [s["createdAt"] for s in mine] == sorted([s["createdAt"] for s in mine], reverse=True)
    assert client.get("/service-requests", headers=other_citizen_h).json() == []


def test_service_request_payment_rules_and_tree_extras(client, citizen_h):
    no_pay = sr_body()
    del no_pay["details"]["payment"]
    assert client.post("/service-requests", json=no_pay, headers=citizen_h).status_code == 422
    tree = sr_body("tree_maintenance", workType="تقليم", photoUris=["photos/x.jpg"], items=["تقليم"])
    del tree["details"]["payment"]
    sr = client.post("/service-requests", json=tree, headers=citizen_h).json()
    assert "payment" not in sr["details"]
    assert sr["details"]["workType"] == "تقليم" and sr["details"]["photoUris"] == ["photos/x.jpg"]
    assert client.post("/service-requests", json=sr_body(slot="night"), headers=citizen_h).status_code == 422
    assert client.post("/service-requests", json=sr_body(day="1/5"), headers=citizen_h).status_code == 422


# ----------------------------------------------------------------------------- triage
def test_triage_keyword_classifier_port():
    cats = [Category(id=i, label_ar=i, danger=d, default_severity=s, department_id="x") for i, d, s in [
        ("pothole", False, "medium"), ("open_manhole", True, "high"), ("garbage", False, "medium"),
        ("other", False, "low"),
    ]]  # fmt: skip
    out = triage_text("في حفرة كبيرة والعربيات بتقع", cats, {"x": "قسم"})
    assert out["options"][0]["categoryId"] == "pothole"
    assert sum(o["confidence"] for o in out["options"]) <= 1
    assert out["source"] == "fallback" and "الغالب إنها" in out["summary"]
    near_school = triage_text("حفرة جنب المدرسة", cats, {"x": "قسم"})
    assert near_school["severity"] == "high"  # escalated from medium
    assert triage_text("بلاعة صغيرة", cats, {"x": "قسم"}, "open_manhole")["severity"] == "high"  # danger floor
    assert normalize_ar("مَدْرَسَة") == "مدرسه"


def test_triage_endpoint_with_db_duplicates(client, db, citizen_h, other_citizen_h):
    body = {"description": "فيه حفرة كبيرة في الشارع", "location": POTHOLE_SPOT}
    mine = client.post("/triage", json=body, headers=citizen_h).json()
    assert mine["options"][0]["categoryId"] == "pothole" and len(mine["options"]) == 3
    assert mine["severity"] in ("low", "medium", "high", "critical") and mine["summary"]
    # the caller's own report is "already reported" with the report id, never a joinable duplicate
    own = {a["incidentId"]: a for a in mine["alreadyReported"]}
    assert own["INC-501"]["reportId"] == "FTC-1042" and own["INC-501"]["distanceM"] <= 250
    assert "INC-501" not in [d["incidentId"] for d in mine["duplicates"]]

    other = client.post("/triage", json=body, headers=other_citizen_h).json()
    dup = {d["incidentId"]: d for d in other["duplicates"]}
    inc = db.get(Incident, "INC-501")
    assert set(dup["INC-501"]) == {"incidentId", "title", "categoryId", "distanceM", "followers", "status"}
    assert dup["INC-501"]["followers"] == inc.followers_count and other["alreadyReported"] == []
    dists = [d["distanceM"] for d in other["duplicates"]]
    assert dists == sorted(dists) and all(x <= 250 for x in dists)
    expected = {
        i.id
        for i in db.query(Incident)
        if i.status in ("received", "triaged", "assigned", "in_progress")
        and i.category_id in {o["categoryId"] for o in other["options"]}
        and abs(i.lat - 30.0562) < 0.01
    }
    assert set(dup) <= expected

    client.post("/incidents/INC-501/follow", headers=other_citizen_h)  # followed incidents are excluded
    after = client.post("/triage", json=body, headers=other_citizen_h).json()
    assert "INC-501" not in [d["incidentId"] for d in after["duplicates"]]

    far = client.post("/triage", json={**body, "location": {"lat": 31.2, "lng": 29.9}}, headers=citizen_h).json()
    assert far["duplicates"] == [] and far["alreadyReported"] == []
    no_loc = client.post("/triage", json={"description": "زبالة متراكمة"}, headers=citizen_h).json()
    assert no_loc["options"][0]["categoryId"] == "garbage" and no_loc["duplicates"] == []


def test_triage_never_errors_on_empty_text(client, citizen_h):
    r = client.post("/triage", json={"description": ""}, headers=citizen_h)
    assert r.status_code == 200 and len(r.json()["options"]) == 3


# ----------------------------------------------------------------------------- uploads
def test_uploads_sign_stub(client, citizen_h):
    r = client.post("/uploads/sign", json={"kind": "report_photo", "contentType": "image/jpeg"}, headers=citizen_h)
    assert r.status_code == 200
    out = r.json()
    assert out["path"].startswith("photos/") and out["path"].endswith(".jpg")
    assert out["uploadUrl"].endswith("/uploads/local/" + out["path"])
    put = client.put(out["uploadUrl"], content=b"bytes", headers={"Content-Type": "image/jpeg"})
    assert put.status_code == 204
    voice = client.post("/uploads/sign", json={"kind": "voice_note", "contentType": "audio/mp4"}, headers=citizen_h)
    assert voice.json()["path"].startswith("voice/") and voice.json()["path"].endswith(".m4a")
    bad = client.post("/uploads/sign", json={"kind": "report_photo", "contentType": "audio/mp4"}, headers=citizen_h)
    assert bad.status_code == 400


def test_support_models_exist(db):
    assert db.query(Department).count() and db.query(Report).count()
