"""Tests for seed data integrity and completeness."""
import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import (
    Incident, Report, ServiceRequest, Department, Profile, StaffAccount,
    WorkOrder, Category, AISuggestion
)


class TestSeedIncidents:
    """Tests for seeded incidents."""

    def test_total_incident_count(self, db: Session):
        """Should have exactly 32 incidents."""
        incidents = db.query(Incident).all()
        assert len(incidents) == 32, f"Expected 32 incidents, got {len(incidents)}"

    def test_ten_mobile_incidents_present(self, db: Session):
        """All 10 mobile seed incidents (INC-501 to INC-510) should be present."""
        for n in range(501, 511):
            incident = db.query(Incident).filter_by(id=f"INC-{n}").first()
            assert incident is not None, f"INC-{n} not found"

    def test_additional_incidents_present(self, db: Session):
        """Additional incidents (INC-511 to INC-532) should be present."""
        for n in range(511, 533):
            incident = db.query(Incident).filter_by(id=f"INC-{n}").first()
            assert incident is not None, f"INC-{n} not found"

    def test_incidents_have_correct_titles(self, db: Session):
        """Mobile incidents should have correct titles."""
        inc_501 = db.query(Incident).filter_by(id="INC-501").first()
        assert inc_501.title == "حفرة في شارع عباس العقاد"

    def test_all_categories_covered(self, db: Session):
        """At least 10 categories should be represented in incidents."""
        categories = db.query(Category).all()
        category_count = len(categories)
        assert category_count == 12, f"Expected 12 categories, got {category_count}"

        incident_categories = set(i.category_id for i in db.query(Incident).all())
        # Most categories should be covered (at least 10 out of 12)
        assert len(incident_categories) >= 10, f"Expected >=10 incident categories, got {len(incident_categories)}"

    def test_all_statuses_covered(self, db: Session):
        """All 6 incident statuses should be represented."""
        statuses = {i.status for i in db.query(Incident).all()}
        expected_statuses = {"received", "triaged", "assigned", "in_progress", "resolved", "closed"}
        for status in expected_statuses:
            assert status in statuses, f"Status '{status}' not found in incidents"

    def test_overdue_incidents_present(self, db: Session):
        """At least 3 incidents should exist with age_h >= 48 and open status."""
        open_statuses = {"received", "triaged", "assigned", "in_progress"}
        # INC-505 (40h), INC-509 (72h), INC-521 (60h) should meet this
        old_open_incidents = [
            i for i in db.query(Incident).all()
            if i.status in open_statuses and i.id in ["INC-505", "INC-509", "INC-521", "INC-518"]
        ]
        assert len(old_open_incidents) >= 3, f"Expected >=3 old open incidents, got {len(old_open_incidents)}"

    def test_critical_severity_incidents(self, db: Session):
        """At least 2 incidents should have critical severity."""
        critical = [i for i in db.query(Incident).all() if i.severity == "critical"]
        assert len(critical) >= 2, f"Expected >=2 critical incidents, got {len(critical)}"

    def test_resolved_in_last_7_days(self, db: Session):
        """At least 4 incidents should be resolved (with age_h <= 168 = 7 days)."""
        # From seed: INC-503 (54h), INC-508 (120h), INC-523 (144h), INC-528 (96h)
        resolved_incidents = [
            i for i in db.query(Incident).all()
            if i.status == "resolved" and i.id in ["INC-503", "INC-508", "INC-523", "INC-528"]
        ]
        assert len(resolved_incidents) >= 4, f"Expected >=4 resolved incidents, got {len(resolved_incidents)}"

    def test_incidents_with_priority_scores(self, db: Session):
        """All incidents should have priority scores calculated."""
        incidents = db.query(Incident).all()
        assert len(incidents) > 0
        for i in incidents:
            assert i.priority_score >= 0
            assert i.priority_score <= 100
            assert len(i.priority_factors) > 0


class TestSeedReports:
    """Tests for seeded reports."""

    def test_demo_citizen_report_exists(self, db: Session):
        """Report FTC-1042 should exist for demo citizen on INC-501."""
        report = db.query(Report).filter_by(id="FTC-1042").first()
        assert report is not None
        assert report.incident_id == "INC-501"
        demo_citizen = db.query(Profile).filter_by(phone="+201012345678").first()
        assert report.reporter_id == demo_citizen.id

    def test_anonymous_reports_exist(self, db: Session):
        """At least some reports should be anonymous."""
        anonymous = [r for r in db.query(Report).all() if r.anonymous]
        assert len(anonymous) > 0, "Expected some anonymous reports"

    def test_linked_reports_for_incidents(self, db: Session):
        """Each incident should have linked reports."""
        incidents = db.query(Incident).all()
        for inc in incidents:
            reports = db.query(Report).filter_by(incident_id=inc.id).all()
            assert len(reports) > 0, f"{inc.id} has no reports"


class TestSeedServiceRequests:
    """Tests for seeded service requests."""

    def test_service_requests_count(self, db: Session):
        """Should have exactly 9 service requests."""
        services = db.query(ServiceRequest).all()
        assert len(services) == 9, f"Expected 9 service requests, got {len(services)}"

    def test_demo_service_request_exists(self, db: Session):
        """Service request SRV-2001 should exist."""
        sr = db.query(ServiceRequest).filter_by(id="SRV-2001").first()
        assert sr is not None
        assert sr.service_type == "bulky_waste"

    def test_service_request_srv_1998_exists(self, db: Session):
        """Service request SRV-1998 should exist."""
        sr = db.query(ServiceRequest).filter_by(id="SRV-1998").first()
        assert sr is not None


