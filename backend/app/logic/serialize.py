"""Serializers: DB rows -> contract JSON (camelCase, None omitted).

A ``Ctx`` bulk-loads everything the serializers need (categories, departments, timelines,
reports, triage, caller's follows) so list endpoints do not query per row.
"""

from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.helpers import iso_z, now_utc
from app.logic.overdue import aware, due_at, is_overdue
from app.models import (
    ActivityLog,
    AISuggestion,
    BudgetPlan,
    Category,
    Department,
    Incident,
    IncidentFollower,
    Report,
    ServiceRequest,
    WorkOrder,
)

SERVICE_TYPE_LABEL = {"bulky_waste": "رفع مخلفات كبيرة", "tree_maintenance": "صيانة أشجار"}
# Service requests are handled by these departments (Department.id).
SERVICE_TYPE_DEPARTMENT = {"bulky_waste": "sanitation", "tree_maintenance": "parks"}


def _val(x):
    return getattr(x, "value", x)


def clean(d: dict) -> dict:
    """Drop None values (contract: optional keys are absent, never null)."""
    return {k: v for k, v in d.items() if v is not None}


def timeline_entry(a: ActivityLog) -> dict:
    return {"status": _val(a.status), "note": a.note or "", "actor": a.actor, "at": iso_z(a.at)}


class Ctx:
    """Preloaded lookups for one request."""

    def __init__(self, db: Session):
        self.db = db
        self.categories: dict[str, Category] = {c.id: c for c in db.query(Category).all()}
        self.departments: dict[str, Department] = {d.id: d for d in db.query(Department).all()}
        self.timelines: dict[str, list[dict]] = defaultdict(list)
        self.reports: dict[str, list[Report]] = defaultdict(list)
        self.triage: dict[str, dict] = {}
        self.plan_selected: set[str] = set()
        self.following: set[str] = set()
        self.user_id: str | None = None

    def load_incidents(self, incidents: Iterable[Incident], user_id: str | None = None) -> "Ctx":
        ids = [i.id for i in incidents]
        db = self.db
        self.user_id = user_id
        small = len(ids) < 400

        q = db.query(ActivityLog).filter(ActivityLog.entity_type == "incident")
        if small:
            q = q.filter(ActivityLog.entity_id.in_(ids))
        for a in q.order_by(ActivityLog.at.asc(), ActivityLog.id.asc()).all():
            self.timelines[a.entity_id].append(timeline_entry(a))

        q = db.query(Report)
        if small:
            q = q.filter(Report.incident_id.in_(ids))
        for r in q.order_by(Report.created_at.asc(), Report.id.asc()).all():
            self.reports[r.incident_id].append(r)

        report_ids = [r.id for rs in self.reports.values() for r in rs]
        if report_ids:
            q = db.query(AISuggestion).filter(AISuggestion.kind == "triage")
            if small:
                q = q.filter(AISuggestion.report_id.in_(report_ids))
            for s in q.order_by(AISuggestion.created_at.asc()).all():
                self.triage.setdefault(s.report_id, s.payload or {})

        plan = db.query(BudgetPlan).order_by(BudgetPlan.created_at.desc(), BudgetPlan.id.desc()).first()
        self.plan_selected = set(plan.selected or []) if plan else set()

        if user_id:
            self.following = {
                f.incident_id for f in db.query(IncidentFollower).filter(IncidentFollower.user_id == user_id)
            } | {r.incident_id for r in db.query(Report).filter(Report.reporter_id == user_id)}
        return self

    def dept_name(self, department_id: str | None) -> str:
        d = self.departments.get(department_id) if department_id else None
        return d.name_ar if d else (department_id or "")

    def triage_for(self, incident_id: str) -> dict | None:
        for r in self.reports.get(incident_id, []):
            if r.id in self.triage:
                return self.triage[r.id]
        return None


def load_ctx(db: Session, incidents: Iterable[Incident], user_id: str | None = None) -> Ctx:
    return Ctx(db).load_incidents(list(incidents), user_id)


