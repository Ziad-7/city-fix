from app.main import app


def test_analytics_routes_publish_frozen_openapi_models():
    paths = app.openapi()["paths"]
    assert "/admin/bins/forecast" in paths
    assert "/admin/recycling/routes/optimize" in paths
    assert "/admin/hotspots" in paths
    route_body = paths["/admin/recycling/routes/optimize"]["post"]["requestBody"]["content"]["application/json"][
        "schema"
    ]
    schema = app.openapi()["components"]["schemas"][route_body["$ref"].rsplit("/", 1)[-1]]
    assert set(schema["properties"]) == {"pickupIds", "depot", "vehicleCount", "capacityKg"}


def test_optimizer_request_schema_rejects_duplicate_ids_invalid_bounds_and_nonfinite_values():
    import pytest
    from pydantic import ValidationError

    from app.analytics_schemas import OptimizeRoutesInput

    base = {"pickupIds": ["P1"], "depot": {"lat": 30, "lng": 31}, "vehicleCount": 1, "capacityKg": 1}
    for change in (
        {"pickupIds": ["P1", "P1"]},
        {"pickupIds": [f"P{i}" for i in range(101)]},
        {"depot": {"lat": 91, "lng": 31}},
        {"capacityKg": 0},
        {"capacityKg": float("inf")},
    ):
        with pytest.raises(ValidationError):
            OptimizeRoutesInput(**(base | change))
