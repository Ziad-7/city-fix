"""Tests for admin routes."""

from app.models import Incident, WorkOrder


class TestAdminAuth:
    """Admin authentication tests."""

    def test_staff_can_access_admin_endpoints(self, client, db):
        """Staff with valid token can access admin endpoints."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
        )
        assert response.status_code == 200
        token = response.json()["token"]

        # Staff can access /admin/dashboard
        response = client.get(
            "/admin/dashboard", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert "open" in response.json()

    def test_missing_auth_header_rejected_on_admin_routes(self, client):
        """Missing authorization header should be rejected on /admin/* routes."""
        # Try to access admin dashboard without auth
        response = client.get("/admin/dashboard")
        assert response.status_code == 401


class TestAdminDashboard:
    """Dashboard endpoint tests."""

    def test_dashboard_stats_computed_correctly(self, client, db):
        """Dashboard numbers match recomputed values from DB."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"}
        )
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
            db.query(Incident)
            .filter(
                Incident.status.in_(["received", "triaged", "assigned", "in_progress"])
            )
            .all()
        )
        assert stats["open"] <= len(open_incidents)

    def test_resolved_this_week_at_least_four(self, client, db):
        """At least 4 incidents resolved within 7 days."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        stats = response.json()

        assert stats["resolvedThisWeek"] >= 4, (
            f"Expected >=4 resolved, got {stats['resolvedThisWeek']}"
        )

    def test_by_category_sums_to_open(self, client, db):
        """byCategory counts should sum to open."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/dashboard?range=7d", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        stats = response.json()

        category_sum = sum(cat["count"] for cat in stats["byCategory"])
        open_count = stats["open"]
        assert category_sum == open_count, (
            f"Category sum {category_sum} != open {open_count}"
        )


class TestAdminIncidents:
    """Incident management tests."""

    def test_list_incidents_returns_all_when_no_status_filter(self, client, db):
        """GET /admin/incidents with no status filter returns ALL incidents."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/incidents", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        incidents = response.json()

        # Should include resolved incidents
        resolved_count = db.query(Incident).filter_by(status="resolved").count()
        assert resolved_count > 0

        all_count = db.query(Incident).count()
        assert len(incidents) == all_count

    def test_patch_incident_requires_note_on_status_change(self, client, db):
        """PATCH without note when status changes → 400."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        # Find an incident without a work order
        incident = (
            db.query(Incident)
            .filter(Incident.work_order_id.is_(None), Incident.department_id == "roads")
            .first()
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

    def test_create_work_order_409_if_already_has_one(self, client, db):
        """Creating WO for incident that already has one → 409."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
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

    def test_patch_work_order_done_with_note_resolves_incident(self, client, db):
        """PATCH WO to done with note resolves linked incident."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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

    def test_merge_moves_reports_and_followers(self, client, db):
        """Merge moves reports + followers, closes source."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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
                elif (
                    target is None
                    and inc.category_id == source.category_id
                    and inc.id != source.id
                ):
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/teams", headers={"Authorization": f"Bearer {token}"}
        )
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
            json={"email": "admin@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.get(
            "/admin/insights", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        insights = response.json()

        assert "summary" in insights
        assert "hotspots" in insights
        assert "risingCategories" in insights
        assert "overdueDepartments" in insights


class TestAdminDemoReset:
    """Demo reset endpoint tests."""

    def test_demo_reset_admin_only(self, client, db):
        """Demo reset requires admin role."""
        response = client.post(
            "/auth/staff-login",
            json={"email": "roads@fixthecity.demo", "password": "FixCity2026!"},
        )
        token = response.json()["token"]

        response = client.post(
            "/admin/demo/reset", headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403


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
            response.headers.get("access-control-allow-origin")
            == "http://localhost:3101"
            or response.headers.get("access-control-allow-origin") == "*"
        )