# ------------------------------------------------------------------------------------
# Incident
# ------------------------------------------------------------------------------------
def incident_public(ctx: Ctx, inc: Incident) -> dict:
    """Contract ``Incident`` (public fields only; isFollowing per caller)."""
    d = {
        "id": inc.id,
        "categoryId": inc.category_id,
        "title": inc.title,
        "severity": _val(inc.severity),
        "priority": {"score": inc.priority_score, "factors": inc.priority_factors or []},
        "status": _val(inc.status),
        "department": ctx.dept_name(inc.department_id),
        "estimatedCostEgp": inc.estimated_cost_egp,
        "linkedReportIds": [r.id for r in ctx.reports.get(inc.id, [])],
        "followers": inc.followers_count,
        "location": clean({"lat": inc.lat, "lng": inc.lng, "address": inc.address, "landmark": inc.landmark}),
        "sensitivePlace": inc.sensitive_place,
        "areaUnderserved": bool(inc.area_underserved),
        "workOrderId": inc.work_order_id,
        "eta": inc.eta,
        "timeline": ctx.timelines.get(inc.id, []),
        "createdAt": iso_z(inc.created_at),
        "updatedAt": iso_z(inc.updated_at),
    }
    if ctx.user_id:
        d["isFollowing"] = inc.id in ctx.following
    return clean(d)


def triage_view(ctx: Ctx, inc: Incident) -> dict | None:
    """Stored triage suggestion as ``TriageSuggestion & {source, confirmed}``."""
    p = ctx.triage_for(inc.id)
    if p is None:
        return None
    return {
        "options": p.get("options", []),
        "severity": p.get("severity", _val(inc.severity)),
        "summary": p.get("summary", ""),
        "duplicates": p.get("duplicates", []),
        "source": p.get("source", "fallback"),
        "confirmed": bool(p.get("confirmed", False)),
    }


def admin_incident(ctx: Ctx, inc: Incident) -> dict:
    """Contract ``AdminIncident`` = Incident + linkedReports, triage, dueAt, overdue, ..."""
    cat = ctx.categories.get(inc.category_id)
    dept = ctx.departments.get(inc.department_id)
    d = incident_public(ctx, inc)
    d.update(
        {
            "linkedReports": [
                {
                    "id": r.id,
                    "reporter": "بلاغ بدون اسم" if r.anonymous else "مواطن",
                    "description": r.description or "",
                    "source": r.source or "app",
                    "photoCount": len(r.photo_paths or []),
                    "createdAt": iso_z(r.created_at),
                }
                for r in ctx.reports.get(inc.id, [])
            ],
            "dueAt": iso_z(due_at(inc, cat)),
            "overdue": is_overdue(inc, cat),
            "external": bool(dept and dept.external_hotline),
            "inBudgetPlan": inc.id in ctx.plan_selected,
        }
    )
    d.update(
        clean(
            {
                "triage": triage_view(ctx, inc),
                "externalHotline": dept.external_hotline if dept else None,
                "lastReviewedBy": inc.last_reviewed_by,
                "lastReviewedAt": iso_z(inc.last_reviewed_at) if inc.last_reviewed_at else None,
            }
        )
    )
    return d


def incident_view(ctx: Ctx, inc: Incident, staff: bool) -> dict:
    """Citizen route output; staff tokens additionally get linkedReports / triage / admin fields."""
    return admin_incident(ctx, inc) if staff else incident_public(ctx, inc)


def map_pin(inc: Incident) -> dict:
    """Contract ``MapPin``."""
    return {
        "id": inc.id,
        "categoryId": inc.category_id,
        "title": inc.title,
        "status": _val(inc.status),
        "severity": _val(inc.severity),
        "lat": inc.lat,
        "lng": inc.lng,
    }


# ------------------------------------------------------------------------------------
# Report
# ------------------------------------------------------------------------------------
def report_view(r: Report) -> dict:
    """Contract ``Report``."""
    return clean(
        {
            "id": r.id,
            "reporterId": r.reporter_id,
            "incidentId": r.incident_id,
            "categoryId": r.category_id,
            "description": r.description or "",
            "photoUris": list(r.photo_paths or []),
            "location": clean({"lat": r.lat, "lng": r.lng, "address": r.address, "landmark": r.landmark}),
            "anonymous": bool(r.anonymous),
            "blurFaces": bool(r.blur_faces),
            "createdAt": iso_z(r.created_at),
            "voiceNoteUri": r.voice_note_path,
        }
    )


# ------------------------------------------------------------------------------------
# Service request
# ------------------------------------------------------------------------------------
def service_timelines(db: Session, ids: list[str] | None = None) -> dict[str, list[dict]]:
    q = db.query(ActivityLog).filter(ActivityLog.entity_type == "service_request")
    if ids is not None:
        q = q.filter(ActivityLog.entity_id.in_(ids))
    out: dict[str, list[dict]] = defaultdict(list)
    for a in q.order_by(ActivityLog.at.asc(), ActivityLog.id.asc()).all():
        out[a.entity_id].append(timeline_entry(a))
    return out


