"""CONTRACT: Test that all API responses match the exact contract shapes.

Verifies: Incident, AdminIncident, WorkOrder, ServiceRequest, MapPin, StaffSession shapes.
No extra keys beyond optional ones; required keys present.
"""

import pytest


class TestIncidentShape:
    """Incident shape: required + optional keys exactly."""

    def test_admin_incidents_list_has_correct_shape(self, client, db):
        """GET /admin/incidents returns AdminIncident[] with correct keys."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        token = response.json()["token"]

        response = client.get("/admin/incidents", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        incidents = response.json()
        assert len(incidents) > 0

        inc = incidents[0]
        required = {
            "id",
            "categoryId",
            "title",
            "severity",
            "priority",
            "status",
            "department",
            "estimatedCostEgp",
            "linkedReportIds",
            "followers",
            "location",
            "areaUnderserved",
            "timeline",
            "createdAt",
            "updatedAt",
            "linkedReports",
            "dueAt",
            "overdue",
            "external",
            "inBudgetPlan",
        }
        optional = {
            "sensitivePlace",
            "workOrderId",
            "eta",
            "externalHotline",
            "lastReviewedBy",
            "lastReviewedAt",
            "triage",
        }

        keys = set(inc.keys())
        assert required.issubset(keys), f"Missing keys: {required - keys}"
        assert keys.issubset(required | optional), f"Extra keys: {keys - (required | optional)}"

        # Verify priority is object with score and factors
        assert isinstance(inc["priority"], dict)
        assert "score" in inc["priority"]
        assert "factors" in inc["priority"]
        assert isinstance(inc["priority"]["factors"], list)

        # Verify location is object
        assert isinstance(inc["location"], dict)
        assert "lat" in inc["location"]
        assert "lng" in inc["location"]
        assert "address" in inc["location"]

        # Verify linkedReportIds is array
        assert isinstance(inc["linkedReportIds"], list)

        # Verify no flat keys (address/lat/lng/priorityScore should NOT be here)
        assert "lat" not in keys or "location" in keys
        assert "address" not in keys or "location" in keys
        assert "priorityScore" not in keys
        assert "priorityFactors" not in keys
        assert "followersCount" not in keys

    def test_admin_incident_detail_has_correct_shape(self, client, db):
        """GET /admin/incidents/{id} returns AdminIncident with correct keys."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        token = response.json()["token"]

        # Get first incident
        response = client.get("/admin/incidents", headers={"Authorization": f"Bearer {token}"})
        incidents = response.json()
        if not incidents:
            pytest.skip("No incidents in database")

        inc_id = incidents[0]["id"]

        response = client.get(f"/admin/incidents/{inc_id}", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        inc = response.json()

        required = {
            "id",
            "categoryId",
            "title",
            "severity",
            "priority",
            "status",
            "department",
            "estimatedCostEgp",
            "linkedReportIds",
            "followers",
            "location",
            "areaUnderserved",
            "timeline",
            "createdAt",
            "updatedAt",
            "linkedReports",
            "dueAt",
            "overdue",
            "external",
            "inBudgetPlan",
        }

        keys = set(inc.keys())
        assert required.issubset(keys), f"Missing keys: {required - keys}"


class TestWorkOrderShape:
    """WorkOrder shape: correct keys."""

    def test_work_orders_list_has_correct_shape(self, client, db):
        """GET /admin/work-orders returns WorkOrder[] with correct keys."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        token = response.json()["token"]

        response = client.get("/admin/work-orders", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        wos = response.json()

        if not wos:
            pytest.skip("No work orders in database")

        wo = wos[0]
        required = {"id", "title", "address", "department", "status", "estimatedCostEgp", "createdAt", "updatedAt"}
        optional = {
            "incidentId",
            "serviceRequestId",
            "external",
            "externalHotline",
            "team",
            "teamSize",
            "supervisor",
            "dueAt",
            "overdue",
            "priorityScore",
            "followers",
            "tasks",
            "updates",
            "resolvedAt",
        }

        keys = set(wo.keys())
        assert required.issubset(keys), f"Missing keys: {required - keys}"
        assert keys.issubset(required | optional), f"Extra keys: {keys - (required | optional)}"

        # Verify title is incident title (not ID)
        assert wo["title"], "Title must not be empty"
        assert not wo["title"].startswith("WO-"), "Title should not be work order ID"

        # Verify address is present
        assert wo["address"], "Address must not be empty"

        # Verify department is Arabic name, not ID
        assert wo["department"], "Department must not be empty"
        assert not wo["department"].startswith("wd_"), "Department should be Arabic name, not ID"


class TestServiceRequestShape:
    """ServiceRequest shape: location object."""

    def test_service_requests_list_has_correct_shape(self, client, db):
        """GET /admin/service-requests returns ServiceRequest[] with location object."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        token = response.json()["token"]

        response = client.get("/admin/service-requests", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        srs = response.json()

        if not srs:
            pytest.skip("No service requests in database")

        sr = srs[0]
        required = {"id", "citizenId", "serviceType", "details", "location", "status", "timeline", "createdAt"}

        keys = set(sr.keys())
        assert required.issubset(keys), f"Missing keys: {required - keys}"

        # Verify location is object with lat/lng/address
        assert isinstance(sr["location"], dict)
        assert "lat" in sr["location"]
        assert "lng" in sr["location"]
        assert "address" in sr["location"]

        # Verify no flat keys
        assert "lat" not in keys
        assert "lng" not in keys
        assert "address" not in keys


class TestStaffSessionShape:
    """StaffSession shape: admin has no department key."""

    def test_admin_staff_login_omits_department(self, client, db):
        """POST /auth/staff-login admin response has no department key."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        assert response.status_code == 200
        session = response.json()

        required = {"userId", "name", "title", "role", "district", "token"}
        keys = set(session.keys())

        assert required.issubset(keys), f"Missing keys: {required - keys}"
        assert session["role"] == "admin"

        # CRITICAL: admin response must NOT have department key
        assert "department" not in keys, "Admin StaffSession must not include department key"

    def test_staff_staff_login_includes_department(self, client, db):
        """POST /auth/staff-login staff response includes department."""
        response = client.post("/auth/staff-login", json={"email": "roads@cityfix.demo", "password": "FixCity2026!"})
        assert response.status_code == 200
        session = response.json()

        required = {"userId", "name", "title", "role", "district", "token"}
        keys = set(session.keys())

        assert required.issubset(keys), f"Missing keys: {required - keys}"
        assert session["role"] == "staff"
        assert "department" in keys, "Staff StaffSession must include department key"


class TestMapPinShape:
    """MapPin shape: id, categoryId, title, status, severity, lat, lng only."""

    def test_map_pins_have_correct_shape(self, client, db, citizen_h):
        """GET /map/incidents returns MapPin[] with exact keys (Bearer required by the contract)."""
        response = client.get("/map/incidents", headers=citizen_h)
        assert response.status_code == 200
        pins = response.json()
        assert pins, "seed has incidents"

        pin = pins[0]
        required = {"id", "categoryId", "title", "status", "severity", "lat", "lng"}

        keys = set(pin.keys())
        assert keys == required, f"Expected {required}, got {keys}"


class TestDashboardShape:
    """Dashboard shape: all required fields present."""

    def test_dashboard_has_correct_shape(self, client, db):
        """GET /admin/dashboard returns dashboard with correct shape."""
        response = client.post("/auth/staff-login", json={"email": "admin@cityfix.demo", "password": "FixCity2026!"})
        token = response.json()["token"]

        response = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        dashboard = response.json()

        required = {
            "open",
            "openDelta",
            "overdue",
            "resolvedThisWeek",
            "resolvedDelta",
            "avgResolutionDays",
            "avgResolutionDeltaDays",
            "byCategory",
            "byStatus",
            "overdueList",
            "overdueTotal",
            "departments",
            "activity",
            "nav",
        }

        keys = set(dashboard.keys())
        assert required.issubset(keys), f"Missing keys: {required - keys}"
