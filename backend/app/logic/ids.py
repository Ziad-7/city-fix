"""Readable ID generation."""

from sqlalchemy.orm import Session
from app.models import Incident, Report, WorkOrder, ServiceRequest, BudgetPlan


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
        last = db.query(Incident).order_by(Incident.id.desc()).first()
        if last and last.id.startswith("INC-"):
            try:
                seq = int(last.id[4:]) + 1
            except (ValueError, IndexError):
                seq = 501
        else:
            seq = 501
        return format_incident_id(seq)

    elif entity_type == "FTC":
        last = db.query(Report).order_by(Report.id.desc()).first()
        if last and last.id.startswith("FTC-"):
            try:
                seq = int(last.id[4:]) + 1
            except (ValueError, IndexError):
                seq = 1043
        else:
            seq = 1043
        return format_report_id(seq)

    elif entity_type == "WO":
        last = db.query(WorkOrder).order_by(WorkOrder.id.desc()).first()
        if last and last.id.startswith("WO-"):
            try:
                seq = int(last.id[3:]) + 1
            except (ValueError, IndexError):
                seq = 334
        else:
            seq = 334
        return format_work_order_id(seq)

    elif entity_type == "SRV":
        last = db.query(ServiceRequest).order_by(ServiceRequest.id.desc()).first()
        if last and last.id.startswith("SRV-"):
            try:
                seq = int(last.id[4:]) + 1
            except (ValueError, IndexError):
                seq = 2009
        else:
            seq = 2009
        return format_service_request_id(seq)

    elif entity_type == "BP":
        last = db.query(BudgetPlan).order_by(BudgetPlan.id.desc()).first()
        if last and last.id.startswith("BP-"):
            try:
                seq = int(last.id[3:]) + 1
            except (ValueError, IndexError):
                seq = 1
        else:
            seq = 1
        return format_budget_plan_id(seq)

    else:
        raise ValueError(f"Unknown entity type: {entity_type}")