def service_request_view(sr: ServiceRequest, timeline: list[dict]) -> dict:
    """Contract ``ServiceRequest`` (admin-only ``assignee`` hidden from details)."""
    details = {k: v for k, v in (sr.details or {}).items() if k != "assignee"}
    return clean(
        {
            "id": sr.id,
            "citizenId": sr.citizen_id,
            "serviceType": sr.service_type,
            "details": details,
            "location": clean({"lat": sr.lat, "lng": sr.lng, "address": sr.address, "landmark": sr.landmark}),
            "status": _val(sr.status),
            "timeline": timeline,
            "createdAt": iso_z(sr.created_at),
        }
    )


def admin_service_request(ctx: Ctx, sr: ServiceRequest, timeline: list[dict], work_order_id: str | None) -> dict:
    """Contract ``AdminServiceRequest`` = ServiceRequest + department, paid, assignee, workOrderId."""
    d = service_request_view(sr, timeline)
    d.update(
        clean(
            {
                "department": ctx.dept_name(SERVICE_TYPE_DEPARTMENT.get(sr.service_type)),
                "paid": bool(sr.paid),
                "assignee": (sr.details or {}).get("assignee"),
                "workOrderId": work_order_id,
            }
        )
    )
    return d


# ------------------------------------------------------------------------------------
# Work order
# ------------------------------------------------------------------------------------
def work_order_view(
    ctx: Ctx,
    wo: WorkOrder,
    incidents: dict[str, Incident],
    srs: dict[str, ServiceRequest],
    updates: list[dict],
) -> dict:
    """Contract ``WorkOrder``."""
    dept = ctx.departments.get(wo.department_id)
    title = address = ""
    priority_score = followers = None
    inc = incidents.get(wo.incident_id) if wo.incident_id else None
    sr = srs.get(wo.service_request_id) if wo.service_request_id else None
    cat = None
    if inc:
        title, address = inc.title, inc.address
        priority_score, followers = inc.priority_score, inc.followers_count
        cat = ctx.categories.get(inc.category_id)
    elif sr:
        title = f"{SERVICE_TYPE_LABEL.get(sr.service_type, sr.service_type)} · {sr.address}"
        address = sr.address
    status = _val(wo.status)
    overdue = bool(status != "done" and wo.due_at and now_utc() > aware(wo.due_at))
    due = wo.due_at or (due_at(inc, cat) if inc else wo.created_at)
    return clean(
        {
            "id": wo.id,
            "incidentId": wo.incident_id,
            "serviceRequestId": wo.service_request_id,
            "title": title,
            "address": address,
            "department": dept.name_ar if dept else wo.department_id,
            "external": bool(dept and dept.external_hotline),
            "externalHotline": dept.external_hotline if dept else None,
            "team": wo.team,
            "teamSize": wo.team_size,
            "supervisor": wo.supervisor,
            "status": status,
            "dueAt": iso_z(due),
            "overdue": overdue,
            "estimatedCostEgp": wo.estimated_cost_egp or 0,
            "priorityScore": priority_score,
            "followers": followers,
            "tasks": wo.tasks or [],
            "updates": updates,
            "createdAt": iso_z(wo.created_at),
            "updatedAt": iso_z(wo.updated_at),
            "resolvedAt": iso_z(wo.resolved_at) if wo.resolved_at else None,
        }
    )


def work_orders_view(db: Session, ctx: Ctx, orders: list[WorkOrder]) -> list[dict]:
    """Serialize several work orders with bulk-loaded incidents, requests and updates."""
    inc_ids = [w.incident_id for w in orders if w.incident_id]
    sr_ids = [w.service_request_id for w in orders if w.service_request_id]
    incidents = {i.id: i for i in db.query(Incident).filter(Incident.id.in_(inc_ids))} if inc_ids else {}
    srs = {s.id: s for s in db.query(ServiceRequest).filter(ServiceRequest.id.in_(sr_ids))} if sr_ids else {}
    updates: dict[str, list[dict]] = defaultdict(list)
    if orders:
        q = db.query(ActivityLog).filter(
            ActivityLog.entity_type == "work_order", ActivityLog.entity_id.in_([w.id for w in orders])
        )
        for a in q.order_by(ActivityLog.at.asc(), ActivityLog.id.asc()).all():
            updates[a.entity_id].append(timeline_entry(a))
    return [work_order_view(ctx, w, incidents, srs, updates.get(w.id, [])) for w in orders]
