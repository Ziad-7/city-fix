from app.models import SmartBin


def test_forecast_http_auth_scope_and_horizon_validation(client, db, roads_h, citizen_h):
    db.add_all(
        [
            SmartBin(
                id="HTTP-ROAD",
                name="Road",
                district="D",
                department_id="roads",
                lat=0,
                lng=0,
                device_key_hash="x",
                fill_pct=40,
                last_seq=0,
            ),
            SmartBin(
                id="HTTP-WATER",
                name="Water",
                district="D",
                department_id="water",
                lat=0,
                lng=0,
                device_key_hash="x",
                fill_pct=70,
                last_seq=0,
            ),
            SmartBin(
                id="HTTP-OPEN",
                name="Open",
                district="D",
                department_id=None,
                lat=0,
                lng=0,
                device_key_hash="x",
                fill_pct=20,
                last_seq=0,
            ),
        ]
    )
    db.flush()
    assert client.get("/admin/bins/forecast").status_code == 401
    assert client.get("/admin/bins/forecast", headers=citizen_h).status_code == 403
    invalid = client.get("/admin/bins/forecast?horizonHours=169", headers=roads_h)
    assert invalid.status_code == 422
    response = client.get("/admin/bins/forecast?horizonHours=24", headers=roads_h)
    assert response.status_code == 200
    assert {item["binId"] for item in response.json()["items"]} == {"HTTP-ROAD", "HTTP-OPEN"}


def test_optimizer_http_admin_gate_and_invalid_request_shape(client, roads_h, admin_h):
    body = {"pickupIds": ["RCY-NOT-LOOKED-UP"], "depot": {"lat": 30, "lng": 31}, "vehicleCount": 1, "capacityKg": 1}
    assert client.post("/admin/recycling/routes/optimize", json=body, headers=roads_h).status_code == 403
    duplicate = {**body, "pickupIds": ["P", "P"]}
    assert client.post("/admin/recycling/routes/optimize", json=duplicate, headers=admin_h).status_code == 422
    bad_coords = {**body, "depot": {"lat": 91, "lng": 31}}
    assert client.post("/admin/recycling/routes/optimize", json=bad_coords, headers=admin_h).status_code == 422


def test_hotspot_http_staff_gate_and_query_bounds(client, roads_h, citizen_h):
    assert client.get("/admin/hotspots").status_code == 401
    assert client.get("/admin/hotspots", headers=citizen_h).status_code == 403
    assert client.get("/admin/hotspots?days=0", headers=roads_h).status_code == 422
    assert client.get("/admin/hotspots?radiusMeters=99", headers=roads_h).status_code == 422
