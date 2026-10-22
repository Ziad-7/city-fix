"""Device telemetry through the current app assembly and database-backed staff auth."""

from datetime import datetime


def provision(client, admin_h, bin_id="BIN-MERGE-001", department="sanitation"):
    response = client.post(
        "/admin/bins",
        headers=admin_h,
        json={
            "id": bin_id,
            "name": "حاوية تجريبية",
            "district": "القاهرة",
            "departmentId": department,
            "lat": 30.0444,
            "lng": 31.2357,
            "isSimulated": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def sample(seq=1, fill=85, at="2026-10-22T18:00:00Z"):
    return {
        "seq": seq,
        "at": at,
        "fillPct": fill,
        "distanceCm": 19.25,
        "tempC": 61,
        "batteryV": 3.9,
        "rssi": -85,
        "fw": "sim-0.1.0",
    }


def send(client, registered, readings):
    return client.post(
        f"/iot/bins/{registered['bin']['id']}/readings",
        headers={"X-Device-Key": registered["deviceKey"]},
        json={"readings": readings},
    )


def test_device_reading_reaches_command_center_and_retries_once(client, admin_h):
    registered = provision(client, admin_h)
    endpoint = f"/iot/bins/{registered['bin']['id']}/readings"
    for headers in ({}, {"X-Device-Key": "wrong-key"}):
        assert client.post(endpoint, headers=headers, json={"readings": [sample()]}).status_code == 401

    result = send(client, registered, [sample()])
    assert result.status_code == 202, result.text
    assert result.json() == {"accepted": [1], "intervalMin": 30, "fullPct": 80, "heatC": 60}
    assert send(client, registered, [sample()]).status_code == 202

    fleet = client.get("/admin/bins", headers=admin_h).json()
    device = next(row for row in fleet if row["id"] == registered["bin"]["id"])
    assert device["status"] == "full"
    assert device["isFull"] and device["isHot"] and device["isSimulated"]
    assert device["lastSeq"] == 1 and device["fillPct"] == 85
    assert "deviceKey" not in device and "deviceKeyHash" not in device

    history = client.get(f"/admin/bins/{device['id']}/readings", headers=admin_h).json()
    assert len(history) == 1
    assert history[0]["firmware"] == "sim-0.1.0"
    assert history[0]["distanceCm"] == 19.25 and history[0]["rssi"] == -85


def test_bin_apis_use_current_staff_department_and_citizen_permissions(client, admin_h, roads_h, citizen_h):
    for headers in (roads_h, citizen_h):
        assert (
            client.post(
                "/admin/bins",
                headers=headers,
                json={
                    "id": "BIN-DENIED",
                    "name": "Denied",
                    "lat": 30,
                    "lng": 31,
                },
            ).status_code
            == 403
        )
    assert client.get("/admin/bins", headers=citizen_h).status_code == 403

    sanitation = provision(client, admin_h)
    roads = provision(client, admin_h, "BIN-ROADS", "roads")
    assert send(client, sanitation, [sample()]).status_code == 202
    assert send(client, roads, [sample()]).status_code == 202
    assert [row["id"] for row in client.get("/admin/bins", headers=roads_h).json()] == ["BIN-ROADS"]
    for suffix in ("readings", "latest"):
        assert client.get(f"/admin/bins/BIN-MERGE-001/{suffix}", headers=roads_h).status_code == 404
        assert client.get(f"/admin/bins/BIN-ROADS/{suffix}", headers=roads_h).status_code == 200


def test_offline_backlog_does_not_replace_newer_device_state(client, admin_h):
    registered = provision(client, admin_h)
    assert send(client, registered, [sample(seq=2, fill=35, at=None)]).status_code == 202
    assert send(client, registered, [sample(seq=1, fill=90)]).status_code == 202
    assert send(client, registered, [sample(seq=2, fill=35, at=None)]).status_code == 202

    device = client.get("/admin/bins", headers=admin_h).json()[0]
    assert device["lastSeq"] == 2 and device["fillPct"] == 35 and not device["isFull"]
    latest = client.get("/admin/bins/BIN-MERGE-001/latest", headers=admin_h).json()
    assert latest["seq"] == 2
    assert datetime.fromisoformat(latest["recordedAt"]).tzinfo is not None
    assert len(client.get("/admin/bins/BIN-MERGE-001/readings", headers=admin_h).json()) == 2


def test_conflicting_or_duplicate_sequence_batch_does_not_partially_write(client, admin_h):
    registered = provision(client, admin_h)
    assert send(client, registered, [sample()]).status_code == 202
    assert send(client, registered, [sample(seq=2), sample(seq=2)]).status_code == 422
    assert send(client, registered, [sample(seq=2), sample(fill=10)]).status_code == 409
    history = client.get("/admin/bins/BIN-MERGE-001/readings", headers=admin_h).json()
    assert [row["seq"] for row in history] == [1]
