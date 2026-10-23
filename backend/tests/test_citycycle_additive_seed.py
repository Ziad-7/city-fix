import os
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.logic.recycling import DEFAULT_DISTRICT
from app.models import Base, MaterialPriceRow, Profile, RecyclingPickup, SmartBin
from scripts.seed_citycycle_additive import seed_citycycle_additive


@pytest.fixture
def isolated_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_existing_id_and_price_collisions_are_byte_for_byte_preserved(isolated_db):
    db = isolated_db
    profile = Profile(id="demo-citycycle-household-1", role="admin", name="Keep me", district="Elsewhere")
    price = MaterialPriceRow(district=DEFAULT_DISTRICT, material_id="pet_plastic", price_egp_per_kg=999.0)
    bin_row = SmartBin(
        id="BIN-DEMO-CITYCYCLE-011",
        name="Keep bin",
        district="Elsewhere",
        lat=1,
        lng=2,
        device_key_hash="existing-hash",
        is_active=False,
        is_simulated=False,
    )
    unrelated = Profile(id="unrelated-profile", role="citizen", name="Unrelated")
    db.add_all([profile, price, bin_row, unrelated])
    db.commit()

    plan = seed_citycycle_additive(db)

    assert "demo-citycycle-household-1" not in plan["addedIds"]
    assert db.get(Profile, profile.id).name == "Keep me"
    assert db.get(Profile, profile.id).role == "admin"
    assert db.get(MaterialPriceRow, (DEFAULT_DISTRICT, "pet_plastic")).price_egp_per_kg == 999.0
    assert db.get(SmartBin, bin_row.id).device_key_hash == "existing-hash"
    assert db.get(SmartBin, bin_row.id).is_simulated is False
    assert db.get(Profile, unrelated.id).name == "Unrelated"


def test_apply_is_additive_and_second_apply_has_no_additions(isolated_db):
    db = isolated_db
    first = seed_citycycle_additive(db, apply=True)
    second = seed_citycycle_additive(db, apply=True)

    assert first["counts"]["recycling_pickups"] == 4
    assert first["counts"]["collectors"] == 1
    assert first["simulatedBinIds"]
    assert all(db.get(SmartBin, bin_id).is_simulated for bin_id in first["simulatedBinIds"])
    assert second["counts"] == {}
    assert second["addedIds"] == []
    assert db.get(Profile, "demo-citycycle-collector").phone is None


def test_apply_exception_rolls_back_entire_seed(isolated_db, monkeypatch):
    db = isolated_db
    original_flush = db.flush

    def fail_flush(*args, **kwargs):
        raise RuntimeError("injected failure")

    monkeypatch.setattr(db, "flush", fail_flush)
    with pytest.raises(RuntimeError, match="injected failure"):
        seed_citycycle_additive(db, apply=True)
    monkeypatch.setattr(db, "flush", original_flush)

    assert db.query(Profile).count() == 0
    assert db.query(RecyclingPickup).count() == 0
    assert db.query(SmartBin).count() == 0


def test_postgres_additive_seed_respects_foreign_keys_and_is_idempotent(monkeypatch):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy import create_engine
    from sqlalchemy.engine import make_url
    from sqlalchemy.orm import Session

    from alembic import command
    from scripts.migrate import _alembic_config

    base = make_url(source_url)
    database_name = f"member4_seed_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    try:
        command.upgrade(_alembic_config(test_url.render_as_string(hide_password=False)), "head")
        with Session(engine) as db:
            first = seed_citycycle_additive(db, apply=True)
            second = seed_citycycle_additive(db, apply=True)
            assert first["counts"]["bin_readings"] > 0
            assert second["addedIds"] == []
            assert db.query(SmartBin).filter(SmartBin.is_simulated.is_(True)).count() == len(first["simulatedBinIds"])
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))
