"""Response-shape snapshot: guards the API contract while internals are optimised.

``shape(value)`` reduces a JSON value to its structure (keys and leaf types, never values), so the
snapshot stays stable across timestamps and IDs but fails when a field is added, removed, renamed
or changes type. Regenerate deliberately with ``UPDATE_SHAPES=1 pytest tests/test_api_shapes.py``;
the committed snapshot was generated on the unmodified code (before any optimisation).
"""

import json
import os
from pathlib import Path

from app.models import Collector, Profile

from .conftest import _bearer

SNAPSHOT = Path(__file__).parent / "snapshots" / "api_shapes.json"


def _leaf(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "number"
    return "str"


def _merge(shapes: list):
    """Union of several shapes: dict keys are unioned, differing leaf types are joined as 'a|b'."""
    if all(isinstance(s, dict) for s in shapes):
        keys = sorted({k for s in shapes for k in s})
        return {k: _merge([s[k] for s in shapes if k in s]) for k in keys}
    if all(isinstance(s, list) for s in shapes):
        inner = [i for s in shapes for i in s]
        return [_merge(inner)] if inner else []
    flat = set()
    for s in shapes:
        flat.update(s.split("|") if isinstance(s, str) else [json.dumps(s, sort_keys=True)])
    return "|".join(sorted(flat))


def shape(value):
    if isinstance(value, dict):
        return {k: shape(value[k]) for k in sorted(value)}
    if isinstance(value, list):
        return [_merge([shape(i) for i in value])] if value else []
    return _leaf(value)


class Recorder:
    def __init__(self, client):
        self.client = client
        self.results: dict[str, dict] = {}

    def call(self, role: str, headers: dict, method: str, url: str, *, json_body=None, redact=()):
        resp = self.client.request(method, url, headers=headers, json=json_body)
        try:
            body = resp.json()
        except ValueError:
            body = None
        if isinstance(body, dict):
            body = {k: ("<redacted>" if k in redact else v) for k, v in body.items()}
        self.results[f"{role} {method} {url}"] = {"status": resp.status_code, "shape": shape(body)}
        return resp


def _collector_headers(client, db):
    col = db.get(Collector, "COL-1")
    phone = "0" + db.get(Profile, col.profile_id).phone.removeprefix("+20")
    r = client.post("/auth/verify", json={"phone": phone, "code": "123456"})
    assert r.status_code == 200, r.text
    return _bearer(r.json()["token"])


def test_api_response_shapes(client, db, admin_h, roads_h, citizen_h):
    rec = Recorder(client)
    col_h = _collector_headers(client, db)

    admin_gets = [
        "/health",
        "/auth/me",
        "/admin/departments",
        "/admin/teams",
        "/admin/dashboard",
        "/admin/dashboard?range=today",
        "/admin/dashboard?range=30d",
        "/admin/insights",
        "/admin/incidents",
        "/admin/incidents?status=received",
        "/admin/incidents?categoryId=pothole",
        "/admin/incidents?critical=true",
        "/admin/incidents?overdue=true",
        "/admin/incidents?q=INC",
        "/admin/incidents/INC-501",
        "/admin/incidents/INC-501/similar",
        "/admin/work-orders",
        "/admin/service-requests",
        "/admin/hotspots",
        "/admin/recycling/summary",
        "/admin/recycling/pickups",
        "/admin/collectors",
        "/admin/payouts",
        "/admin/material-prices",
        "/recycling/materials",
        "/incidents",
        "/map/incidents",
        "/bins",
    ]
    for url in admin_gets:
        rec.call("admin", admin_h, "GET", url)
    wos = client.get("/admin/work-orders", headers=admin_h).json()
    rec.call("admin", admin_h, "GET", f"/admin/work-orders/{wos[0]['id']}")
    pickups = client.get("/admin/recycling/pickups", headers=admin_h).json()
    items = pickups["items"] if isinstance(pickups, dict) else pickups
    if items:
        rec.call("admin", admin_h, "GET", f"/admin/recycling/pickups/{items[0]['id']}")

    for url in (
        "/auth/me",
        "/admin/departments",
        "/admin/dashboard",
        "/admin/insights",
        "/admin/incidents",
        "/admin/work-orders",
        "/admin/service-requests",
        "/admin/hotspots",
        "/admin/collectors",
        "/admin/recycling/summary",
    ):
        rec.call("roads", roads_h, "GET", url)

    for url in (
        "/auth/me",
        "/incidents",
        "/incidents/INC-501",
        "/reports",
        "/reports/FTC-1042",
        "/notifications",
        "/service-requests",
        "/map/incidents",
        "/bins",
        "/recycling/pickups",
        "/recycling/materials",
        "/me/impact",
        "/collectors/me",
    ):
        rec.call("citizen", citizen_h, "GET", url)
    rec.call("citizen", citizen_h, "GET", "/admin/incidents")  # forbidden for citizens

    for url in (
        "/collectors/me",
        "/collector/pickups",
        "/collector/jobs?lat=30.06&lng=31.34&radiusM=50000",
        "/collector/earnings",
    ):
        rec.call("collector", col_h, "GET", url)

    # --- writes
    rec.call(
        "admin",
        admin_h,
        "PATCH",
        "/admin/incidents/INC-501",
        json_body={"severity": "high", "note": "snapshot"},
    )
    rec.call("admin", admin_h, "POST", "/admin/budget/optimize", json_body={"budgetEgp": 30000})
    open_inc = next(
        i
        for i in client.get("/admin/incidents", headers=admin_h).json()
        if not i.get("workOrderId") and i["status"] not in ("resolved", "closed")
    )
    rec.call(
        "admin",
        admin_h,
        "POST",
        "/admin/work-orders",
        json_body={"incidentId": open_inc["id"], "department": open_inc["department"], "team": "فريق أ"},
    )
    same = [
        i
        for i in client.get("/admin/incidents", headers=admin_h).json()
        if i["categoryId"] == "garbage" and i["status"] in ("received", "triaged")
    ]
    if len(same) >= 2:
        rec.call(
            "admin",
            admin_h,
            "POST",
            f"/admin/incidents/{same[0]['id']}/merge",
            json_body={"intoIncidentId": same[1]["id"]},
        )

    reg = rec.call(
        "admin",
        admin_h,
        "POST",
        "/admin/bins",
        json_body={
            "id": "BIN-SHAPE-001",
            "name": "حاوية",
            "district": "القاهرة",
            "departmentId": "sanitation",
            "lat": 30.04,
            "lng": 31.23,
            "isSimulated": True,
        },
        redact=("deviceKey",),
    )
    assert reg.status_code == 201, reg.text
    assert reg.json()["deviceKey"]  # present; its value is never snapshotted
    key = reg.json()["deviceKey"]
    ingest = rec.call(
        "device",
        {"X-Device-Key": key},
        "POST",
        "/iot/bins/BIN-SHAPE-001/readings",
        json_body={
            "readings": [
                {
                    "seq": 1,
                    "at": "2026-10-22T18:00:00Z",
                    "fillPct": 85,
                    "distanceCm": 19.2,
                    "tempC": 61,
                    "batteryV": 3.9,
                    "rssi": -85,
                    "fw": "sim-0.1.0",
                }
            ]
        },
    )
    assert ingest.status_code == 202, ingest.text
    for url in (
        "/admin/bins",
        "/admin/bins/forecast",
        "/admin/bins/BIN-SHAPE-001/readings",
        "/admin/bins/BIN-SHAPE-001/latest",
        "/bins",
    ):
        rec.call("admin", admin_h, "GET", url)

    current = rec.results
    if os.environ.get("UPDATE_SHAPES") == "1":
        SNAPSHOT.parent.mkdir(exist_ok=True)
        SNAPSHOT.write_text(json.dumps(current, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf-8")
    expected = json.loads(SNAPSHOT.read_text("utf-8"))
    assert sorted(current) == sorted(expected), "endpoint set changed"
    for key_ in sorted(expected):
        assert current[key_] == expected[key_], f"response shape changed for {key_}"
