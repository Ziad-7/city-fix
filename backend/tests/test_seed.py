"""Tests for seed data integrity and completeness."""
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models import (
    Incident, Report, ServiceRequest, Department, Profile, StaffAccount,
    WorkOrder, Category, AISuggestion, ActivityLog
)
from app.helpers import now_utc


class TestSeedIncidents:
    """Tests for seeded incidents."""

    def test_total_incident_count(self, db: Session):
        """Should have exactly 34 incidents."""
        incidents = db.query(Incident).all()
        assert len(incidents) == 34, f"Expected 34 incidents, got {len(incidents)}"

    def test_ten_mobile_incidents_present(self, db: Session):
        """All 10 mobile seed incidents (INC-501 to INC-510) should be present."""
        for n in range(501, 511):
            incident = db.query(Incident).filter_by(id=f"INC-{n}").first()
            assert incident is not None, f"INC-{n} not found"

    def test_additional_incidents_present(self, db: Session):
        """Additional incidents (INC-511 to INC-534) should be present."""
        for n in range(511, 535):
            incident = db.query(Incident).filter_by(id=f"INC-{n}").first()
            assert incident is not None, f"INC-{n} not found"

    def test_incidents_have_correct_titles(self, db: Session):
        """Mobile incidents should have correct titles."""
        inc_501 = db.query(Incident).filter_by(id="INC-501").first()
        assert inc_501.title == "حفرة في شارع عباس العقاد"

    def test_all_categories_covered(self, db: Session):
        """All 12 categories should be represented in incidents."""
        categories = db.query(Category).all()
        category_count = len(categories)
        assert category_count == 12, f"Expected 12 categories, got {category_count}"

        incident_categories = set(i.category_id for i in db.query(Incident).all())
        # All 12 categories should be used
        assert len(incident_categories) == 12, f"Expected 12 incident categories, got {len(incident_categories)}"

    def test_all_statuses_covered(self, db: Session):
        """All 6 incident statuses should be represented."""
        statuses = {i.status for i in db.query(Incident).all()}
        expected_statuses = {"received", "triaged", "assigned", "in_progress", "resolved", "closed"}
        for status in expected_statuses:
            assert status in statuses, f"Status '{status}' not found in incidents"

    def test_overdue_incidents_present(self, db: Session):
        """At least 3 open incidents should be overdue (now > created_at + target_days)."""
        now = now_utc()
        open_statuses = {"received", "triaged", "assigned", "in_progress"}

        overdue_incidents = []
        for incident in db.query(Incident).all():
            if incident.status not in open_statuses:
                continue

            # Get the category to access target_days
            category = db.query(Category).filter_by(id=incident.category_id).first()
            if category:
                created_at = incident.created_at
                # Ensure timezone awareness for comparison
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)

                deadline = created_at + timedelta(days=category.target_days)
                if now > deadline:
                    overdue_incidents.append(incident)

        assert len(overdue_incidents) >= 3, f"Expected >=3 overdue incidents, got {len(overdue_incidents)}: {[i.id for i in overdue_incidents]}"

    def test_critical_severity_incidents(self, db: Session):
        """At least 2 incidents should have critical severity."""
        critical = [i for i in db.query(Incident).all() if i.severity == "critical"]
        assert len(critical) >= 2, f"Expected >=2 critical incidents, got {len(critical)}"

    def test_resolved_in_last_7_days(self, db: Session):
        """At least 4 incidents should be resolved within last 7 days (from activity_log timestamp)."""
        now = now_utc()
        seven_days_ago = now - timedelta(days=7)

        resolved_within_7d = []
        for activity in db.query(ActivityLog).filter(
            ActivityLog.entity_type == "incident",
            ActivityLog.status == "resolved",
        ).all():
            # Ensure timezone awareness
            at = activity.at
            if at.tzinfo is None:
                at = at.replace(tzinfo=timezone.utc)

            if seven_days_ago <= at <= now:
                resolved_within_7d.append(activity.entity_id)

        unique_resolved = set(resolved_within_7d)
        assert len(unique_resolved) >= 4, f"Expected >=4 incidents resolved within 7 days, got {len(unique_resolved)}: {unique_resolved}"

    def test_resolved_7_to_14_days_ago(self, db: Session):
        """At least 2 incidents should be resolved 7-14 days ago (from activity_log timestamp)."""
        now = now_utc()
        fourteen_days_ago = now - timedelta(days=14)
        seven_days_ago = now - timedelta(days=7)

        resolved_7_to_14d_ago = []
        for activity in db.query(ActivityLog).filter(
            ActivityLog.entity_type == "incident",
            ActivityLog.status == "resolved",
        ).all():
            # Ensure timezone awareness
            at = activity.at
            if at.tzinfo is None:
                at = at.replace(tzinfo=timezone.utc)

            if fourteen_days_ago <= at < seven_days_ago:
                resolved_7_to_14d_ago.append(activity.entity_id)

        unique_resolved = set(resolved_7_to_14d_ago)
        assert len(unique_resolved) >= 2, f"Expected >=2 incidents resolved 7-14 days ago, got {len(unique_resolved)}: {unique_resolved}"

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
        """At least 2 open/assigned/in_progress work orders should be overdue (due_at < now)."""
        now = now_utc()
        not_done_statuses = {"open", "assigned", "in_progress"}

        overdue_wos = []
        for wo in db.query(WorkOrder).all():
            if wo.status not in not_done_statuses or not wo.due_at:
                continue

            # Ensure timezone awareness for comparison
            due_at = wo.due_at
            if due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)

            if due_at < now:
                overdue_wos.append(wo)

        assert len(overdue_wos) >= 2, f"Expected >=2 overdue work orders, got {len(overdue_wos)}: {[wo.id for wo in overdue_wos]}"


