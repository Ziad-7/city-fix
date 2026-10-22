"""Admin tests whose expectations are computed from the DB (they fail on the old hard-coded behaviour)."""

import itertools
from datetime import timedelta

import pytest

from app.helpers import now_utc
from app.logic.budget import Candidate, knapsack, load_candidates
from app.logic.overdue import aware
from app.models import ActivityLog, Department, Incident, ServiceRequest, WorkOrder

OPEN = ("received", "triaged", "assigned", "in_progress")


def _since(range_):
    now = now_utc()
    if range_ == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    return now - timedelta(days=7 if range_ == "7d" else 30)


@pytest.mark.parametrize("range_", ["today", "7d", "30d"])
def test_t1_dashboard_numbers_match_db(client, db, admin_h, range_):
    d = client.get(f"/admin/dashboard?range={range_}", headers=admin_h).json()
    open_count = db.query(Incident).filter(Incident.status.in_(OPEN)).count()
    assert open_count > 0
    assert d["open"] == open_count
    assert d["open"] == sum(c["count"] for c in d["byCategory"])
    assert d["nav"]["incidentsOpen"] == open_count
    sr_open = [s for s in db.query(ServiceRequest).all() if s.status not in ("resolved", "closed")]
    assert d["nav"]["serviceRequestsOpen"] == len(sr_open)

    since = _since(range_)
    resolved = {
        a.entity_id
        for a in db.query(ActivityLog).filter_by(entity_type="incident", status="resolved")
        if aware(a.at) >= since
    }
    assert d["resolvedThisWeek"] == len(resolved)
    assert {"status": "resolved", "count": len(resolved)} in d["byStatus"]
    created = [i for i in db.query(Incident).all() if aware(i.created_at) >= since]
    assert d["openDelta"] == len(created) - len(resolved)
    assert d["overdueTotal"] == d["overdue"]


def test_t1_overdue_list_rules(client, db, admin_h):
    d = client.get("/admin/dashboard?range=7d", headers=admin_h).json()
    assert 0 < len(d["overdueList"]) <= 5
    scores = [x["priorityScore"] for x in d["overdueList"]]
    assert scores == sorted(scores, reverse=True)
    for x in d["overdueList"]:
        assert x["hoursLate"] >= -12
        assert not x["department"].isascii()  # Arabic name, not an id
        assert ("externalHotline" in x) == x["external"]


def test_t1_staff_dashboard_counts_only_own_department(client, db, roads_h):
    d = client.get("/admin/dashboard?range=30d", headers=roads_h).json()
    own = db.query(Incident).filter(Incident.department_id == "roads", Incident.status.in_(OPEN)).count()
    assert d["open"] == own
    assert [r["department"] for r in d["departments"]] == ["صيانة الطرق"]


def _brute(items, budget):
    best = (0, 0)
    for r in range(len(items) + 1):
        for combo in itertools.combinations(items, r):
            if sum(c.units for c in combo) * 100 <= budget:
                best = max(best, (sum(c.priority for c in combo), sum(c.followers for c in combo)))
    return best


def _cand(i, cost, prio, fol):
    return Candidate(f"INC-{i}", f"t{i}", "pothole", "حفرة", cost, prio, fol)


def test_t2_knapsack_matches_brute_force_on_hand_built_case():
    # greedy by value would take 4 (90); the optimum under 1000 is 1+3 (130)
    items = [_cand(1, 500, 60, 1), _cand(2, 600, 40, 2), _cand(3, 400, 70, 3), _cand(4, 1000, 90, 0)]
    for budget in (0, 300, 500, 900, 1000, 1100, 1500, 2500, 10_000):
        picked = knapsack(items, budget)
        assert sum(items[i].units for i in picked) * 100 <= budget
        got = (sum(items[i].priority for i in picked), sum(items[i].followers for i in picked))
        assert got == _brute(items, budget)
    assert knapsack(items, 1000) == [0, 2]


def test_t2_ties_broken_by_followers_and_cost_rounds_up():
    items = [_cand(1, 150, 50, 1), _cand(2, 200, 50, 9)]  # 150 EGP costs 2 units
    assert knapsack(items, 200) == [1]
    assert _cand(1, 101, 1, 1).units == 2


def test_t2_endpoint_plan_is_optimal_for_db_candidates(client, db, admin_h):
    cands = load_candidates(db)
    r = client.post("/admin/budget/optimize", json={"budgetEgp": 9000}, headers=admin_h).json()
    assert r["totalCost"] <= 9000 and r["remaining"] == 9000 - r["totalCost"]
    assert r["totalCost"] == sum(i["costEgp"] for i in r["selected"])
    assert r["coveredPriority"] == sum(cands[i].priority for i in knapsack(cands, 9000))
    assert len(r["selected"]) + len(r["skipped"]) == len(cands)
    assert all(i["reason"] for i in r["selected"] + r["skipped"])
    first = r["selected"][0]["incidentId"]
    assert client.get(f"/admin/incidents/{first}", headers=admin_h).json()["inBudgetPlan"] is True


