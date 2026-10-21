"""Readable ID generation."""


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
