"""Readable ID generation (INC-501, FTC-1042, WO-318, SRV-2001, BP-1)."""

from sqlalchemy.orm import Session

from app.models import BudgetPlan, Collector, Incident, RecyclingPickup, Report, ServiceRequest, Weighing, WorkOrder

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
    """Next free id for 'INC', 'FTC', 'WO', 'SRV', 'BP', 'RCY', 'COL' or 'WGH' (numeric max + 1, not string order)."""
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
    return format_id(entity_type, max(first, highest + 1))