class TestSeedAISuggestions:
    """Tests for AI suggestions."""

    def test_triage_suggestions_for_received(self, db: Session):
        """Every received incident must have a triage suggestion with confirmed=False and sum(confidences)<=1."""
        received = db.query(Incident).filter_by(status="received").all()
        assert len(received) > 0, "No received incidents found"

        for incident in received:
            # Get reports for this incident, then get suggestions for those reports
            reports = db.query(Report).filter_by(incident_id=incident.id).all()
            assert len(reports) > 0, f"Incident {incident.id} has no reports"

            has_triage = False
            for report in reports:
                suggestions = db.query(AISuggestion).filter_by(
                    report_id=report.id,
                    kind="triage"
                ).all()

                if suggestions:
                    has_triage = True
                    for suggestion in suggestions:
                        payload = suggestion.payload or {}
                        assert payload.get("confirmed") is False, f"Suggestion for {incident.id} has confirmed != False"
                        confidences = payload.get("confidences", {})
                        total_confidence = sum(confidences.values()) if isinstance(confidences, dict) else 0
                        assert total_confidence <= 1.0, f"Suggestion for {incident.id} has sum(confidences)={total_confidence} > 1"

            assert has_triage, f"Incident {incident.id} (with {len(reports)} reports) has no triage suggestion"


