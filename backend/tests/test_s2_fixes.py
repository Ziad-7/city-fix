"""Regression tests for the correctness fixes made while optimising (B1-B5)."""


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
