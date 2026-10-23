from datetime import datetime, timedelta, timezone

from app.logic.bin_forecast import _forecast_bin
from app.models import BinReading, SmartBin


def test_forecast_uses_aligned_readings_and_clamps_prediction():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=40,
        interval_min=30,
        full_pct=80,
    )
    readings = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=3 - i)).replace(tzinfo=None),
            fill_pct=10 + (i - 1) * 15,
            clock_unsynced=False,
        )
        for i in (1, 2, 3)
    ]
    result = _forecast_bin(device, readings, latest=readings[-1], horizon_hours=24, now=now)
    assert result["method"] == "linear"
    assert result["predictedFillPct"] == 100
    assert result["hoursToFull"] is not None


def test_forecast_refuses_unsynchronized_latest_sequence():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=4,
        fill_pct=95,
        interval_min=30,
        full_pct=80,
    )
    rows = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=3 - i)).replace(tzinfo=None),
            fill_pct=20 + i,
            clock_unsynced=False,
        )
        for i in (1, 2, 3)
    ]
    latest = BinReading(bin_id="B", seq=4, recorded_at=now.replace(tzinfo=None), fill_pct=95, clock_unsynced=True)
    result = _forecast_bin(device, rows, latest=latest, horizon_hours=24, now=now)
    assert result["currentFillPct"] == 95
    assert result["reason"] == "insufficient_data"
    assert result["predictedFillPct"] is None


def test_stale_latest_reading_that_is_not_terminal_in_time_order_is_rejected():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=40,
        interval_min=30,
        full_pct=80,
    )
    recent = [
        BinReading(
            bin_id="B",
            seq=1,
            recorded_at=(now - timedelta(hours=2)).replace(tzinfo=None),
            fill_pct=10,
            clock_unsynced=False,
        ),
        BinReading(
            bin_id="B",
            seq=2,
            recorded_at=(now - timedelta(hours=1)).replace(tzinfo=None),
            fill_pct=20,
            clock_unsynced=False,
        ),
    ]
    latest = BinReading(
        bin_id="B",
        seq=3,
        recorded_at=(now - timedelta(hours=3)).replace(tzinfo=None),
        fill_pct=40,
        clock_unsynced=False,
    )
    result = _forecast_bin(device, recent, latest=latest, horizon_hours=24, now=now)
    assert result["reason"] == "insufficient_data"
    assert result["predictedFillPct"] is None


def test_collection_reset_discards_pre_reset_readings_and_nonincreasing_stays_linear():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=5,
        fill_pct=20,
        interval_min=30,
        full_pct=80,
    )
    values = [(0, 80), (1, 5), (2, 10), (3, 15), (4, 20)]
    rows = [
        BinReading(
            bin_id="B",
            seq=seq + 1,
            recorded_at=(now - timedelta(hours=4 - seq)).replace(tzinfo=None),
            fill_pct=fill,
            clock_unsynced=False,
        )
        for seq, fill in values
    ]
    result = _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)
    assert result["sampleCount"] == 4
    assert result["method"] == "linear"
    assert result["reason"] == "ok"
    for row in rows[1:]:
        row.fill_pct = 15
    device.fill_pct = 15
    result = _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)
    assert result["reason"] == "non_increasing"
    assert result["predictedFillPct"] == 15


def test_aligned_stale_anchor_and_already_full_are_reported_explicitly():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    stale_device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=40,
        interval_min=30,
        full_pct=80,
    )
    old = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=5 - i)).replace(tzinfo=None),
            fill_pct=10 + i * 10,
            clock_unsynced=False,
        )
        for i in range(1, 4)
    ]
    stale = _forecast_bin(stale_device, old, latest=old[-1], horizon_hours=24, now=now)
    assert stale["reason"] == "stale"
    full_device = SmartBin(
        id="F",
        name="full",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=1,
        fill_pct=80,
        interval_min=30,
        full_pct=80,
    )
    full_row = BinReading(bin_id="F", seq=1, recorded_at=now.replace(tzinfo=None), fill_pct=80, clock_unsynced=False)
    full = _forecast_bin(full_device, [full_row], latest=full_row, horizon_hours=24, now=now)
    assert full["currentFillPct"] == 80
    assert full["hoursToFull"] is None


def test_forecast_function_scopes_staff_to_own_and_unassigned_bins(db):
    from app.logic.bin_forecast import forecast_bins
    from app.models import SmartBin

    db.add_all(
        [
            SmartBin(
                id="ROAD-BIN",
                name="Road bin",
                district="D",
                department_id="roads",
                lat=0,
                lng=0,
                device_key_hash="x",
                fill_pct=40,
                last_seq=0,
            ),
            SmartBin(
                id="WATER-BIN",
                name="Water bin",
                district="D",
                department_id="water",
                lat=0,
                lng=0,
                device_key_hash="x",
                fill_pct=70,
                last_seq=0,
            ),
            SmartBin(
                id="OPEN-BIN",
                name="Open bin",
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
    result = forecast_bins(
        db, {"role": "staff", "department": "roads"}, 12, now=datetime(2026, 1, 1, tzinfo=timezone.utc)
    )
    assert {item["binId"] for item in result["items"]} == {"ROAD-BIN", "OPEN-BIN"}


def test_future_latest_or_mismatched_bin_anchor_refuses_trend():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=30,
        interval_min=30,
        full_pct=80,
    )
    rows = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=3 - i)).replace(tzinfo=None),
            fill_pct=i * 10,
            clock_unsynced=False,
        )
        for i in (1, 2, 3)
    ]
    future = BinReading(
        bin_id="B",
        seq=3,
        recorded_at=(now + timedelta(minutes=1)).replace(tzinfo=None),
        fill_pct=30,
        clock_unsynced=False,
    )
    assert _forecast_bin(device, rows, latest=future, horizon_hours=24, now=now)["reason"] == "insufficient_data"
    device.last_seq = 4
    assert _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)["reason"] == "insufficient_data"
    device.last_seq = 3
    device.fill_pct = 31
    assert _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)["reason"] == "insufficient_data"


def test_duplicate_timestamps_do_not_satisfy_forecast_sample_requirement():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=30,
        interval_min=30,
        full_pct=80,
    )
    rows = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=2 if i < 3 else 0)).replace(tzinfo=None),
            fill_pct=i * 10,
            clock_unsynced=False,
        )
        for i in (1, 2, 3)
    ]
    result = _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)
    assert result["reason"] == "insufficient_data"
    assert result["method"] == "insufficient_data"


def test_near_threshold_crossing_remains_positive_until_bin_is_full():
    now = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    device = SmartBin(
        id="B",
        name="bin",
        district="D",
        lat=0,
        lng=0,
        device_key_hash="x",
        last_seq=3,
        fill_pct=79.999,
        interval_min=30,
        full_pct=80,
    )
    rows = [
        BinReading(
            bin_id="B",
            seq=i,
            recorded_at=(now - timedelta(hours=3 - i)).replace(tzinfo=None),
            fill_pct=59.999 + (i - 1) * 10,
            clock_unsynced=False,
        )
        for i in (1, 2, 3)
    ]
    result = _forecast_bin(device, rows, latest=rows[-1], horizon_hours=24, now=now)
    assert 0 < result["hoursToFull"] < 0.01
