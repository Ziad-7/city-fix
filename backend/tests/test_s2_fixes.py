"""Regression tests for the correctness fixes made while optimising (B1-B5)."""

import pytest


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
