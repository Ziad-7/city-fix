from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker

from app.logic.ids import next_id
from app.logic.recycling import pickup_view
from app.models import ActivityLog, Base, Collector, RecyclingPickup
from app.recycling_schemas import PickupAdminPatchInput
from app.routers.recycling_admin import admin_patch_pickup
from app.seed import seed_db


@pytest.fixture
def sessions(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'review.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False)
    with factory() as db:
        seed_db(db)
    yield factory
    engine.dispose()


def test_dispatch_preserves_concurrent_cancellation(sessions):
    with sessions() as db:
        original_get = db.get

        def get(model, ident, **kwargs):
            if model is Collector:
                with sessions() as rival:
                    rival.execute(
                        update(RecyclingPickup).where(RecyclingPickup.id == "RCY-3002").values(status="cancelled")
                    )
                    rival.commit()
            return original_get(model, ident, **kwargs)

        db.get = get
        with pytest.raises(HTTPException) as error:
            admin_patch_pickup(
                "RCY-3002",
                PickupAdminPatchInput(status="accepted", collectorId="COL-1"),
                {"sub": "admin", "role": "admin"},
                db,
            )
        assert error.value.status_code == 409
        db.rollback()
    with sessions() as db:
        assert db.get(RecyclingPickup, "RCY-3002").status == "cancelled"
        assert not db.query(ActivityLog).filter_by(entity_id="RCY-3002", status="accepted").count()


@pytest.mark.parametrize("prefix", ["COL", "RCY", "WGH"])
def test_reservations_are_durable_and_transactional(sessions, prefix):
    with sessions() as db:
        first = next_id(db, prefix)
        second = next_id(db, prefix)
        assert first != second
        db.commit()
    with sessions() as db:
        third = next_id(db, prefix)
        assert int(third.split("-")[1]) == int(second.split("-")[1]) + 1
        db.rollback()
    with sessions() as db:
        assert next_id(db, prefix) == third


def test_parallel_distinct_collector_creates(sessions):
    def create(number):
        with sessions() as db:
            ident = next_id(db, "COL")
            db.add(
                Collector(
                    id=ident, profile_id=f"new-{number}", name="New", district="test", status="pending", materials=[]
                )
            )
            db.commit()
            return ident

    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = list(pool.map(create, range(8)))
    assert len(set(ids)) == 8


class Storage:
    def sign_read(self, owner, path):
        if not path.startswith(owner + "/"):
            raise HTTPException(403, "legacy or foreign path")
        return "https://signed/" + path


@pytest.mark.parametrize("viewer", ["admin", "citizen"])
def test_pickup_photos_signed_for_owner_and_legacy_skipped(db, viewer):
    p = db.get(RecyclingPickup, "RCY-3002")
    p.photo_paths = [p.citizen_id + "/photo.jpg", "legacy.jpg"]
    assert pickup_view(db, p, viewer=viewer, storage=Storage())["photoUris"] == [
        "https://signed/" + p.citizen_id + "/photo.jpg"
    ]
    assert pickup_view(db, p, viewer="collector", storage=Storage())["photoUris"] == []


def test_admin_routes_sign_photos_and_staff_never_signs(client, db, admin_h, roads_h, citizen_h):
    from app.main import app

    p = db.get(RecyclingPickup, "RCY-3002")
    p.photo_paths = [p.citizen_id + "/photo.jpg", "legacy.jpg"]
    db.commit()
    app.state.media_storage = Storage()
    expected = ["https://signed/" + p.citizen_id + "/photo.jpg"]
    detail = client.get("/admin/recycling/pickups/RCY-3002", headers=admin_h)
    assert detail.status_code == 200
    assert detail.json()["photoUris"] == expected
    rows = client.get("/admin/recycling/pickups", headers=admin_h).json()
    assert next(row for row in rows if row["id"] == p.id)["photoUris"] == expected
    patched = client.patch("/admin/recycling/pickups/RCY-3002", headers=admin_h, json={"note": "checked"})
    assert patched.status_code == 200
    assert patched.json()["photoUris"] == expected
    staff = client.get("/admin/recycling/pickups/RCY-3002", headers=roads_h).json()
    assert staff["photoUris"] == []
    assert staff["location"] == {"address": p.district}
    assert client.patch("/admin/recycling/pickups/RCY-3002", headers=roads_h, json={"note": "no"}).status_code == 403
    assert client.get("/admin/recycling/pickups/RCY-3002", headers=citizen_h).status_code == 403


def test_counter_seed_respects_preexisting_numeric_maximum(sessions):
    with sessions() as db:
        db.add(Collector(id="COL-900", profile_id="old", name="Old", district="test", status="pending", materials=[]))
        db.commit()
        assert next_id(db, "COL") == "COL-901"
        db.commit()
    with sessions() as db:
        assert next_id(db, "COL") == "COL-902"