def test_t3_merge_moves_reports_and_followers_without_guards(client, db, admin_h, citizen_h, other_citizen_h):
    body = {
        "categoryId": "garbage",
        "description": "زبالة متراكمة قدام العمارة من أسبوع",
        "photoUris": [],
        "location": {"lat": 30.0501, "lng": 31.3301, "address": "شارع الاختبار، مدينة نصر"},
        "anonymous": False,
        "blurFaces": False,
    }
    a = client.post("/reports", json=body, headers=citizen_h).json()["incident"]
    b = client.post("/reports", json=body, headers=other_citizen_h).json()["incident"]
    assert a["id"] != b["id"]
    sim = client.get(f"/admin/incidents/{b['id']}/similar", headers=admin_h).json()
    assert a["id"] in [m["incidentId"] for m in sim]

    r = client.post(f"/admin/incidents/{b['id']}/merge", json={"intoIncidentId": a["id"]}, headers=admin_h)
    assert r.status_code == 200
    target = r.json()
    assert len(target["linkedReports"]) == 2
    assert target["followers"] == 2
    src = client.get(f"/admin/incidents/{b['id']}", headers=admin_h).json()
    assert src["status"] == "closed"
    assert src["linkedReports"] == []
    assert src["timeline"][-1]["note"]


def test_t4_permissions(client, db, admin_h, roads_h, citizen_h):
    assert client.get("/admin/dashboard", headers=citizen_h).status_code == 403
    assert client.get("/admin/incidents", headers=citizen_h).status_code == 403
    assert client.patch("/incidents/INC-501", json={"note": "x"}, headers=citizen_h).status_code == 403
    other = db.query(WorkOrder).filter(WorkOrder.department_id != "roads").first()
    assert client.patch(f"/admin/work-orders/{other.id}", json={"note": "x"}, headers=roads_h).status_code == 403
    assert client.post("/admin/budget/optimize", json={"budgetEgp": 1000}, headers=roads_h).status_code == 403
    assert client.post("/admin/budget/commit", json={"incidentIds": []}, headers=roads_h).status_code == 403
    assert client.post("/admin/demo/reset", headers=roads_h).status_code == 403
    other_inc = db.query(Incident).filter(Incident.department_id != "roads").first()
    assert client.get(f"/admin/incidents/{other_inc.id}", headers=roads_h).status_code == 403
    assert client.get(f"/admin/incidents/{other_inc.id}/similar", headers=roads_h).status_code == 403
    assert client.get("/admin/service-requests", headers=roads_h).json() == []


def test_t4_staff_lists_are_scoped(client, db, roads_h):
    incs = client.get("/admin/incidents", headers=roads_h).json()
    assert incs and {i["department"] for i in incs} == {"صيانة الطرق"}
    wos = client.get("/admin/work-orders", headers=roads_h).json()
    assert wos and {w["department"] for w in wos} == {"صيانة الطرق"}


def test_t6_work_order_fields(client, db, admin_h):
    wos = client.get("/admin/work-orders", headers=admin_h).json()
    assert len(wos) >= 10
    dept_ids = {d.id for d in db.query(Department).all()}
    for w in wos:
        assert w["address"]
        assert w["department"] and w["department"] not in dept_ids
        if "incidentId" in w:
            inc = db.get(Incident, w["incidentId"])
            assert w["title"] == inc.title
            assert w["address"] == inc.address
            assert w["priorityScore"] == inc.priority_score
    ext = [w for w in wos if w["external"]]
    assert ext and all(w["externalHotline"] for w in ext)
    assert any(w["department"] == "شركة مياه الشرب" and w["externalHotline"] == "125" for w in ext)


def test_t7_validation_and_patch_path(client, db, admin_h):
    r = client.patch("/incidents/INC-501", json={"status": "bogus", "note": "x"}, headers=admin_h)
    assert r.status_code == 422 and r.json() == {"detail": "البيانات مش مكتملة"}
    assert client.patch("/incidents/INC-501", json={"severity": "huge"}, headers=admin_h).status_code == 422
    assert client.patch("/incidents/INC-501", json={"categoryId": "nope"}, headers=admin_h).status_code == 422
    assert client.patch("/incidents/INC-501", json={"note": "تحديث"}, headers=admin_h).status_code == 200
    assert client.patch("/incidents/INC-999999", json={"note": "x"}, headers=admin_h).status_code == 404
    assert client.patch("/admin/work-orders/WO-318", json={"status": "weird"}, headers=admin_h).status_code == 422
    assert client.patch("/admin/service-requests/SRV-2001", json={"slot": "night"}, headers=admin_h).status_code == 422
    assert client.post("/admin/budget/optimize", json={"budgetEgp": 0}, headers=admin_h).status_code == 422
    assert client.post("/admin/budget/optimize", json={}, headers=admin_h).status_code == 422


