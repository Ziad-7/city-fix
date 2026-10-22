"""Readable ID generation."""

from sqlalchemy.orm import Session
from app.models import Incident, Report, WorkOrder, ServiceRequest, BudgetPlan


def _next_numeric_id(db: Session, model, prefix: str, width: int, start: int) -> str:
    """Return the next ID after the greatest numeric suffix, independent of lexical order."""
    values = db.query(model.id).filter(model.id.like(f"{prefix}-%")).all()
    sequences = []
    for (value,) in values:
        suffix = value[len(prefix) + 1 :]
        if suffix.isdigit():
            sequences.append(int(suffix))
    return f"{prefix}-{max(sequences, default=start - 1) + 1:0{width}d}"


def format_incident_id(seq: int) -> str:
    """Format incident ID: INC-501, INC-502, etc."""
    return f"INC-{seq}"


def format_report_id(seq: int) -> str:
    """Format report ID: FTC-1042, etc."""
    return f"FTC-{seq}"


def format_work_order_id(seq: int) -> str:
    """Format work order ID: WO-318, etc."""
    return f"WO-{seq}"


def format_service_request_id(seq: int) -> str:
    """Format service request ID: SRV-2001, etc."""
    return f"SRV-{seq}"


def format_budget_plan_id(seq: int) -> str:
    """Format budget plan ID: BP-1, BP-2, etc."""
    return f"BP-{seq}"


def next_id(db: Session, entity_type: str) -> str:
    """Generate next available ID for an entity type.

    Args:
        db: Database session
        entity_type: 'INC', 'FTC', 'WO', 'SRV', or 'BP'

    Returns:
        Next available ID string
    """
    if entity_type == "INC":
        return _next_numeric_id(db, Incident, "INC", 0, 501)

    elif entity_type == "FTC":
        return _next_numeric_id(db, Report, "FTC", 0, 1043)

    elif entity_type == "WO":
        return _next_numeric_id(db, WorkOrder, "WO", 0, 334)

    elif entity_type == "SRV":
        return _next_numeric_id(db, ServiceRequest, "SRV", 0, 2009)

    elif entity_type == "BP":
        return _next_numeric_id(db, BudgetPlan, "BP", 0, 1)

    else:
        raise ValueError(f"Unknown entity type: {entity_type}")
