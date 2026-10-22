"""Device telemetry through the current app assembly and database-backed staff auth."""

import hashlib
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bin_schemas import BinReadingInput, BinReadingsBatch
from app.models import Base, BinReading, SmartBin
from app.routers.bins import _advance_latest_state, ingest_readings


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


def test_optional_sensor_values_and_clock_unsynced_timestamp_round_trip(client, admin_h):
    registered = provision(client, admin_h)
    payload = {"seq": 1, "at": None, "fillPct": 25}

    response = send(client, registered, [payload])
    assert response.status_code == 202, response.text
    assert response.json()["accepted"] == [1]
    assert send(client, registered, [payload]).status_code == 202

    fleet = client.get("/admin/bins", headers=admin_h).json()
    assert len(fleet) == 1
    assert fleet[0]["tempC"] is None and fleet[0]["batteryV"] is None
    assert not fleet[0]["isHot"]

    history = client.get("/admin/bins/BIN-MERGE-001/readings", headers=admin_h).json()
    assert len(history) == 1
    assert history[0]["tempC"] is None and history[0]["batteryV"] is None
    assert history[0]["deviceAt"] is None and history[0]["clockUnsynced"] is True
    assert history[0]["recordedAt"] and history[0]["receivedAt"]
    latest = client.get("/admin/bins/BIN-MERGE-001/latest", headers=admin_h).json()
    assert latest["deviceAt"] is None and latest["clockUnsynced"] is True

    # A timestamp may not be changed to null or restored from null on an immutable sequence.
    assert send(client, registered, [{**payload, "at": "2026-10-22T18:00:00Z"}]).status_code == 409
    timed = {"seq": 2, "at": "2026-10-22T18:00:00Z", "fillPct": 30, "batteryV": 3.8}
    assert send(client, registered, [timed]).status_code == 202
    assert send(client, registered, [{**timed, "at": None}]).status_code == 409
    assert send(client, registered, [{**timed, "at": "2026-10-22T18:00:01Z"}]).status_code == 409


def test_sensor_optional_fields_and_boolean_numeric_inputs_are_validated(client, admin_h):
    registered = provision(client, admin_h)
    valid_with_temperature_only = {"seq": 1, "at": None, "fillPct": 10, "tempC": 45}
    valid_with_battery_only = {"seq": 2, "at": None, "fillPct": 20, "batteryV": 3.9}
    assert send(client, registered, [valid_with_temperature_only]).status_code == 202
    assert send(client, registered, [valid_with_battery_only]).status_code == 202

    for invalid in (
        {"seq": True, "at": None, "fillPct": 1},
        {"seq": "3", "at": None, "fillPct": 1},
        {"seq": 3, "at": None, "fillPct": True},
        {"seq": 3, "at": None, "fillPct": 1, "tempC": False},
        {"seq": 3, "at": None, "fillPct": 1, "batteryV": True},
    ):
        assert send(client, registered, [invalid]).status_code == 422


def test_conflicting_batch_with_clock_timestamp_mismatch_is_atomic(client, admin_h):
    registered = provision(client, admin_h)
    assert send(client, registered, [sample(seq=1)]).status_code == 202

    conflict = {"seq": 1, "at": None, "fillPct": 85}
    new_row = {"seq": 2, "at": None, "fillPct": 20}
    assert send(client, registered, [new_row, conflict]).status_code == 409
    history = client.get("/admin/bins/BIN-MERGE-001/readings", headers=admin_h).json()
    assert [row["seq"] for row in history] == [1]


def test_stale_session_cannot_regress_latest_fleet_state():
    with TemporaryDirectory() as directory:
        database = Path(directory) / "bins.db"
        engine = create_engine(f"sqlite:///{database}", connect_args={"check_same_thread": False, "timeout": 10})
        Base.metadata.create_all(engine)
        sessions = sessionmaker(bind=engine, expire_on_commit=False)
        key = "concurrency-test-device-key"
        with sessions() as initial:
            initial.add(
                SmartBin(
                    id="BIN-CONCURRENT",
                    name="Concurrent test",
                    district="Cairo",
                    lat=30,
                    lng=31,
                    device_key_hash=hashlib.sha256(key.encode()).hexdigest(),
                    last_seq=0,
                )
            )
            initial.commit()

        older_session = sessions()
        stale_bin = older_session.query(SmartBin).filter_by(id="BIN-CONCURRENT").one()
        assert stale_bin.last_seq == 0
        older_session.commit()  # preserve the stale ORM object without holding a read transaction

        newer = BinReadingInput(seq=2, at=None, fillPct=70, tempC=65, batteryV=3.9)
        with sessions() as newer_session:
            current = newer_session.query(SmartBin).filter_by(id="BIN-CONCURRENT").one()
            _advance_latest_state(
                newer_session,
                current.id,
                newer,
                is_full=False,
                is_hot=True,
                seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            newer_session.commit()

        older = BinReadingInput(seq=1, at=None, fillPct=10, tempC=20, batteryV=4.1)
        _advance_latest_state(
            older_session,
            stale_bin.id,
            older,
            is_full=False,
            is_hot=False,
            seen_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        older_session.commit()
        older_session.close()

        with sessions() as check:
            fleet = check.query(SmartBin).filter_by(id="BIN-CONCURRENT").one()
            assert (fleet.last_seq, fleet.fill_pct, fleet.temp_c, fleet.battery_v, fleet.is_hot) == (
                2,
                70,
                65,
                3.9,
                True,
            )
        engine.dispose()


def test_concurrent_identical_sequence_retries_are_idempotent(monkeypatch):
    with TemporaryDirectory() as directory:
        database = Path(directory) / "concurrent-retry.db"
        engine = create_engine(f"sqlite:///{database}", connect_args={"check_same_thread": False, "timeout": 10})
        Base.metadata.create_all(engine)
        sessions = sessionmaker(bind=engine)
        key = "concurrent-device-key"
        with sessions() as initial:
            initial.add(
                SmartBin(
                    id="BIN-RETRY",
                    name="Retry test",
                    district="Cairo",
                    lat=30,
                    lng=31,
                    device_key_hash=hashlib.sha256(key.encode()).hexdigest(),
                    last_seq=0,
                )
            )
            initial.commit()

        both_checked_existing = threading.Barrier(2)
        from app.routers import bins as bins_router

        real_insert = bins_router._insert_readings_if_missing

        def synchronized_insert(db, rows):
            both_checked_existing.wait(timeout=5)
            return real_insert(db, rows)

        monkeypatch.setattr(bins_router, "_insert_readings_if_missing", synchronized_insert)
        batch = BinReadingsBatch.model_validate(
            {"readings": [{"seq": 1, "at": None, "fillPct": 55, "tempC": 30, "batteryV": 3.8}]}
        )

        def post_same_reading():
            with sessions() as session:
                return ingest_readings("BIN-RETRY", batch, key, session)

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: post_same_reading(), range(2)))
        assert responses == [
            {"accepted": [1], "intervalMin": 30, "fullPct": 80, "heatC": 60},
            {"accepted": [1], "intervalMin": 30, "fullPct": 80, "heatC": 60},
        ]
        with sessions() as check:
            assert check.query(BinReading).filter_by(bin_id="BIN-RETRY", seq=1).count() == 1
        engine.dispose()
