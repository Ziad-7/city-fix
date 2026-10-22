"""Device telemetry ingestion and authenticated Command Center bin APIs."""

import hashlib
import secrets
from datetime import datetime, timezone
from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.admin_auth import require_admin, require_staff
from app.bin_schemas import (
    BinReadingResponse,
    BinReadingsBatch,
    BinResponse,
    CreateBinInput,
)
from app.db import get_db
from app.models import BinReading, SmartBin

iot_router = APIRouter(prefix="/iot", tags=["smart bins"])
admin_router = APIRouter(prefix="/admin/bins", tags=["smart bins"])


def _utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _reading_payload(reading: BinReading) -> dict:
    return {
        "id": reading.id,
        "binId": reading.bin_id,
        "seq": reading.seq,
        "recordedAt": reading.recorded_at.replace(tzinfo=timezone.utc).isoformat(),
        "receivedAt": reading.received_at.replace(tzinfo=timezone.utc).isoformat(),
        "fillPct": reading.fill_pct,
        "distanceCm": reading.distance_cm,
        "tempC": reading.temp_c,
        "batteryV": reading.battery_v,
        "rssi": reading.rssi,
        "firmware": reading.firmware,
        "isFull": reading.is_full,
        "isHot": reading.is_hot,
    }


def _bin_status(bin_device: SmartBin) -> str:
    if not bin_device.last_seen_at:
        return "offline"
    stale_after = max(bin_device.interval_min * 2, 5) * 60
    last_seen = bin_device.last_seen_at.replace(tzinfo=timezone.utc)
    if (datetime.now(timezone.utc) - last_seen).total_seconds() > stale_after:
        return "offline"
    if bin_device.is_full:
        return "full"
    if bin_device.is_hot:
        return "heat"
    if bin_device.battery_v is not None and bin_device.battery_v < 3.3:
        return "low_battery"
    return "normal"


@iot_router.post("/bins/{bin_id}/readings", status_code=202)
def ingest_readings(
    bin_id: str,
    batch: BinReadingsBatch,
    device_key: str | None = Header(default=None, alias="X-Device-Key"),
    db: Session = Depends(get_db),
) -> dict:
    """Authenticate a bin and idempotently accept up to 50 ordered readings."""
    bin_device = db.query(SmartBin).filter_by(id=bin_id, is_active=True).first()
    if not bin_device or not device_key:
        raise HTTPException(401, "device authentication failed")
    supplied_hash = hashlib.sha256(device_key.encode("utf-8")).hexdigest()
    if not compare_digest(supplied_hash, bin_device.device_key_hash):
        raise HTTPException(401, "device authentication failed")

    seqs = [reading.seq for reading in batch.readings]
    if len(seqs) != len(set(seqs)):
        raise HTTPException(422, "reading sequence must be unique within a batch")

    existing_rows = db.query(BinReading).filter(BinReading.bin_id == bin_id, BinReading.seq.in_(seqs)).all()
    existing = {row.seq: row for row in existing_rows}
    for reading in batch.readings:
        stored = existing.get(reading.seq)
        if stored and (
            (reading.at is not None and stored.recorded_at != _utc_naive(reading.at))
            or stored.fill_pct != reading.fill_pct
            or stored.distance_cm != reading.distance_cm
            or stored.temp_c != reading.temp_c
            or stored.battery_v != reading.battery_v
            or stored.rssi != reading.rssi
            or stored.firmware != reading.fw
        ):
            raise HTTPException(409, "reading sequence already exists with different data")

    accepted: list[int] = []
    for reading in batch.readings:
        accepted.append(reading.seq)
        if reading.seq in existing:
            continue
        is_full = reading.fill_pct >= bin_device.full_pct
        is_hot = reading.temp_c >= bin_device.heat_c
        row = BinReading(
            bin_id=bin_id,
            seq=reading.seq,
            recorded_at=_utc_naive(reading.at or datetime.now(timezone.utc)),
            fill_pct=reading.fill_pct,
            distance_cm=reading.distance_cm,
            temp_c=reading.temp_c,
            battery_v=reading.battery_v,
            rssi=reading.rssi,
            firmware=reading.fw,
            is_full=is_full,
            is_hot=is_hot,
        )
        db.add(row)
        if reading.seq > bin_device.last_seq:
            bin_device.last_seq = reading.seq
            bin_device.fill_pct = reading.fill_pct
            bin_device.temp_c = reading.temp_c
            bin_device.battery_v = reading.battery_v
            bin_device.is_full = is_full
            bin_device.is_hot = is_hot
            bin_device.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    return {
        "accepted": accepted,
        "intervalMin": bin_device.interval_min,
        "fullPct": bin_device.full_pct,
        "heatC": bin_device.heat_c,
    }


