"""Deterministic linear fill forecasts from clock-synchronized bin telemetry."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import Row, func
from sqlalchemy.orm import Session

from app.models import BinReading, SmartBin

# The forecast only needs these columns; selecting them avoids hydrating ~20k ORM objects (7 days x 30 min x bins).
_READING_COLUMNS = (
    BinReading.bin_id,
    BinReading.seq,
    BinReading.recorded_at,
    BinReading.fill_pct,
    BinReading.clock_unsynced,
)


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _forecast_bin(
    device: SmartBin, readings: list[Row], *, latest: Row | None, horizon_hours: int, now: datetime
) -> dict:
    current = device.fill_pct
    base = {
        "binId": device.id,
        "currentFillPct": current,
        "predictedFillPct": None,
        "hoursToFull": None,
        "sampleCount": 0,
        "method": "insufficient_data",
        "reason": "insufficient_data",
    }
    if (
        latest is None
        or latest.seq != device.last_seq
        or latest.fill_pct != current
        or latest.clock_unsynced is not False
        or _utc(latest.recorded_at) > _utc(now)
    ):
        return base
    age_minutes = (_utc(now) - _utc(latest.recorded_at)).total_seconds() / 60
    sorted_rows = sorted(
        (r for r in readings if r.clock_unsynced is False and _utc(r.recorded_at) <= _utc(now)),
        key=lambda r: (_utc(r.recorded_at), r.seq),
    )
    if not sorted_rows:
        if age_minutes > max(device.interval_min * 2, 60):
            base["reason"] = "stale"
        return base
    if latest not in sorted_rows or sorted_rows[-1].seq != latest.seq:
        return base
    if age_minutes > max(device.interval_min * 2, 60):
        base["reason"] = "stale"
        return base
    reset_index = 0
    for index in range(1, len(sorted_rows)):
        if sorted_rows[index - 1].fill_pct - sorted_rows[index].fill_pct >= 20:
            reset_index = index
    rows = sorted_rows[reset_index:]
    base["sampleCount"] = len(rows)
    if current is None:
        return base
    if (
        len(rows) < 3
        or len({_utc(r.recorded_at) for r in rows}) < 3
        or (_utc(rows[-1].recorded_at) - _utc(rows[0].recorded_at)).total_seconds() < 3600
    ):
        return base
    times = [(_utc(r.recorded_at) - _utc(rows[0].recorded_at)).total_seconds() / 3600 for r in rows]
    fills = [float(r.fill_pct) for r in rows]
    mean_t, mean_y = sum(times) / len(times), sum(fills) / len(fills)
    denominator = sum((t - mean_t) ** 2 for t in times)
    slope = (
        sum((t - mean_t) * (y - mean_y) for t, y in zip(times, fills, strict=True)) / denominator if denominator else 0
    )
    if slope <= 0:
        base.update(method="linear", reason="non_increasing", predictedFillPct=min(100, max(0, float(current))))
        if current >= device.full_pct:
            base["hoursToFull"] = 0
        return base
    predicted = min(100, max(0, float(current) + slope * horizon_hours))
    hours = 0.0 if current >= device.full_pct else max(0.0, (device.full_pct - float(current)) / slope)
    base.update(method="linear", reason="ok", predictedFillPct=round(predicted, 2), hoursToFull=hours)
    return base


def forecast_bins(db: Session, claims: dict, horizon_hours: int, *, now: datetime) -> dict:
    query = db.query(SmartBin).filter(SmartBin.is_active.is_(True))
    if claims.get("role") == "staff":
        query = query.filter((SmartBin.department_id == claims["department"]) | SmartBin.department_id.is_(None))
    devices = query.order_by(SmartBin.id).all()
    ids = [item.id for item in devices]
    since = _utc(now) - timedelta(days=7)
    rows = (
        db.query(*_READING_COLUMNS)
        .filter(BinReading.bin_id.in_(ids), BinReading.recorded_at >= since.replace(tzinfo=None))
        .all()
        if ids
        else []
    )
    by_id: dict[str, list[Row]] = {key: [] for key in ids}
    for row in rows:
        by_id[row.bin_id].append(row)
    latest_rows = {}
    if ids:
        latest_seqs = dict(
            db.query(BinReading.bin_id, func.max(BinReading.seq))
            .filter(BinReading.bin_id.in_(ids))
            .group_by(BinReading.bin_id)
            .all()
        )
        if latest_seqs:
            latest_rows = {
                row.bin_id: row
                for row in db.query(*_READING_COLUMNS)
                .filter(BinReading.bin_id.in_(latest_seqs), BinReading.seq.in_(list(latest_seqs.values())))
                .all()
                if latest_seqs.get(row.bin_id) == row.seq
            }
    return {
        "generatedAt": _utc(now).isoformat().replace("+00:00", "Z"),
        "horizonHours": horizon_hours,
        "items": [
            _forecast_bin(
                device, by_id[device.id], latest=latest_rows.get(device.id), horizon_hours=horizon_hours, now=now
            )
            for device in devices
        ],
    }
