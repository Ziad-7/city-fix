"""Device telemetry ingestion and authenticated Command Center bin APIs."""

import hashlib
import secrets
from datetime import datetime, timezone
from hmac import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.admin_auth import current_claims, require_admin, require_staff
from app.bin_schemas import (
    BinReadingResponse,
    BinReadingsBatch,
    BinResponse,
    CreateBinInput,
)
from app.db import get_db
from app.helpers import iso_z
from app.logic.domain import create_report
from app.media import MediaStorage, get_media, validate_media
from app.models import BinReading, BinReport, Category, HubWeighing, Incident, RecyclingPickup, Report, SmartBin
from app.recycling_schemas import BinPatchInput, HubWeighingInput, ReportFullInput
from app.schemas import NewReportInput, PlaceInput

iot_router = APIRouter(prefix="/iot", tags=["smart bins"])
admin_router = APIRouter(prefix="/admin/bins", tags=["smart bins"])
public_router = APIRouter(tags=["smart bins"])


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
        "deviceAt": reading.device_at.replace(tzinfo=timezone.utc).isoformat() if reading.device_at else None,
        "clockUnsynced": reading.clock_unsynced,
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


def _reading_matches(stored: BinReading, reading) -> bool:
    device_at = _utc_naive(reading.at) if reading.at is not None else None
    return (
        stored.device_at == device_at
        and stored.clock_unsynced == (reading.at is None)
        and stored.fill_pct == reading.fill_pct
        and stored.distance_cm == reading.distance_cm
        and stored.temp_c == reading.temp_c
        and stored.battery_v == reading.battery_v
        and stored.rssi == reading.rssi
        and stored.firmware == reading.fw
    )


def _insert_readings_if_missing(db: Session, rows: list[dict]) -> None:
    """Use the database unique key to make simultaneous retries idempotent."""
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    elif dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        # The application currently supports SQLite for local use and PostgreSQL
        # for deployment. Preserve a portable fallback for other SQLAlchemy engines.
        db.add_all(BinReading(**row) for row in rows)
        db.flush()
        return

    if rows:
        statement = insert(BinReading).values(rows).on_conflict_do_nothing(index_elements=["bin_id", "seq"])
        db.execute(statement)


