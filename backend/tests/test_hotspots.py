from datetime import datetime, timedelta, timezone

from app.logic.hotspots import cluster_incidents, cluster_points
from app.models import Incident


def test_dbscan_groups_dense_garbage_points_and_omits_noise():
    points = [{"id": str(i), "lat": 30.0, "lng": 31.0 + i * 0.0001} for i in range(3)]
    points.append({"id": "noise", "lat": 31.0, "lng": 32.0})
    clusters = cluster_points(points, 500, 3)
    assert [[p["id"] for p in cluster] for cluster in clusters] == [["0", "1", "2"]]


def test_hotspots_exclude_unassigned_and_future_incidents_from_staff_aggregates(db):
    now = datetime.now(timezone.utc)
    for index in range(3):
        db.add(
            Incident(
                id=f"HSOWN{index}",
                category_id="garbage",
                title="private",
                lat=30,
                lng=31 + index * 0.0001,
                address="secret",
                department_id="roads",
                created_at=now.replace(tzinfo=None),
            )
        )
    db.add(
        Incident(
            id="HSUNASSIGNED",
            category_id="garbage",
            title="private",
            lat=30,
            lng=31.0002,
            address="secret",
            department_id=None,
            created_at=now.replace(tzinfo=None),
        )
    )
    db.add(
        Incident(
            id="HSFUTURE",
            category_id="garbage",
            title="private",
            lat=30,
            lng=31.0003,
            address="secret",
            department_id="roads",
            created_at=(now + timedelta(days=1)).replace(tzinfo=None),
        )
    )
    db.add(
        Incident(
            id="HSOTHER",
            category_id="garbage",
            title="private",
            lat=30,
            lng=31.0003,
            address="secret",
            department_id="water",
            created_at=now.replace(tzinfo=None),
        )
    )
    db.add(
        Incident(
            id="HSOLD",
            category_id="garbage",
            title="private",
            lat=30,
            lng=31.0003,
            address="secret",
            department_id="roads",
            created_at=(now - timedelta(days=31)).replace(tzinfo=None),
        )
    )
    db.add(
        Incident(
            id="HSINVALID",
            category_id="garbage",
            title="private",
            lat=95,
            lng=31.0003,
            address="secret",
            department_id="roads",
            created_at=now.replace(tzinfo=None),
        )
    )
    db.add(
        Incident(
            id="HSROAD",
            category_id="pothole",
            title="road",
            lat=30,
            lng=31.0003,
            address="secret",
            department_id="roads",
            created_at=now.replace(tzinfo=None),
        )
    )
    db.flush()
    result = cluster_incidents(
        db, {"role": "staff", "department": "roads"}, days=30, radius_meters=500, min_count=3, now=now
    )
    assert len(result["items"]) == 1
    assert result["items"][0]["count"] == 3
    assert result["items"][0]["id"].startswith("HS-") and len(result["items"][0]["id"]) == 67
    assert "HSOWN0" not in str(result)
    assert "secret" not in str(result)


def test_border_point_belongs_to_first_cluster_and_smaller_remainder_is_omitted():
    points_m = [-100, -150, -160, -170, 0, 100, 150, 160]
    points = [{"id": f"P{index}", "lat": 0.0, "lng": meters / 111_195} for index, meters in enumerate(points_m)]
    clusters = cluster_points(points, 101, 4)
    assert [[point["id"] for point in cluster] for cluster in clusters] == [["P0", "P1", "P2", "P3", "P4"]]
