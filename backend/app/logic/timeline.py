"""Timeline entry generation - ported from mobile app."""
from datetime import datetime
from app.helpers import iso_z


SEVERITY_LABEL_AR = {
    "low": "خطورة بسيطة",
    "medium": "خطورة متوسطة",
    "high": "خطورة عالية",
    "critical": "خطر",
}


def incident_timeline_entry(
    status: str, category_label: str, severity: str, department: str, at: datetime
) -> dict:
    """
    Generate a timeline entry for an incident status change.
    Returns a dict: {status, note, actor, at}
    """
    at_iso = iso_z(at) if isinstance(at, datetime) else at
    if status == "received":
        return {"status": status, "at": at_iso, "actor": "النظام", "note": "وصلنا بلاغك"}
    elif status == "triaged":
        return {
            "status": status,
            "at": at_iso,
            "actor": "الذكاء الاصطناعي + موظف الحي",
            "note": f"اتصنّف: {category_label} · {SEVERITY_LABEL_AR[severity]}",
        }
    elif status == "assigned":
        return {
            "status": status,
            "at": at_iso,
            "actor": department,
            "note": f"اتحوّل لـ{department}",
        }
    elif status == "in_progress":
        return {
            "status": status,
            "at": at_iso,
            "actor": department,
            "note": "الفريق في الموقع",
        }
    elif status == "resolved":
        return {
            "status": status,
            "at": at_iso,
            "actor": department,
            "note": "اتصلّحت. شكرًا إنك بلّغت",
        }
    else:  # closed
        return {"status": status, "at": at_iso, "actor": "النظام", "note": "اتقفل البلاغ"}


def service_timeline_entry(status: str, at: datetime) -> dict:
    """
    Generate a timeline entry for a service request status change.
    Returns a dict: {status, note, actor, at}
    """
    at_iso = iso_z(at) if isinstance(at, datetime) else at
    notes = {
        "received": "وصلنا طلبك",
        "triaged": "اتراجع الطلب",
        "assigned": "اتحدد فريق وميعاد التنفيذ",
        "in_progress": "العربية في الطريق",
        "resolved": "اتنفّذ الطلب",
    }
    note = notes.get(status, "اتقفل الطلب")
    return {"status": status, "at": at_iso, "actor": "خدمات الحي", "note": note}
