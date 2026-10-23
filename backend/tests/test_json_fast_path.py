"""json_response() must produce exactly the bytes FastAPI's default encoder path would."""

import importlib

import pytest
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

import app.helpers as helpers
from scripts.bench_data import add_bulk

# (module that imported json_response, url, fixture holding the auth headers)
ROUTES = [
    ("app.routers.admin", "/admin/incidents", "admin_h"),
    ("app.routers.admin", "/admin/incidents?status=received", "admin_h"),
    ("app.routers.admin", "/admin/work-orders", "admin_h"),
    ("app.routers.admin", "/admin/service-requests", "admin_h"),
    ("app.routers.incidents", "/incidents", "citizen_h"),
    ("app.routers.incidents", "/incidents", "admin_h"),
    ("app.routers.map", "/map/incidents", "citizen_h"),
    ("app.routers.reports", "/reports", "citizen_h"),
    ("app.routers.recycling_admin", "/admin/recycling/pickups", "admin_h"),
    ("app.routers.recycling_admin", "/admin/recycling/pickups", "roads_h"),
]


@pytest.mark.parametrize(("module", "url", "who"), ROUTES, ids=[f"{r[1]}-{r[2]}" for r in ROUTES])
def test_fast_path_is_byte_identical_to_default_encoder(request, client, db, monkeypatch, module, url, who):
    add_bulk(db, incidents=60, citizens=30, bins=2, readings_per_bin=10, pickups=30, collectors=4)
    headers = request.getfixturevalue(who)
    captured = []

    def recording(content):
        captured.append(content)
        return helpers.json_response(content)

    monkeypatch.setattr(importlib.import_module(module), "json_response", recording)
    response = client.get(url, headers=headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert len(captured) == 1, "route no longer goes through json_response"
    assert captured[0], "empty payload would make this test meaningless"
    assert response.content == JSONResponse(jsonable_encoder(captured[0])).body


def test_untouched_routes_keep_the_default_path(client, admin_h):
    """Routes with a response_model are deliberately not routed through json_response."""
    for url in ("/admin/bins", "/admin/bins/forecast", "/admin/hotspots"):
        response = client.get(url, headers=admin_h)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