@admin_router.get("")
def list_bins(claims: dict = Depends(require_staff), db: Session = Depends(get_db)) -> list[BinResponse]:
    query = db.query(SmartBin).order_by(SmartBin.district, SmartBin.name)
    if claims.get("role") == "staff" and claims.get("department"):
        query = query.filter((SmartBin.department_id == claims["department"]) | (SmartBin.department_id.is_(None)))
    bins = query.all()
    return [
        BinResponse.model_validate(
            {
                **{
                    key: getattr(bin_device, key)
                    for key in (
                        "id",
                        "name",
                        "district",
                        "department_id",
                        "lat",
                        "lng",
                        "is_active",
                        "is_simulated",
                        "full_pct",
                        "heat_c",
                        "interval_min",
                        "last_seq",
                        "fill_pct",
                        "temp_c",
                        "battery_v",
                        "is_full",
                        "is_hot",
                        "last_seen_at",
                    )
                },
                "status": _bin_status(bin_device),
            }
        )
        for bin_device in bins
    ]


@admin_router.get("/{bin_id}/readings", response_model=list[BinReadingResponse])
def list_bin_readings(
    bin_id: str,
    claims: dict = Depends(require_staff),
    db: Session = Depends(get_db),
    from_time: datetime | None = Query(default=None, alias="from"),
    to_time: datetime | None = Query(default=None, alias="to"),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[BinReadingResponse]:
    bin_query = db.query(SmartBin).filter_by(id=bin_id)
    if claims.get("role") == "staff" and claims.get("department"):
        bin_query = bin_query.filter(
            (SmartBin.department_id == claims["department"]) | (SmartBin.department_id.is_(None))
        )
    if not bin_query.first():
        raise HTTPException(404, "bin not found")
    query = db.query(BinReading).filter(BinReading.bin_id == bin_id)
    if from_time:
        query = query.filter(BinReading.recorded_at >= _utc_naive(from_time))
    if to_time:
        query = query.filter(BinReading.recorded_at <= _utc_naive(to_time))
    rows = query.order_by(BinReading.recorded_at.desc()).limit(limit).all()
    return [BinReadingResponse.model_validate(_reading_payload(row)) for row in rows]


@admin_router.post("", status_code=201)
def register_bin(
    data: CreateBinInput,
    claims: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    if db.query(SmartBin).filter_by(id=data.id).first():
        raise HTTPException(409, "bin id already exists")
    if data.department_id:
        from app.models import Department

        if not db.query(Department).filter_by(id=data.department_id).first():
            raise HTTPException(422, "department not found")
    device_key = secrets.token_urlsafe(32)
    bin_device = SmartBin(
        **data.model_dump(),
        device_key_hash=hashlib.sha256(device_key.encode("utf-8")).hexdigest(),
    )
    db.add(bin_device)
    db.commit()
    bin_response = BinResponse.model_validate(
        {
            **data.model_dump(),
            "is_active": True,
            "last_seq": 0,
            "fill_pct": None,
            "temp_c": None,
            "battery_v": None,
            "is_full": False,
            "is_hot": False,
            "last_seen_at": None,
            "status": "offline",
        }
    )
    return {
        "bin": bin_response.model_dump(by_alias=True),
        "deviceKey": device_key,
    }


@admin_router.get("/{bin_id}/latest")
def latest_bin_reading(
    bin_id: str,
    claims: dict = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict:
    bin_query = db.query(SmartBin).filter_by(id=bin_id)
    if claims.get("role") == "staff" and claims.get("department"):
        bin_query = bin_query.filter(
            (SmartBin.department_id == claims["department"]) | (SmartBin.department_id.is_(None))
        )
    if not bin_query.first():
        raise HTTPException(404, "bin not found")
    row = db.query(BinReading).filter(BinReading.bin_id == bin_id).order_by(BinReading.seq.desc()).first()
    if row is None:
        raise HTTPException(404, "reading not found")
    return _reading_payload(row)
