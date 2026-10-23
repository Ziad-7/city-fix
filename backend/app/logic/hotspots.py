"""Privacy-preserving, department-scoped DBSCAN-style garbage hotspots."""

import math
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.logic.domain import staff_department
from app.logic.duplicates import haversine_m
from app.models import Incident


def cluster_points(points: list[dict], radius_meters: int, min_count: int) -> list[list[dict]]:
    ordered = sorted(points, key=lambda p: p["id"])
    neighbors = {
        p["id"]: [q for q in ordered if haversine_m(p["lat"], p["lng"], q["lat"], q["lng"]) <= radius_meters]
        for p in ordered
    }
    assigned: set[str] = set()
    clusters: list[list[dict]] = []
    for point in ordered:
        if point["id"] in assigned or len(neighbors[point["id"]]) < min_count:
            continue
        cluster, queue = {}, list(neighbors[point["id"]])
        while queue:
            candidate = queue.pop(0)
            if candidate["id"] in cluster or candidate["id"] in assigned:
                continue
            cluster[candidate["id"]] = candidate
            assigned.add(candidate["id"])
            if len(neighbors[candidate["id"]]) >= min_count:
                queue.extend(n for n in neighbors[candidate["id"]] if n["id"] not in cluster)
        if len(cluster) >= min_count:
            clusters.append(list(cluster.values()))
    return clusters


def cluster_incidents(
    db: Session, claims: dict, *, days: int, radius_meters: int, min_count: int, now: datetime
) -> dict:
    for value, low, high in ((days, 1, 90), (radius_meters, 100, 2000), (min_count, 3, 20)):
        if not low <= value <= high:
            raise HTTPException(422, "invalid analytics parameter")
    query = db.query(Incident).filter(  # type: ignore[arg-type]
        Incident.category_id == "garbage",
        Incident.created_at >= (now - timedelta(days=days)).replace(tzinfo=None),  # type: ignore[arg-type]
        Incident.created_at <= now.replace(tzinfo=None),  # type: ignore[arg-type]
        Incident.lat.between(-90, 90),
        Incident.lng.between(-180, 180),
    )
    department = staff_department(claims)
    if claims.get("role") == "staff":
        query = query.filter(Incident.department_id == department)
    rows = query.order_by(Incident.id).all()
    points = [
        {"id": r.id, "lat": r.lat, "lng": r.lng, "priority": r.priority_score or 0, "categoryId": r.category_id}
        for r in rows
        if math.isfinite(r.lat) and math.isfinite(r.lng)
    ]
    items = []
    for cluster in cluster_points(points, radius_meters, min_count):
        ids = sorted(p["id"] for p in cluster)
        items.append(
            {
                "id": "HS-" + sha256("\n".join(ids).encode()).hexdigest(),
                "lat": round(sum(p["lat"] for p in cluster) / len(cluster), 3),
                "lng": round(sum(p["lng"] for p in cluster) / len(cluster), 3),
                "count": len(cluster),
                "categoryCounts": [{"categoryId": "garbage", "count": len(cluster)}],
                "maxPriorityScore": max(p["priority"] for p in cluster),
            }
        )
    return {
        "generatedAt": now.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        "days": days,
        "radiusMeters": radius_meters,
        "minCount": min_count,
        "items": sorted(items, key=lambda item: item["id"]),
    }
