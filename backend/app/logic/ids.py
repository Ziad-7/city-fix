"""Readable ID generation (INC-501, FTC-1042, WO-318, SRV-2001, BP-1)."""

from sqlalchemy import case, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.models import (
    BudgetPlan,
    Collector,
    Incident,
    ReadableIdCounter,
    RecyclingPickup,
    Report,
    ServiceRequest,
    Weighing,
    WorkOrder,
)

# prefix -> (model, first sequence number when the table is empty)
_SEQUENCES = {
    "INC": (Incident, 501),
    "FTC": (Report, 1043),
    "WO": (WorkOrder, 334),
    "SRV": (ServiceRequest, 2009),
    "BP": (BudgetPlan, 1),
    "RCY": (RecyclingPickup, 3101),
    "COL": (Collector, 1),
    "WGH": (Weighing, 1),
}


def format_id(prefix: str, seq: int) -> str:
    return f"{prefix}-{seq}"


def next_id(db: Session, entity_type: str) -> str:
    """Reserve the next readable ID transactionally (per-prefix counter row).

    The counter is re-synced to the highest existing ID every time it is behind, so rows inserted out of
    band (seed scripts, demo reset) never collide, and two concurrent creates cannot get the same number:
    the competing transaction waits on the counter row, then increments the committed reservation.
    """
    if entity_type not in _SEQUENCES:
        raise ValueError(f"Unknown entity type: {entity_type}")
    model, first = _SEQUENCES[entity_type]
    prefix = entity_type + "-"
    highest = 0
    for (existing,) in db.query(model.id).filter(model.id.like(prefix + "%")).all():
        try:
            highest = max(highest, int(existing[len(prefix) :]))
        except ValueError:
            continue
    floor = max(first - 1, highest)
    insert = sqlite_insert if db.get_bind().dialect.name == "sqlite" else pg_insert
    db.execute(
        insert(ReadableIdCounter)
        .values(prefix=entity_type, last_value=floor)
        .on_conflict_do_nothing(index_elements=["prefix"])
    )
    value = db.execute(
        update(ReadableIdCounter)
        .where(ReadableIdCounter.prefix == entity_type)
        .values(last_value=case((ReadableIdCounter.last_value < floor, floor), else_=ReadableIdCounter.last_value) + 1)
        .returning(ReadableIdCounter.last_value)
    ).scalar_one()
    return format_id(entity_type, value)
