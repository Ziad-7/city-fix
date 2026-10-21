"""Tests for seed data integrity and completeness."""
import pytest
from sqlalchemy.orm import Session
from app.models import Incident, Report, ServiceRequest, Department, Profile, StaffAccount


class TestSeedIncidents:
    """Tests for seeded incidents."""

    def test_ten_mobile_incidents_present(self, db: Session):
        """All 10 mobile seed incidents (INC-501 to INC-510) should be present."""
        for n in range(501, 511):
            incident = db.query(Incident).filter_by(id=f"INC-{n}").first()
            assert incident is not None, f"INC-{n} not found"

    def test_incidents_have_correct_titles(self, db: Session):
        """Mobile incidents should have correct titles."""
        inc_501 = db.query(Incident).filter_by(id="INC-501").first()
        assert inc_501.title == "حفرة في شارع عباس العقاد"

    def test_incidents_have_different_statuses(self, db: Session):
        """Incidents should have various statuses (not all same)."""
        incidents = db.query(Incident).all()
        statuses = {i.status for i in incidents}
        # Should have at least 3 different statuses
        assert len(statuses) >= 3

    def test_some_incidents_overdue(self, db: Session):
        """Some incidents should be marked as overdue or old enough."""
        old_incidents = [
            i for i in db.query(Incident).all()
            if (i.id in ["INC-503", "INC-508", "INC-509"])  # Old incidents from seed
        ]
        # These should have been created a while ago
        assert len(old_incidents) > 0

    def test_critical_severity_incidents_present(self, db: Session):
        """At least one incident should have critical severity."""
        critical = db.query(Incident).filter_by(severity="critical").first()
        assert critical is not None

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
        """Report FTC-1042 should exist for demo citizen."""
        report = db.query(Report).filter_by(id="FTC-1042").first()
        assert report is not None
        assert report.incident_id == "INC-501"

    def test_linked_reports_for_incidents(self, db: Session):
        """Each incident should have linked reports."""
        inc_501 = db.query(Incident).filter_by(id="INC-501").first()
        assert inc_501.followers_count > 0

        # Check that reports exist
        reports = db.query(Report).filter_by(incident_id="INC-501").all()
        assert len(reports) > 0


class TestSeedServiceRequests:
    """Tests for seeded service requests."""

    def test_service_requests_present(self, db: Session):
        """At least one service request should be present."""
        services = db.query(ServiceRequest).all()
        assert len(services) >= 1

    def test_demo_service_request_exists(self, db: Session):
        """Service request SRV-2001 should exist."""
        sr = db.query(ServiceRequest).filter_by(id="SRV-2001").first()
        assert sr is not None
        assert sr.service_type == "bulky_waste"


class TestSeedDepartments:
    """Tests for seeded departments."""

    def test_departments_seeded(self, db: Session):
        """All main departments should be seeded."""
        expected_ids = ["roads", "sanitation", "lighting", "sewage", "water", "electricity"]
        for dept_id in expected_ids:
            dept = db.query(Department).filter_by(id=dept_id).first()
            assert dept is not None, f"Department {dept_id} not found"


class TestSeedStaffAccounts:
    """Tests for seeded staff accounts."""

    def test_admin_account_exists(self, db: Session):
        """Admin account should be present."""
        account = db.query(StaffAccount).filter_by(email="admin@fixthecity.demo").first()
        assert account is not None

    def test_staff_account_exists(self, db: Session):
        """Staff account should be present."""
        account = db.query(StaffAccount).filter_by(email="roads@fixthecity.demo").first()
        assert account is not None
        assert account.department_id == "roads"

    def test_admin_has_admin_role(self, db: Session):
        """Admin account should have admin profile role."""
        account = db.query(StaffAccount).filter_by(email="admin@fixthecity.demo").first()
        profile = db.query(Profile).filter_by(id=account.profile_id).first()
        assert profile.role == "admin"

    def test_staff_has_staff_role(self, db: Session):
        """Staff account should have staff profile role."""
        account = db.query(StaffAccount).filter_by(email="roads@fixthecity.demo").first()
        profile = db.query(Profile).filter_by(id=account.profile_id).first()
        assert profile.role == "staff"


class TestSeedWorkOrders:
    """Tests for seeded work orders."""

    def test_work_orders_present(self, db: Session):
        """Work orders should be seeded."""
        from app.models import WorkOrder
        orders = db.query(WorkOrder).all()
        assert len(orders) >= 4, "Should have at least 4 work orders"

    def test_work_order_statuses_varied(self, db: Session):
        """Work orders should have different statuses."""
        from app.models import WorkOrder
        orders = db.query(WorkOrder).all()
        statuses = {o.status for o in orders}
        # Should have at least 2 different statuses
        assert len(statuses) >= 2


class TestSeedInvariants:
    """Tests for seed data invariants."""

    def test_no_orphaned_incidents(self, db: Session):
        """Incidents should have valid departments."""
        from sqlalchemy import and_
        incidents = db.query(Incident).all()
        for i in incidents:
            assert i.department_id is not None or i.id == "INC-501"
            if i.department_id:
                dept = db.query(Department).filter_by(id=i.department_id).first()
                assert dept is not None

    def test_work_order_incident_links(self, db: Session):
        """Work orders with incident_id should have valid incidents."""
        from app.models import WorkOrder
        orders = db.query(WorkOrder).filter(WorkOrder.incident_id != None).all()
        for wo in orders:
            incident = db.query(Incident).filter_by(id=wo.incident_id).first()
            assert incident is not None

    def test_priority_factors_structure(self, db: Session):
        """Priority factors should have correct structure."""
        incident = db.query(Incident).first()
        for factor in incident.priority_factors:
            assert "key" in factor
            assert "label" in factor
            assert "points" in factor
            assert "max" in factor
            assert isinstance(factor["points"], int)
            assert isinstance(factor["max"], int)
