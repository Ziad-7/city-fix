"""Insert demo CityCycle rows only when their IDs and unique keys are unused."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.helpers import now_utc
from app.logic.recycling import DEFAULT_DISTRICT, estimate_value
from app.models import (
    ActivityLog,
    BinReading,
    Collector,
    MaterialPriceRow,
    Profile,
    RecyclingPickup,
    SmartBin,
)
from app.recycling_schemas import MATERIAL_IDS
from app.seed_citycycle import _BINS, _HOUSEHOLDS, DEMO_PRICES
from scripts.migrate import _project_matches


def _conflicts(db: Session, row) -> bool:
    """Check primary and all unique constraints without mutating existing rows."""
    table = row.__table__
    keys = [tuple(column.name for column in table.primary_key.columns)]
    keys.extend(
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    )
    keys.extend(tuple(column.name for column in index.columns) for index in table.indexes if index.unique)
    for key in set(keys):
        values = {name: getattr(row, name) for name in key}
        if any(value is None for value in values.values()):
            continue
        if db.execute(select(row.__class__).filter_by(**values).limit(1)).first() is not None:
            return True
    return False


def _rows(now) -> list[tuple[str, list[str], list[object]]]:
    groups: list[tuple[str, list[str], list[object]]] = []
    for material_id in MATERIAL_IDS:
        price = MaterialPriceRow(
            district=DEFAULT_DISTRICT,
            material_id=material_id,
            price_egp_per_kg=DEMO_PRICES[material_id],
            updated_at=now - timedelta(days=1),
        )
        groups.append((f"price:{material_id}", [f"{DEFAULT_DISTRICT}:{material_id}"], [price]))

    day = (now + timedelta(days=2)).date().isoformat()
    for number, hours, items, mode, slot, address, landmark, lat, lng in _HOUSEHOLDS:
        profile_id = f"demo-citycycle-household-{number}"
        pickup_id = f"RCY-DEMO-CITYCYCLE-{number}"
        profile = Profile(id=profile_id, role="citizen", district=DEFAULT_DISTRICT)
        item_rows = [{"materialId": material, "estimatedKg": kg} for material, kg in items]
        pickup = RecyclingPickup(
            id=pickup_id,
            citizen_id=profile_id,
            items=item_rows,
            photo_paths=[],
            lat=lat,
            lng=lng,
            address=address,
            landmark=landmark,
            district=DEFAULT_DISTRICT,
            day=day,
            slot=slot,
            mode=mode,
            estimated_value_egp=estimate_value(item_rows, DEMO_PRICES),
            status="requested",
            created_at=now - timedelta(hours=hours),
        )
        timeline = ActivityLog(
            entity_type="recycling_pickup",
            entity_id=pickup_id,
            status="requested",
            note="طلب تجريبي وصل وبندوّر على جامع قريب",
            actor="CityCycle demo",
            kind="status_change",
            at=now,
        )
        groups.append((f"pickup:{number}", [profile_id, pickup_id], [profile, pickup, timeline]))

    collector_profile_id = "demo-citycycle-collector"
    collector_id = "COL-DEMO-CITYCYCLE-1"
    groups.append(
        (
            "collector",
            [collector_profile_id, collector_id],
            [
                Profile(id=collector_profile_id, role="citizen", name="جامع تجريبي", district=DEFAULT_DISTRICT),
                Collector(
                    id=collector_id,
                    profile_id=collector_profile_id,
                    name="جامع تجريبي",
                    district=DEFAULT_DISTRICT,
                    status="verified",
                    materials=["pet_plastic", "paper_cardboard", "metal_cans", "glass"],
                    vehicle="مركبة تجريبية",
                    joined_at=now - timedelta(days=30),
                ),
            ],
        )
    )

    for bin_id, name, lat, lng, fill, temp, battery, minutes in _BINS:
        if not bin_id.startswith("BIN-"):
            continue
        synthetic_id = f"BIN-DEMO-CITYCYCLE-{bin_id.removeprefix('BIN-')}"
        seen = now - timedelta(minutes=minutes) if minutes is not None else None
        simulated_key_hash = hashlib.sha256(f"cityfix-demo-device:{synthetic_id}".encode()).hexdigest()
        bin_row = SmartBin(
            id=synthetic_id,
            name=f"تجريبي: {name}",
            district="مدينة نصر أول",
            department_id=None,
            lat=lat,
            lng=lng,
            device_key_hash=simulated_key_hash,
            is_simulated=True,
            last_seq=1 if seen else 0,
            fill_pct=fill,
            temp_c=temp,
            battery_v=battery,
            is_full=bool(fill is not None and fill >= 80),
            is_hot=bool(temp is not None and temp >= 60),
            last_seen_at=seen,
        )
        rows: list[object] = [bin_row]
        ids = [synthetic_id]
        if seen:
            rows.append(
                BinReading(
                    bin_id=synthetic_id,
                    seq=1,
                    recorded_at=seen,
                    received_at=seen,
                    fill_pct=fill,
                    temp_c=temp,
                    battery_v=battery,
                    is_full=bool(fill >= 80),
                    is_hot=bool(temp >= 60),
                )
            )
        groups.append((f"bin:{synthetic_id}", ids, rows))
    return groups


def seed_citycycle_additive(db: Session, *, apply: bool = False) -> dict:
    """Plan or atomically apply the additive graph; all existing rows remain untouched."""
    additions: list[object] = []
    skipped: list[dict[str, object]] = []
    added_ids: list[str] = []
    simulated_bins: list[str] = []
    for group, identifiers, rows in _rows(now_utc()):
        if any(_conflicts(db, row) for row in rows):
            skipped.append({"group": group, "ids": identifiers})
            continue
        additions.extend(rows)
        added_ids.extend(identifiers)
        simulated_bins.extend(identifier for identifier in identifiers if identifier.startswith("BIN-"))
    counts: dict[str, int] = {}
    for row in additions:
        table = row.__tablename__
        counts[table] = counts.get(table, 0) + 1
    result = {
        "mode": "apply" if apply else "dry-run",
        "counts": counts,
        "addedIds": sorted(added_ids),
        "skipped": skipped,
        "simulatedBinIds": sorted(simulated_bins),
    }
    if apply and additions:
        try:
            # Flush FK parents before children; a single add_all/flush does not
            # order unrelated pending ORM instances consistently on PostgreSQL.
            flush_order = (Profile, MaterialPriceRow, ActivityLog, Collector, RecyclingPickup, SmartBin, BinReading)
            for model in flush_order:
                batch = [row for row in additions if isinstance(row, model)]
                if batch:
                    db.add_all(batch)
                    db.flush()
            db.commit()
        except Exception:
            db.rollback()
            raise
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add synthetic CityCycle demo rows without changing existing data")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-project-ref", required=True)
    args = parser.parse_args(argv)
    url = settings.database_url
    if not _project_matches(url, args.expected_project_ref):
        print("Database project identity does not match --expected-project-ref", file=sys.stderr)
        return 2
    db = SessionLocal()
    try:
        report = seed_citycycle_additive(db, apply=args.apply)
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0
    except IntegrityError:
        print(
            "Seed could not be applied because a database uniqueness constraint changed concurrently", file=sys.stderr
        )
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
