from app.ai.integrations import _find_nearby
from app.ai.schemas import CategoryId
from app.models import (
    Incident,
    IncidentFollower,
    IncidentStatusEnum,
    Profile,
    Report,
)


def test_nearby_matching_separates_own_reports_and_excludes_followed(db):
    user_id = "ai-citizen"
    db.add(Profile(id=user_id, role="citizen"))
    incidents = [
        Incident(
            id=incident_id,
            category_id="pothole",
            title=incident_id,
            status=IncidentStatusEnum.RECEIVED,
            lat=30.05,
            lng=31.3 + offset,
            address="Nasr City",
        )
        for incident_id, offset in (
            ("own", 0.0002),
            ("followed", 0.0003),
            ("join", 0.0004),
        )
    ]
    db.add_all(incidents)
    db.flush()
    db.add_all(
        [
            Report(
                id="FTC-AI-1",
                reporter_id=user_id,
                incident_id="own",
                category_id="pothole",
                description="حفرة",
                photo_paths=[],
                lat=30.05,
                lng=31.3,
                address="Nasr City",
                anonymous=False,
                blur_faces=True,
            ),
            IncidentFollower(incident_id="followed", user_id=user_id),
        ]
    )
    db.flush()

    result = _find_nearby(db, CategoryId.pothole, 30.05, 31.3, 250, user_id)

    assert [match["incidentId"] for match in result["duplicates"]] == ["join"]
    assert [match["incidentId"] for match in result["alreadyReported"]] == ["own"]
    assert result["alreadyReported"][0]["reportId"] == "FTC-AI-1"
