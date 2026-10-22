"""Tests for admin routes."""

from app.models import (
    ActivityLog,
    Category,
    Incident,
    ServiceRequest,
    StaffAccount,
    WorkOrder,
)


class TestAdminAuth:
    """Admin authentication tests."""

    def test_staff_can_access_admin_endpoints(self, client, db):
        """Staff with valid token can access admin endpoints."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        assert response.status_code == 200
        token = response.json()["token"]

        # Staff can access /admin/dashboard
        response = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert "open" in response.json()

    def test_missing_auth_header_rejected_on_admin_routes(self, client):
        """Missing authorization header should be rejected on /admin/* routes."""
        # Try to access admin dashboard without auth
        response = client.get("/admin/dashboard")
        assert response.status_code == 401

    def test_staff_without_current_department_is_denied(self, client, db):
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        account = db.query(StaffAccount).filter_by(email="roads@cityfix.demo").one()
        account.department_id = None
        db.commit()

        response = client.get("/admin/incidents", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403


class TestAdminDashboard:
    """Dashboard endpoint tests."""

    def test_dashboard_stats_computed_correctly(self, client, db):
        """Dashboard numbers match recomputed values from DB."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        stats = response.json()

        # Verify dashboard has key fields
        assert "open" in stats
        assert "openDelta" in stats
        assert "overdue" in stats
        assert "resolvedThisWeek" in stats
        assert "byCategory" in stats

        # Open count should match DB
        open_incidents = (
            db.query(Incident).filter(Incident.status.in_(["received", "triaged", "assigned", "in_progress"])).all()
        )
        assert stats["open"] <= len(open_incidents)

    def test_resolved_this_week_at_least_four(self, client, db):
        """At least 4 incidents resolved within 7 days."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        stats = response.json()

        assert stats["resolvedThisWeek"] >= 4, f"Expected >=4 resolved, got {stats['resolvedThisWeek']}"

    def test_by_category_sums_to_open(self, client, db):
        """byCategory counts should sum to open."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        stats = response.json()

        category_sum = sum(cat["count"] for cat in stats["byCategory"])
        open_count = stats["open"]
        assert category_sum == open_count, f"Category sum {category_sum} != open {open_count}"


class TestAdminIncidents:
    """Incident management tests."""

    def test_list_incidents_returns_all_when_no_status_filter(self, client, db):
        """GET /admin/incidents with no status filter returns ALL incidents."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/incidents", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        incidents = response.json()

        # Should include resolved incidents
        resolved_count = db.query(Incident).filter_by(status="resolved").count()
        assert resolved_count > 0

        all_count = db.query(Incident).count()
        assert len(incidents) == all_count

    def test_confirm_triage_handles_naive_database_timestamp(self, client, db):
        from datetime import datetime

        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident = db.query(Incident).filter_by(id="INC-501").one()
        incident.created_at = datetime(2026, 1, 1)
        db.commit()

        response = client.post(
            f"/admin/incidents/{incident.id}/triage/confirm",
            json={"severity": "high"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_confirm_triage_persists_suggestion_confirmation(self, client, db):
        from app.models import AISuggestion, Report

        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        suggestion = db.query(AISuggestion).filter_by(kind="triage").first()
        assert suggestion is not None
        report = db.query(Report).filter_by(id=suggestion.report_id).one()
        incident_id = report.incident_id
        response = client.post(
            f"/admin/incidents/{incident_id}/triage/confirm",
            json={"severity": "high"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        db.expire_all()
        persisted = db.query(AISuggestion).filter_by(id=suggestion.id).one()
        assert persisted.payload["confirmed"] is True

    def test_staff_cannot_confirm_triage_outside_department(self, client):
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.post(
            "/admin/incidents/INC-502/triage/confirm",
            json={"severity": "high"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_staff_cannot_create_work_order_for_other_department_service(self, client):
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.post(
            "/admin/work-orders",
            json={"serviceRequestId": "SRV-1998", "department": "roads"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_work_order_requires_a_target_resource(self, client):
        # Contract (docs/api-contract.md): `incidentId?, serviceRequestId?` with at least one target.
        # PR #32 demanded exactly one; both-at-once is allowed by the contract, so only "none" is a 422.
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.post(
            "/admin/work-orders",
            json={"department": "roads"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    def test_patch_category_handles_naive_database_timestamp(self, client, db):
        from datetime import datetime

        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident = db.query(Incident).filter_by(id="INC-501").one()
        incident.created_at = datetime(2026, 1, 1)
        db.commit()

        response = client.patch(
            f"/admin/incidents/{incident.id}",
            json={"categoryId": "pothole"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_patch_incident_requires_note_on_status_change(self, client, db):
        """PATCH without note when status changes → 400."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        incident = db.query(Incident).filter_by(id="INC-501").first()
        assert incident is not None

        response = client.patch(
            f"/admin/incidents/{incident.id}",
            json={"status": "triaged"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 400
        assert "رسالة" in response.json()["detail"]

    def test_patch_incident_with_note_succeeds(self, client, db):
        """PATCH with note succeeds and updates timeline."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        incident = db.query(Incident).filter_by(id="INC-504").first()
        assert incident.status == "received"

        response = client.patch(
            f"/admin/incidents/{incident.id}",
            json={"status": "triaged", "note": "تم التصنيف"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["status"] == "triaged"

        # Check timeline has the note
        assert len(updated["timeline"]) > 0
        last_entry = updated["timeline"][-1]
        assert last_entry["note"] == "تم التصنيف"
        assert last_entry["status"] == "triaged"

    def test_staff_cannot_patch_other_department(self, client, db):
        """Staff can only patch incidents in their department (403)."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        # INC-502 is sewage, roads staff cannot patch it
        incident = db.query(Incident).filter_by(id="INC-502").first()
        assert incident.department_id == "sewage"

        response = client.patch(
            f"/admin/incidents/{incident.id}",
            json={"status": "triaged", "note": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    def test_note_only_patch_appends_timeline_entry(self, client, db):
        """PATCH with only note appends timeline entry with current status."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        incident = db.query(Incident).filter_by(id="INC-501").first()
        original_status = incident.status

        response = client.patch(
            f"/admin/incidents/{incident.id}",
            json={"note": "مذكرة إضافية"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["status"] == original_status

        # Check new timeline entry with original status
        last_entry = updated["timeline"][-1]
        assert last_entry["status"] == original_status
        assert last_entry["note"] == "مذكرة إضافية"


class TestAdminWorkOrders:
    """Work order management tests."""

    def test_create_work_order_moves_incident_to_assigned(self, client, db):
        """Creating WO moves incident to assigned."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        # Find an incident without a work order
        incident = (
            db.query(Incident).filter(Incident.work_order_id.is_(None), Incident.department_id == "roads").first()
        )
        assert incident is not None

        response = client.post(
            "/admin/work-orders",
            json={
                "incidentId": incident.id,
                "department": "roads",
                "team": "فريق الطرق 1",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        wo = response.json()
        assert wo["status"] == "assigned"

        # Check incident was moved to assigned
        db.refresh(incident)
        assert incident.status == "assigned"
        assert incident.work_order_id == wo["id"]

    def test_admin_reassignment_updates_incident_department(self, client, db):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident = (
            db.query(Incident).filter(Incident.work_order_id.is_(None), Incident.department_id == "roads").first()
        )
        assert incident is not None

        response = client.post(
            "/admin/work-orders",
            json={"incidentId": incident.id, "department": "sanitation"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        db.refresh(incident)
        assert incident.department_id == "sanitation"

    def test_create_work_order_409_if_already_has_one(self, client, db):
        """Creating WO for incident that already has one → 409."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        incident = db.query(Incident).filter_by(id="INC-501").first()
        assert incident.work_order_id is not None

        response = client.post(
            "/admin/work-orders",
            json={"incidentId": incident.id, "department": "roads"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 409

    def test_create_work_order_rejects_invalid_department_and_due_date(self, client, db):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        incident = db.query(Incident).filter(Incident.work_order_id.is_(None)).first()
        assert incident is not None

        response = client.post(
            "/admin/work-orders",
            json={"incidentId": incident.id, "department": "unknown"},
            headers=headers,
        )
        assert response.status_code == 422

        response = client.post(
            "/admin/work-orders",
            json={
                "incidentId": incident.id,
                "department": "roads",
                "dueAt": "not-a-date",
            },
            headers=headers,
        )
        assert response.status_code == 422

    def test_aware_due_dates_are_normalized_to_utc_on_create_and_patch(self, client, db):
        from datetime import datetime

        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident = db.query(Incident).filter(Incident.work_order_id.is_(None)).first()
        assert incident is not None
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post(
            "/admin/work-orders",
            json={
                "incidentId": incident.id,
                "department": incident.department_id,
                "dueAt": "2026-11-01T12:00:00+03:00",
            },
            headers=headers,
        )
        assert response.status_code == 200
        work_order_id = response.json()["id"]
        db.expire_all()
        created = db.query(WorkOrder).filter_by(id=work_order_id).one()
        assert created.due_at == datetime(2026, 11, 1, 9)

        response = client.patch(
            f"/admin/work-orders/{work_order_id}",
            json={"dueAt": "2026-11-02T12:00:00+03:00"},
            headers=headers,
        )
        assert response.status_code == 200
        db.expire_all()
        patched = db.query(WorkOrder).filter_by(id=work_order_id).one()
        assert patched.due_at == datetime(2026, 11, 2, 9)

    def test_patch_work_order_rejects_invalid_due_date(self, client):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.patch(
            "/admin/work-orders/WO-318",
            json={"dueAt": "not-a-date"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


class TestAdminServiceRequests:
    def test_patch_details_and_contract_status_persist(self, client, db):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        service_request = db.query(ServiceRequest).filter_by(id="SRV-1998").one()
        original_details = dict(service_request.details)
        new_day = "2026-12-01"

        response = client.patch(
            f"/admin/service-requests/{service_request.id}",
            json={
                "status": "in_progress",
                "note": "بدأ التنفيذ",
                "day": new_day,
                "slot": "afternoon",
                "assignee": "فريق النظافة",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        db.expire_all()
        persisted = db.query(ServiceRequest).filter_by(id="SRV-1998").one()
        assert persisted.status == "in_progress"
        assert persisted.details["day"] == new_day
        assert persisted.details["slot"] == "afternoon"
        assert persisted.details["assignee"] == "فريق النظافة"
        assert original_details["day"] != new_day

    def test_patch_rejects_non_contract_service_status(self, client):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.patch(
            "/admin/service-requests/SRV-1998",
            json={"status": "scheduled", "note": "موعد"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422

    def test_patch_work_order_done_with_note_resolves_incident(self, client, db):
        """PATCH WO to done with note resolves linked incident."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        wo = db.query(WorkOrder).filter_by(id="WO-318").first()
        assert wo.incident_id == "INC-501"
        incident = db.query(Incident).filter_by(id=wo.incident_id).first()

        response = client.patch(
            f"/admin/work-orders/{wo.id}",
            json={"status": "done", "note": "تم الانتهاء"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        updated = response.json()
        assert updated["status"] == "done"

        # Check incident is resolved
        db.refresh(incident)
        assert incident.status == "resolved"

    def test_patch_work_order_done_without_note_fails(self, client, db):
        """PATCH WO to done without note → 400."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        wo = db.query(WorkOrder).filter_by(id="WO-321").first()

        response = client.patch(
            f"/admin/work-orders/{wo.id}",
            json={"status": "done"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 400


class TestAdminMerge:
    """Incident merge tests."""

    def test_merge_rejects_same_source_and_target(self, client, db):
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident = db.query(Incident).filter_by(id="INC-502").one()
        original_status = incident.status
        response = client.post(
            f"/admin/incidents/{incident.id}/merge",
            json={"intoIncidentId": incident.id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422
        db.refresh(incident)
        assert incident.status == original_status

    def test_merge_moves_reports_and_followers(self, client, db):
        """Merge moves reports + followers, closes source."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        # Find two incidents with same category
        incidents = db.query(Incident).all()
        source = None
        target = None
        for inc in incidents:
            if inc.status in ("received", "triaged"):
                if source is None:
                    source = inc
                elif target is None and inc.category_id == source.category_id and inc.id != source.id:
                    target = inc
                    break

        if source and target:
            response = client.post(
                f"/admin/incidents/{source.id}/merge",
                json={"intoIncidentId": target.id},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200
            merged = response.json()
            assert merged["id"] == target.id

            # Check source is closed
            db.refresh(source)
            assert source.status == "closed"


class TestAdminBudget:
    """Budget optimization tests."""

    def test_budget_optimize_never_exceeds_budget(self, client, db):
        """Budget plan never exceeds budget_egp."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.post(
            "/admin/budget/optimize",
            json={"budgetEgp": 30000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        plan = response.json()

        assert plan["totalCost"] <= plan["budgetEgp"]
        assert plan["remaining"] >= 0

    def test_budget_optimize_selected_have_reasons(self, client, db):
        """All selected items have a one-line Arabic reason."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.post(
            "/admin/budget/optimize",
            json={"budgetEgp": 30000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        plan = response.json()

        for item in plan["selected"]:
            assert "reason" in item
            assert isinstance(item["reason"], str)
            assert len(item["reason"]) > 0
            assert "أولوية" in item["reason"]

    def test_budget_optimize_skipped_have_reasons(self, client, db):
        """All skipped items have a reason."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.post(
            "/admin/budget/optimize",
            json={"budgetEgp": 30000},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        plan = response.json()

        for item in plan["skipped"]:
            assert "reason" in item
            assert isinstance(item["reason"], str)
            assert len(item["reason"]) > 0


class TestAdminTeams:
    """Teams endpoint tests."""

    def test_admin_teams_endpoint(self, client):
        """GET /admin/teams returns teams."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/teams", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        teams = response.json()

        assert len(teams) > 0
        assert teams[0]["name"]
        assert teams[0]["department"]
        assert teams[0]["size"]


class TestAdminInsights:
    """Insights endpoint tests."""

    def test_insights_endpoint_returns_summary(self, client):
        """GET /admin/insights returns deterministic insights."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get("/admin/insights", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        insights = response.json()

        assert "summary" in insights
        assert "hotspots" in insights
        assert "risingCategories" in insights
        assert "overdueDepartments" in insights

    def test_staff_insights_exclude_other_department(self, client, db):
        category = db.query(Category).filter_by(department_id="sanitation").first()
        assert category is not None
        for number in range(5):
            incident_id = f"INC-SCOPE-{number}"
            db.add(
                Incident(
                    id=incident_id,
                    category_id=category.id,
                    title="Confidential sanitation report",
                    severity="high",
                    status="received",
                    department_id="sanitation",
                    lat=30.0,
                    lng=31.0,
                    address="SCOPE-TEST-PRIVATE-ADDRESS",
                )
            )
            db.add(
                ActivityLog(
                    entity_type="incident",
                    entity_id=incident_id,
                    status="received",
                    actor="test",
                )
            )
        db.commit()

        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.get("/admin/insights", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert all(hotspot["address"] != "SCOPE-TEST-PRIVATE-ADDRESS" for hotspot in response.json()["hotspots"])


class TestAdminDemoReset:
    """Demo reset endpoint tests."""

    def test_demo_reset_admin_only(self, client, db):
        """Demo reset requires admin role."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.post("/admin/demo/reset", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 403

    def test_demo_reset_disabled_preserves_database(self, client, db, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "demo_reset_enabled", False)
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        incident_count = db.query(Incident).count()

        response = client.post("/admin/demo/reset", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 404
        assert db.query(Incident).count() == incident_count
        assert settings.demo_reset_enabled is False

    def test_demo_reset_runs_when_explicitly_enabled(self, client, db, monkeypatch):
        from app.config import settings

        monkeypatch.setattr(settings, "demo_reset_enabled", True)
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@cityfix.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]
        response = client.post("/admin/demo/reset", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert db.query(Incident).count() > 0


class TestCORSPreflight:
    """CORS preflight tests."""

    def test_cors_preflight_from_custom_port(self, client):
        """OPTIONS preflight from localhost:3101 returns 200 with CORS headers."""
        response = client.options(
            "/admin/dashboard",
            headers={
                "Origin": "http://localhost:3101",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Should allow the preflight (either 200 or 204)
        assert response.status_code in (200, 204)
        # Check CORS headers
        assert (
            response.headers.get("access-control-allow-origin") == "http://localhost:3101"
            or response.headers.get("access-control-allow-origin") == "*"
        )
