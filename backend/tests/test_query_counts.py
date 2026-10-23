"""N+1 guard: SQL statement counts must not grow with the amount of data.

Each route is called on the base seed and again after ``add_bulk`` added dozens of incidents,
pickups, bins and collectors. The counts must be equal, and stay at or below the ceiling that was
measured when the route was optimised.
"""

import pytest

from app.models import Incident, IncidentFollower, Profile
from scripts.bench_data import add_bulk

from .query_counter import count_queries

# (name, role, url, ceiling)
_PLAIN = [
    ("admin_incidents", "admin", "/admin/incidents", 9),
    ("citizen_incidents", "citizen", "/incidents", 10),
    ("admin_work_orders", "admin", "/admin/work-orders", 10),
    ("admin_service_requests", "admin", "/admin/service-requests", 10),
    ("admin_dashboard", "admin", "/admin/dashboard", 8),
    ("admin_pickups", "admin", "/admin/recycling/pickups", 6),
    ("admin_forecast", "admin", "/admin/bins/forecast", 6),
    ("admin_collectors", "admin", "/admin/collectors", 4),
]
ROUTES = [pytest.param(*r, id=r[0]) for r in _PLAIN]


def _headers(request, role):
    return request.getfixturevalue({"admin": "admin_h", "citizen": "citizen_h"}[role])


@pytest.mark.parametrize(
    ("name", "role", "url", "ceiling"), ROUTES, ids=[r[0] if isinstance(r, tuple) else r.values[0] for r in ROUTES]
)
def test_statement_count_is_constant_in_data_size(request, client, db, db_engine, name, role, url, ceiling):
    headers = _headers(request, role)
    client.get(url, headers=headers)  # warm caches/imports so only data-dependent statements differ
    with count_queries(db_engine) as base:
        assert client.get(url, headers=headers).status_code == 200
    add_bulk(db, incidents=40, citizens=30, bins=4, readings_per_bin=30, pickups=20, collectors=6)
    with count_queries(db_engine) as bulk:
        assert client.get(url, headers=headers).status_code == 200
    assert len(bulk) == len(base), f"{name}: {len(base)} statements on the seed, {len(bulk)} with bulk data"
    assert len(bulk) <= ceiling, f"{name}: {len(bulk)} statements, ceiling {ceiling}"


def _patch_status(client, db, admin_h, incident_id, status):
    with_engine = db.get_bind().engine
    with count_queries(with_engine) as seen:
        r = client.patch(f"/admin/incidents/{incident_id}", json={"status": status, "note": "تحديث"}, headers=admin_h)
    assert r.status_code == 200, r.text
    return len(seen)


def _add_followers(db, incident_id, total):
    have = db.query(IncidentFollower).filter_by(incident_id=incident_id).count()
    for n in range(have, total):
        pid = f"QC-{incident_id}-{n}"
        db.add(Profile(id=pid, phone=None, name="متابع", role="citizen"))
        db.flush()
        db.add(IncidentFollower(incident_id=incident_id, user_id=pid))
    db.flush()


NOTIFY_CEILING = 28


@pytest.mark.xfail(strict=True, reason="N+1 fixed in O5")
def test_status_change_notification_fanout_is_constant(client, db, admin_h):
    """Notifying 20 followers costs the same number of statements as notifying 2."""
    inc = db.get(Incident, "INC-501")
    assert inc is not None
    _add_followers(db, inc.id, 2)
    few = _patch_status(client, db, admin_h, inc.id, "triaged")
    _add_followers(db, inc.id, 20)
    many = _patch_status(client, db, admin_h, inc.id, "assigned")
    assert many == few, f"{few} statements with ~2 followers, {many} with 20"
    assert many <= NOTIFY_CEILING
