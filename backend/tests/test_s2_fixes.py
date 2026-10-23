"""Regression tests for the correctness fixes made while optimising (B1-B5)."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.logic.dashboard import window_bounds
from app.logic.ids import next_id
from app.models import Incident, IncidentFollower, RecyclingPickup, Report


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


# --------------------------------------------------------------------------- B4: readable ids are reserved, not recomputed
def test_b4_reservations_do_not_repeat_before_commit(db):
    """Two reservations in a row (two requests racing before either inserts its row) must differ."""
    first = next_id(db, "INC")
    second = next_id(db, "INC")
    assert first != second
    assert int(second.split("-")[1]) == int(first.split("-")[1]) + 1  # consecutive, as before when nothing races


@pytest.mark.parametrize(
    ("prefix", "model", "make"),
    [
        ("INC", Incident, lambda i: Incident(id=i, category_id="pothole", title="x", lat=30.0, lng=31.0, address="a")),
        (
            "RCY",
            RecyclingPickup,
            lambda i: RecyclingPickup(
                id=i,
                citizen_id="citizen-001",
                items=[],
                lat=30.0,
                lng=31.0,
                address="a",
                district="d",
                day="2026-11-01",
                slot="morning",
                mode="free",
            ),
        ),
    ],
)
def test_b4_counter_resyncs_after_out_of_band_insert(db, prefix, model, make):
    """Rows inserted by a seed script after the counter exists must never collide with the next id."""
    next_id(db, prefix)  # counter row now exists
    db.add(make(f"{prefix}-9999"))
    db.flush()
    assert next_id(db, prefix) == f"{prefix}-10000"


# --------------------------------------------------------------------------- B5: "today" is a Cairo calendar day
CAIRO = ZoneInfo("Africa/Cairo")


@pytest.mark.parametrize(
    "now_utc_value",
    [
        datetime(2026, 10, 23, 22, 30, tzinfo=UTC),  # 01:30 Cairo on the 24th (summer time), still the 23rd in UTC
        datetime(2026, 12, 15, 22, 30, tzinfo=UTC),  # 00:30 Cairo on the 16th (winter time)
        datetime(2026, 7, 1, 12, 0, tzinfo=UTC),  # midday: UTC and Cairo agree on the date
    ],
)
def test_b5_today_window_starts_at_cairo_midnight(now_utc_value):
    since, previous = window_bounds("today", now_utc_value)
    local = now_utc_value.astimezone(CAIRO)
    midnight = datetime(local.year, local.month, local.day, tzinfo=CAIRO)
    assert since == midnight.astimezone(UTC)
    assert since <= now_utc_value
    # the previous window is the Cairo day before, not "now minus 24 h" or UTC midnight
    previous_day = local.date() - timedelta(days=1)
    assert previous == datetime(previous_day.year, previous_day.month, previous_day.day, tzinfo=CAIRO).astimezone(UTC)


def test_b5_other_ranges_unchanged():
    now = datetime(2026, 10, 23, 22, 30, tzinfo=UTC)
    assert window_bounds("7d", now) == (now - timedelta(days=7), now - timedelta(days=14))
    assert window_bounds("30d", now) == (now - timedelta(days=30), now - timedelta(days=60))
