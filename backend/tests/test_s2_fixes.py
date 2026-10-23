"""Regression tests for the correctness fixes made while optimising (B1-B5)."""

import pytest

from app.models import Incident, IncidentFollower, Report


# --------------------------------------------------------------------------- B1: collector writes are admin-only
def test_b1_department_staff_cannot_change_collector_status(client, roads_h, admin_h):
    """docs/api-contract.md: every CityCycle write is admin only, PATCH /admin/collectors/{id} included."""
    denied = client.patch("/admin/collectors/COL-2", headers=roads_h, json={"status": "verified"})
    assert denied.status_code == 403
    still_pending = next(c for c in client.get("/admin/collectors", headers=admin_h).json() if c["id"] == "COL-2")
    assert still_pending["status"] == "pending"

    allowed = client.patch("/admin/collectors/COL-2", headers=admin_h, json={"status": "verified"})
    assert allowed.status_code == 200
    assert allowed.json()["status"] == "verified"


# --------------------------------------------------------------------------- B2: unknown status filter is a 422
@pytest.mark.parametrize("path", ["/admin/incidents", "/admin/work-orders", "/admin/service-requests"])
def test_b2_unknown_status_filter_is_422_not_500(client, admin_h, path):
    """On Postgres these are native enums; an unknown label used to raise DataError (HTTP 500)."""
    bad = client.get(f"{path}?status=bogus", headers=admin_h)
    assert bad.status_code == 422
    assert bad.json() == {"detail": "البيانات مش مكتملة"}
    assert client.get(path, headers=admin_h).status_code == 200


def test_b2_valid_status_filters_still_work(client, admin_h):
    assert client.get("/admin/incidents?status=received", headers=admin_h).status_code == 200
    assert client.get("/admin/work-orders?status=in_progress", headers=admin_h).status_code == 200
    assert client.get("/admin/service-requests?status=received", headers=admin_h).status_code == 200


# --------------------------------------------------------------------------- B3: a closed source cannot be merged again
def _three_open_incidents(db):
    rows = (
        db.query(Incident)
        .filter(Incident.status.in_(("received", "triaged", "assigned", "in_progress")))
        .order_by(Incident.id)
        .limit(3)
        .all()
    )
    assert len(rows) == 3
    return rows


def test_b3_merged_incident_cannot_be_merged_again(client, db, admin_h):
    source, target, other = _three_open_incidents(db)
    first = client.post(f"/admin/incidents/{source.id}/merge", headers=admin_h, json={"intoIncidentId": target.id})
    assert first.status_code == 200
    reports_before = db.query(Report).filter_by(incident_id=other.id).count()
    followers_before = db.query(IncidentFollower).filter_by(incident_id=other.id).count()
    count_before = other.followers_count

    again = client.post(f"/admin/incidents/{source.id}/merge", headers=admin_h, json={"intoIncidentId": other.id})
    assert again.status_code == 400
    assert again.json()["detail"] == "مينفعش تدمج بلاغ اتحل أو اتقفل"

    db.refresh(other)
    assert db.query(Report).filter_by(incident_id=other.id).count() == reports_before
    assert db.query(IncidentFollower).filter_by(incident_id=other.id).count() == followers_before
    assert other.followers_count == count_before
    timeline = client.get(f"/admin/incidents/{source.id}", headers=admin_h).json()["timeline"]
    assert sum(1 for t in timeline if "اتدمج" in (t.get("note") or "")) == 1  # one merge entry, not two