def test_t8_session_shapes(client, admin_h, roads_h):
    creds = {"email": "admin@fixthecity.demo", "password": "FixCity2026!"}
    admin = client.post("/auth/staff-login", json=creds).json()
    assert "department" not in admin and admin["name"] == "سارة محمود" and admin["role"] == "admin"
    assert admin["title"] == "مشرفة فرز · حي مدينة نصر"
    creds = {"email": "roads@fixthecity.demo", "password": "FixCity2026!"}
    roads = client.post("/auth/staff-login", json=creds).json()
    assert roads["department"] == "صيانة الطرق" and roads["role"] == "staff"
    me = client.get("/auth/me", headers=admin_h).json()
    assert "token" not in me and "department" not in me
    assert client.get("/auth/me", headers=roads_h).json()["department"] == "صيانة الطرق"


def test_triage_confirm_rules(client, db, admin_h):
    rec = db.query(Incident).filter(Incident.status == "received").first()
    path = f"/admin/incidents/{rec.id}/triage/confirm"
    r = client.post(path, json={"severity": "critical"}, headers=admin_h).json()
    assert r["status"] == "triaged" and r["severity"] == "critical"
    assert r["triage"]["confirmed"] is True and r["triage"]["source"] == "fallback"
    assert r["lastReviewedBy"] == "سارة محمود" and "lastReviewedAt" in r
    assert r["timeline"][-1]["note"].startswith("اتأكّد التصنيف: ")
    assert r["priority"]["factors"][0]["points"] == 40
    ip = db.query(Incident).filter(Incident.status == "in_progress").first()
    again = client.post(f"/admin/incidents/{ip.id}/triage/confirm", json={}, headers=admin_h).json()
    assert again["status"] == "in_progress"


def test_work_order_create_rules(client, db, admin_h):
    inc = db.query(Incident).filter(Incident.status == "received", Incident.work_order_id.is_(None)).first()
    body = {"incidentId": inc.id, "department": "roads"}
    r = client.post("/admin/work-orders", json=body, headers=admin_h).json()
    assert r["status"] == "open" and r["title"] == inc.title and len(r["tasks"]) >= 3
    got = client.get(f"/admin/incidents/{inc.id}", headers=admin_h).json()
    assert got["status"] == "assigned" and got["workOrderId"] == r["id"]
    ip = db.query(Incident).filter(Incident.status == "in_progress", Incident.work_order_id.is_(None)).first()
    if ip is not None:  # an in-progress incident is not moved backwards
        client.post("/admin/work-orders", json={"incidentId": ip.id, "department": "roads"}, headers=admin_h)
        assert client.get(f"/admin/incidents/{ip.id}", headers=admin_h).json()["status"] == "in_progress"


def test_budget_commit_uses_same_creation_path(client, db, admin_h):
    inc = db.query(Incident).filter(Incident.status == "received", Incident.work_order_id.is_(None)).first()
    wos = client.post("/admin/budget/commit", json={"incidentIds": [inc.id, inc.id]}, headers=admin_h).json()
    assert len(wos) == 1 and wos[0]["title"] == inc.title
    got = client.get(f"/admin/incidents/{inc.id}", headers=admin_h).json()
    assert got["status"] == "assigned" and "ضمن خطة الميزانية" in got["timeline"][-1]["note"]


def test_service_request_patch_persists_json_fields(client, db, admin_h):
    patch = {"day": "2030-01-02", "slot": "afternoon", "assignee": "فريق النظافة 2", "status": "assigned", "note": "تم"}
    assert client.patch("/admin/service-requests/SRV-2001", json=patch, headers=admin_h).status_code == 200
    db.expire_all()
    j = client.get("/admin/service-requests?day=2030-01-02", headers=admin_h).json()
    assert [s["id"] for s in j] == ["SRV-2001"]
    assert j[0]["assignee"] == "فريق النظافة 2" and j[0]["department"]
    bad = client.patch("/admin/service-requests/SRV-2001", json={"status": "resolved"}, headers=admin_h)
    assert bad.status_code == 400
    days = [s["details"]["day"] for s in client.get("/admin/service-requests", headers=admin_h).json()]
    assert days == sorted(days)


def test_insights_are_arabic_and_computed(client, db, admin_h):
    r = client.get("/admin/insights", headers=admin_h).json()
    week = now_utc() - timedelta(days=7)
    created = sum(1 for i in db.query(Incident).all() if aware(i.created_at) >= week)
    assert r["summary"].startswith(f"الأسبوع ده وصل {created} بلاغ جديد واتحل ")
    dept_names = {d.name_ar for d in db.query(Department).all()}
    assert r["overdueDepartments"] and set(r["overdueDepartments"]) <= dept_names