def _advance_latest_state(db: Session, bin_id: str, reading, *, is_full: bool, is_hot: bool, seen_at: datetime) -> None:
    """Atomically advance fleet state; stale concurrent requests cannot move it back."""
    db.execute(
        update(SmartBin)
        .where(SmartBin.id == bin_id, SmartBin.last_seq < reading.seq)
        .values(
            last_seq=reading.seq,
            fill_pct=reading.fill_pct,
            temp_c=reading.temp_c,
            battery_v=reading.battery_v,
            is_full=is_full,
            is_hot=is_hot,
            last_seen_at=seen_at,
        )
    )


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
        if stored and not _reading_matches(stored, reading):
            raise HTTPException(409, "reading sequence already exists with different data")

    received_at = datetime.now(timezone.utc).replace(tzinfo=None)
    missing_rows = []
    for reading in batch.readings:
        if reading.seq in existing:
            continue
        device_at = _utc_naive(reading.at) if reading.at is not None else None
        is_full = reading.fill_pct >= bin_device.full_pct
        is_hot = reading.temp_c is not None and reading.temp_c >= bin_device.heat_c
        missing_rows.append(
            {
                "bin_id": bin_id,
                "seq": reading.seq,
                "recorded_at": device_at or received_at,
                "received_at": received_at,
                "device_at": device_at,
                "clock_unsynced": reading.at is None,
                "fill_pct": reading.fill_pct,
                "distance_cm": reading.distance_cm,
                "temp_c": reading.temp_c,
                "battery_v": reading.battery_v,
                "rssi": reading.rssi,
                "firmware": reading.fw,
                "is_full": is_full,
                "is_hot": is_hot,
            }
        )
    _insert_readings_if_missing(db, missing_rows)

    # Re-read after INSERT .. ON CONFLICT DO NOTHING. A concurrent request may
    # have inserted the same sequence while this request was in flight.
    stored_rows = db.query(BinReading).filter(BinReading.bin_id == bin_id, BinReading.seq.in_(seqs)).all()
    stored_by_seq = {row.seq: row for row in stored_rows}
    for reading in batch.readings:
        stored = stored_by_seq.get(reading.seq)
        if stored is None or not _reading_matches(stored, reading):
            raise HTTPException(409, "reading sequence already exists with different data")

    latest = max(batch.readings, key=lambda item: item.seq)
    _advance_latest_state(
        db,
        bin_id,
        latest,
        is_full=latest.fill_pct >= bin_device.full_pct,
        is_hot=latest.temp_c is not None and latest.temp_c >= bin_device.heat_c,
        seen_at=received_at,
    )
    db.commit()
    return {
        "accepted": seqs,
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


# --------------------------------------------------------------------------- citizen map layer and full-bin reports
_STATE = {"offline": "offline", "full": "full", "heat": "hot", "low_battery": "low_battery", "normal": "ok"}


def _public_bin(b: SmartBin) -> dict:
    out: dict = {
        "id": b.id,
        "name": b.name,
        "location": {"lat": b.lat, "lng": b.lng, "address": b.name},
        "kind": "hub" if b.id.upper().startswith("HUB") else "street",
        "state": _STATE[_bin_status(b)],
    }
    if b.fill_pct is not None:
        out["fillPct"] = b.fill_pct
    if b.temp_c is not None:
        out["tempC"] = b.temp_c
    if b.battery_v is not None:
        out["batteryV"] = b.battery_v
    if b.last_seen_at is not None:
        out["lastSeenAt"] = iso_z(b.last_seen_at)
    return out


@public_router.get("/bins")
def list_public_bins(
    claims: dict = Depends(current_claims),
    bbox: str | None = Query(default=None, description="minLng,minLat,maxLng,maxLat"),
    district: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Active bins for the map layer: location, state and fill level only (no device data)."""
    query = db.query(SmartBin).filter(SmartBin.is_active.is_(True))
    if district:
        query = query.filter(SmartBin.district == district)
    if bbox:
        try:
            min_lng, min_lat, max_lng, max_lat = (float(v) for v in bbox.split(","))
        except ValueError:
            raise HTTPException(400, "bbox غلط") from None
        query = query.filter(SmartBin.lat.between(min_lat, max_lat), SmartBin.lng.between(min_lng, max_lng))
    return [_public_bin(b) for b in query.order_by(SmartBin.district, SmartBin.name).all()]


@public_router.post("/bins/{bin_id}/report-full", status_code=204)
def report_full_bin(
    bin_id: str,
    body: ReportFullInput,
    storage: MediaStorage | None = Depends(get_media),
    claims: dict = Depends(current_claims),
    db: Session = Depends(get_db),
) -> Response:
    """A citizen reports a full bin: a FixFirst ``garbage`` incident (new, or the open one for this bin)."""
    bin_device = db.query(SmartBin).filter_by(id=bin_id, is_active=True).first()
    if not bin_device:
        raise HTTPException(404, "مش موجود")
    user_id = claims["sub"]
    photos = [body.photo_uri] if body.photo_uri else []
    validate_media(user_id, photos, None, storage)
    category = db.get(Category, "garbage")
    if category is None:
        raise HTTPException(503, "الخدمة مش متاحة دلوقتي")

    link_to = None
    open_ids = [
        r.incident_id
        for r in db.query(BinReport).filter(BinReport.bin_id == bin_id).order_by(BinReport.created_at.desc()).all()
    ]
    if open_ids:
        link_to = (
            db.query(Incident)
            .filter(Incident.id.in_(open_ids), Incident.status.notin_(("resolved", "closed")))
            .order_by(Incident.created_at.desc())
            .first()
        )
    if link_to is not None and (
        db.query(Report).filter(Report.incident_id == link_to.id, Report.reporter_id == user_id).first()
    ):
        return Response(status_code=204)  # already reported by this person

    note = (body.note or "").strip()
    description = f"الحاوية الذكية {bin_device.name} ممتلئة" + (f". {note}" if note else "")
    data = NewReportInput(
        category_id="garbage",
        description=description,
        photo_uris=photos,
        location=PlaceInput(lat=bin_device.lat, lng=bin_device.lng, address=bin_device.name),
    )
    _, incident = create_report(db, user_id, data, category, link_to)
    db.add(BinReport(bin_id=bin_id, incident_id=incident.id, reporter_id=user_id, note=note or None))
    db.commit()
    return Response(status_code=204)


# --------------------------------------------------------------------------- admin edit / key rotation
@admin_router.patch("/{bin_id}")
def patch_bin(
    bin_id: str,
    body: BinPatchInput,
    claims: dict = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict:
    """Edit settings, deactivate (``isActive: false`` revokes device auth) or rotate the device key (shown once)."""
    bin_device = db.query(SmartBin).filter_by(id=bin_id).first()
    if not bin_device:
        raise HTTPException(404, "bin not found")
    for field in ("name", "is_active", "full_pct", "heat_c", "interval_min"):
        value = getattr(body, field)
        if value is not None:
            setattr(bin_device, field, value)
    response: dict = {}
    if body.rotate_key:
        device_key = secrets.token_urlsafe(32)
        bin_device.device_key_hash = hashlib.sha256(device_key.encode("utf-8")).hexdigest()
        response["deviceKey"] = device_key
    db.commit()
    response["bin"] = {
        "id": bin_device.id,
        "name": bin_device.name,
        "isActive": bin_device.is_active,
        "fullPct": bin_device.full_pct,
        "heatC": bin_device.heat_c,
        "intervalMin": bin_device.interval_min,
    }
    return response


# --------------------------------------------------------------------------- hub scale
@iot_router.post("/hubs/{hub_id}/weighings", status_code=202)
def ingest_hub_weighing(
    hub_id: str,
    body: HubWeighingInput,
    device_key: str | None = Header(default=None, alias="X-Device-Key"),
    db: Session = Depends(get_db),
) -> dict:
    """A hub scale reports a weighing. Same device auth; idempotent on ``(hubId, seq)``."""
    hub = db.query(SmartBin).filter_by(id=hub_id, is_active=True).first()
    if not hub or not device_key:
        raise HTTPException(401, "device authentication failed")
    if not compare_digest(hashlib.sha256(device_key.encode("utf-8")).hexdigest(), hub.device_key_hash):
        raise HTTPException(401, "device authentication failed")
    recorded = datetime.now(timezone.utc)
    if body.at:
        try:
            recorded = datetime.fromisoformat(body.at.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(422, "البيانات مش مكتملة") from None
    recorded_naive = _utc_naive(recorded)
    if body.pickup_id and not db.get(RecyclingPickup, body.pickup_id):
        raise HTTPException(422, "pickup not found")
    stored = db.query(HubWeighing).filter_by(hub_id=hub_id, seq=body.seq).first()
    if stored:
        if stored.material_id != body.material or stored.kg != body.kg:
            raise HTTPException(409, "weighing sequence already exists with different data")
        return {"accepted": body.seq}
    db.add(
        HubWeighing(
            hub_id=hub_id,
            seq=body.seq,
            recorded_at=recorded_naive,
            material_id=body.material,
            kg=body.kg,
            pickup_id=body.pickup_id,
        )
    )
    db.commit()
    return {"accepted": body.seq}