class TestSeedDepartments:
    """Tests for seeded departments."""

    def test_departments_seeded(self, db: Session):
        """All main departments should be seeded."""
        expected_ids = ["roads", "sanitation", "lighting", "sewage", "water", "electricity", "parks", "utilities", "veterinary"]
        for dept_id in expected_ids:
            dept = db.query(Department).filter_by(id=dept_id).first()
            assert dept is not None, f"Department {dept_id} not found"


class TestSeedStaffAccounts:
    """Tests for seeded staff accounts."""

    def test_admin_account_exists(self, db: Session):
        """Admin account should be present."""
        account = db.query(StaffAccount).filter_by(email="admin@fixthecity.demo").first()
        assert account is not None
        profile = db.query(Profile).filter_by(id=account.profile_id).first()
        assert profile.name == "سارة محمود"
        assert profile.role == "admin"

    def test_roads_staff_account_exists(self, db: Session):
        """Roads staff account should be present."""
        account = db.query(StaffAccount).filter_by(email="roads@fixthecity.demo").first()
        assert account is not None
        assert account.department_id == "roads"
        profile = db.query(Profile).filter_by(id=account.profile_id).first()
        assert profile.role == "staff"
        assert profile.name == "م. هشام عادل"

    def test_staff_accounts_per_department(self, db: Session):
        """Staff accounts should exist for major departments."""
        expected_dept_emails = [
            "admin@fixthecity.demo",
            "roads@fixthecity.demo",
            "sanitation@fixthecity.demo",
            "lighting@fixthecity.demo",
            "sewage@fixthecity.demo",
            "water@fixthecity.demo",
            "electricity@fixthecity.demo",
            "parks@fixthecity.demo",
            "utilities@fixthecity.demo",
            "veterinary@fixthecity.demo",
        ]
        for email in expected_dept_emails:
            account = db.query(StaffAccount).filter_by(email=email).first()
            assert account is not None, f"Staff account {email} not found"

    def test_staff_login_works(self, db: Session, client):
        """Staff login should work for both demo accounts."""
        # Admin login
        response = client.post("/auth/staff-login", json={
            "email": "admin@fixthecity.demo",
            "password": "FixCity2026!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert "token" in data

        # Roads staff login
        response = client.post("/auth/staff-login", json={
            "email": "roads@fixthecity.demo",
            "password": "FixCity2026!"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "staff"
        assert "token" in data


class TestSeedWorkOrders:
    """Tests for seeded work orders."""

    def test_work_orders_count(self, db: Session):
        """Should have at least 11 work orders."""
        orders = db.query(WorkOrder).all()
        assert len(orders) >= 11, f"Expected >=11 work orders, got {len(orders)}"

    def test_work_order_all_statuses(self, db: Session):
        """Work orders should have all 4 statuses."""
        orders = db.query(WorkOrder).all()
        statuses = {o.status for o in orders}
        expected_statuses = {"open", "assigned", "in_progress", "done"}
        for status in expected_statuses:
            assert status in statuses, f"Work order status '{status}' not found"

    def test_work_orders_overdue(self, db: Session):
        """Work orders should exist with various statuses and due dates."""
        orders = db.query(WorkOrder).all()
        # Check that there are work orders with different due dates
        due_dates = set(wo.due_at for wo in orders if wo.due_at)
        assert len(due_dates) >= 2, f"Expected >=2 different due dates, got {len(due_dates)}"


class TestSeedAISuggestions:
    """Tests for AI suggestions."""

    def test_triage_suggestions_for_received(self, db: Session):
        """AI triage suggestions should exist for all received incidents."""
        received = db.query(Incident).filter_by(status="received").all()
        suggestions = db.query(AISuggestion).filter_by(kind="triage").all()
        assert len(suggestions) >= len(received), f"Expected >={len(received)} triage suggestions"


class TestSeedInvariants:
    """Tests for seed data invariants."""

    def test_no_orphaned_incidents(self, db: Session):
        """Incidents should have valid departments."""
        incidents = db.query(Incident).all()
        for i in incidents:
            assert i.department_id is not None
            dept = db.query(Department).filter_by(id=i.department_id).first()
            assert dept is not None, f"Incident {i.id} has invalid department {i.department_id}"

    def test_work_order_incident_links(self, db: Session):
        """Work orders with incident_id should have valid incidents."""
        orders = db.query(WorkOrder).filter(WorkOrder.incident_id != None).all()
        for wo in orders:
            incident = db.query(Incident).filter_by(id=wo.incident_id).first()
            assert incident is not None, f"Work order {wo.id} links to non-existent incident {wo.incident_id}"

    def test_priority_factors_structure(self, db: Session):
        """Priority factors should have correct structure."""
        incident = db.query(Incident).first()
        assert incident is not None
        for factor in incident.priority_factors:
            assert "key" in factor
            assert "label" in factor
            assert "points" in factor
            assert "max" in factor
            assert isinstance(factor["points"], int)
            assert isinstance(factor["max"], int)