class TestMobileIncidentsSync:
    """Tests for mobile ROWS sync with backend seed."""

    def test_mobile_incidents_match_backend(self, db: Session):
        """INC-501..510 should match mobile ROWS data (title, address, lat, lng, status, severity, followers, reporters, sensitivePlace, workOrder)."""
        # Hard-coded ROWS from apps/mobile/src/services/mock/seed.ts
        expected_rows = [
            {"n": 501, "title": "حفرة في شارع عباس العقاد", "address": "شارع عباس العقاد، مدينة نصر", "lat": 30.0562, "lng": 31.3305, "status": "in_progress", "severity": "high", "followers": 7, "reporters": 7, "sensitivePlace": "مدرسة النصر الإعدادية", "workOrder": "WO-318"},
            {"n": 502, "title": "بالوعة مفتوحة في شارع حسن المأمون", "address": "شارع حسن المأمون، مدينة نصر", "lat": 30.0575, "lng": 31.329, "status": "assigned", "severity": "critical", "followers": 12, "reporters": 12, "sensitivePlace": None, "workOrder": "WO-321"},
            {"n": 503, "title": "عمود نور مطفي في شارع مكرم عبيد", "address": "شارع مكرم عبيد، مدينة نصر", "lat": 30.054, "lng": 31.3335, "status": "resolved", "severity": "low", "followers": 2, "reporters": 2, "sensitivePlace": None, "workOrder": None},
            {"n": 504, "title": "زبالة متراكمة في شارع الطيران", "address": "شارع الطيران، مدينة نصر", "lat": 30.059, "lng": 31.335, "status": "received", "severity": "medium", "followers": 3, "reporters": 3, "sensitivePlace": None, "workOrder": None},
            {"n": 505, "title": "طفح مجاري قدام عمارة ١٢", "address": "شارع الحجاز، مدينة نصر", "lat": 30.052, "lng": 31.327, "status": "assigned", "severity": "high", "followers": 5, "reporters": 4, "sensitivePlace": None, "workOrder": "WO-324"},
            {"n": 506, "title": "كسر ماسورة مياه في شارع الثورة", "address": "شارع الثورة، مدينة نصر", "lat": 30.061, "lng": 31.331, "status": "in_progress", "severity": "high", "followers": 9, "reporters": 6, "sensitivePlace": None, "workOrder": "WO-326"},
            {"n": 507, "title": "سلك كهربا مكشوف جنب الحديقة", "address": "شارع يوسف عباس، مدينة نصر", "lat": 30.055, "lng": 31.338, "status": "received", "severity": "critical", "followers": 1, "reporters": 1, "sensitivePlace": "حديقة الأطفال", "workOrder": None},
            {"n": 508, "title": "شجرة مايلة على الرصيف", "address": "شارع مصطفى النحاس، مدينة نصر", "lat": 30.05, "lng": 31.333, "status": "resolved", "severity": "medium", "followers": 4, "reporters": 3, "sensitivePlace": None, "workOrder": None},
            {"n": 509, "title": "رصيف مكسور قدام المستشفى", "address": "شارع أحمد فخري، مدينة نصر", "lat": 30.058, "lng": 31.326, "status": "assigned", "severity": "medium", "followers": 6, "reporters": 5, "sensitivePlace": "مستشفى المبرة", "workOrder": None},
            {"n": 510, "title": "كلاب ضالة جنب المدرسة", "address": "شارع عمر بن الخطاب، مدينة نصر", "lat": 30.053, "lng": 31.33, "status": "triaged", "severity": "medium", "followers": 3, "reporters": 2, "sensitivePlace": "مدرسة الشهيد محمود", "workOrder": None},
        ]

        for expected in expected_rows:
            incident = db.query(Incident).filter_by(id=f"INC-{expected['n']}").first()
            assert incident is not None, f"INC-{expected['n']} not found"

            # Compare fields
            assert incident.title == expected["title"], f"INC-{expected['n']} title mismatch"
            assert incident.address == expected["address"], f"INC-{expected['n']} address mismatch"
            assert abs(incident.lat - expected["lat"]) < 0.0001, f"INC-{expected['n']} lat mismatch"
            assert abs(incident.lng - expected["lng"]) < 0.0001, f"INC-{expected['n']} lng mismatch"
            assert incident.status == expected["status"], f"INC-{expected['n']} status mismatch"
            assert incident.severity == expected["severity"], f"INC-{expected['n']} severity mismatch"
            assert incident.followers_count == expected["followers"], f"INC-{expected['n']} followers mismatch"

            # Check reporters count
            reporters_count = db.query(Report).filter_by(incident_id=incident.id).count()
            assert reporters_count == expected["reporters"], f"INC-{expected['n']} reporters count mismatch"

            # Check sensitive place
            assert incident.sensitive_place == expected["sensitivePlace"], f"INC-{expected['n']} sensitivePlace mismatch"

            # Check work order
            assert incident.work_order_id == expected["workOrder"], f"INC-{expected['n']} workOrder mismatch"


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
