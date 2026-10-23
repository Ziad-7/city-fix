"""Large synthetic demo dataset: determinism, safety (additive/idempotent/exact cleanup) and business rules."""

import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app import seed_large
from app.config import settings
from app.helpers import now_utc
from app.logic.bin_forecast import forecast_bins
from app.logic.dashboard import build_dashboard
from app.logic.duplicates import find_duplicates
from app.logic.hotspots import cluster_incidents
from app.logic.ids import next_id
from app.logic.overdue import is_overdue
from app.logic.priority import compute_priority
from app.logic.status import INCIDENT_STATUSES, OPEN_STATUSES
from app.models import (
    ActivityLog,
    AISuggestion,
    Base,
    BinReading,
    BinReport,
    Category,
    Collector,
    Incident,
    IncidentFollower,
    MaterialPriceRow,
    Notification,
    Profile,
    PushDelivery,
    RecyclingPickup,
    Report,
    ServiceRequest,
    SmartBin,
    Weighing,
    WorkOrder,
)
from app.routers.bins import _bin_status
from app.routers.reports import _next_suggestion_id
from app.seed import seed_db
from app.seed_large import (
    SELECTORS,
    LargeOptions,
    apply,
    build_dataset,
    cleanup,
    load_reference,
    plan,
    seed_large_local,
)
from scripts import seed_large_demo
from scripts.seed_citycycle_additive import seed_citycycle_additive
from tests.conftest import staff_headers

BACKEND = Path(__file__).resolve().parents[1]
NOW = datetime(2026, 10, 23, 12, 0, tzinfo=UTC)
SMALL = LargeOptions(scale=0.15)


def _engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return engine


def _seed(db: Session) -> None:
    """Base fixture first (its own flush order relies on lax FKs), then enforce foreign keys for the large set."""
    seed_db(db)
    db.connection().exec_driver_sql("PRAGMA foreign_keys=ON")
    db.commit()


@pytest.fixture
def isolated_db():
    engine = _engine()
    with Session(engine) as db:
        _seed(db)
        yield db
    engine.dispose()


@pytest.fixture(scope="module")
def big():
    """Scale 1.0 with the local options, generated around the real clock, shared by the read-only rule tests."""
    engine = _engine()
    with Session(engine) as db:
        _seed(db)
        opts = LargeOptions(
            link_demo_citizen="citizen-001",
            link_demo_collector="COL-1",
            open_pickups=True,
            local_prices=True,
            notifications=True,
        )
        started = time.monotonic()
        report = apply(db, opts, now=now_utc())
        report["wall"] = time.monotonic() - started
        db.report = report
        yield db
    engine.dispose()


def _canon(units) -> str:
    rows = []
    for unit in units:
        for row in unit.rows:
            cols = {c.key: str(getattr(row, c.key)) for c in row.__table__.columns if c.key != "device_key_hash"}
            rows.append([row.__tablename__, cols])
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _snapshot(db: Session) -> dict:
    out = {}
    for table in Base.metadata.sorted_tables:
        rows = db.execute(table.select()).all()
        out[table.name] = sorted(repr(tuple(r)) for r in rows)
    return out


def _counts(db: Session, tables) -> dict:
    return {t: db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar_one() for t in tables}


# ----------------------------------------------------------------------------- determinism
def test_build_is_deterministic_and_seed_sensitive(isolated_db):
    ref = load_reference(isolated_db, SMALL)
    first = _canon(build_dataset(NOW, ref, SMALL))
    assert first == _canon(build_dataset(NOW, ref, SMALL))
    assert first != _canon(build_dataset(NOW, ref, LargeOptions(scale=0.15, seed=1)))


def test_build_does_not_depend_on_hash_randomisation():
    code = (
        "from datetime import UTC, datetime\n"
        "from sqlalchemy import create_engine\n"
        "from sqlalchemy.orm import Session\n"
        "from app.models import Base\n"
        "from app.seed import seed_db\n"
        "from app.seed_large import LargeOptions, build_dataset, load_reference\n"
        "from tests.test_seed_large import _canon\n"
        "e = create_engine('sqlite:///:memory:'); Base.metadata.create_all(e)\n"
        "db = Session(e); seed_db(db)\n"
        "o = LargeOptions(scale=0.15)\n"
        "print(_canon(build_dataset(datetime(2026, 10, 23, 12, tzinfo=UTC), load_reference(db, o), o)))\n"
    )
    outputs = []
    for hash_seed in ("1", "2"):
        env = {**os.environ, "PYTHONHASHSEED": hash_seed, "JWT_SECRET": "ci-dummy-secret-not-for-production"}
        done = subprocess.run(
            [sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True, check=True
        )
        outputs.append(done.stdout.strip().splitlines()[-1])
    assert outputs[0] == outputs[1]


# ----------------------------------------------------------------------------- apply / plan
def test_dry_run_writes_nothing(isolated_db):
    before = _snapshot(isolated_db)
    report = plan(isolated_db, SMALL, now=NOW)
    assert report["mode"] == "dry-run" and report["unitsToAdd"] > 0
    assert all(n > 0 for n in report["counts"].values())
    assert _snapshot(isolated_db) == before


def test_apply_matches_plan_and_is_idempotent(isolated_db):
    first = apply(isolated_db, SMALL, now=NOW)
    planned = plan(isolated_db, SMALL, now=NOW)
    assert planned["unitsToAdd"] == 0 and planned["counts"] == {}
    assert first["counts"]["incidents"] == round(700 * 0.15)
    after_first = _snapshot(isolated_db)
    second = apply(isolated_db, SMALL, now=NOW)
    assert second["unitsToAdd"] == 0 and second["counts"] == {}
    assert _snapshot(isolated_db) == after_first


def test_apply_resumes_after_a_failed_chunk(isolated_db, monkeypatch):
    clean_engine = _engine()
    with Session(clean_engine) as clean:
        _seed(clean)
        apply(clean, SMALL, now=NOW, chunk_units=20)
        expected = _counts(clean, [t.name for t in Base.metadata.sorted_tables])
    real_commit = Session.commit
    calls = {"n": 0}

    def flaky(self):
        calls["n"] += 1
        if calls["n"] == 3:
            raise RuntimeError("boom")
        return real_commit(self)

    monkeypatch.setattr(Session, "commit", flaky)
    with pytest.raises(RuntimeError):
        apply(isolated_db, SMALL, now=NOW, chunk_units=20)
    monkeypatch.setattr(Session, "commit", real_commit)
    resumed = apply(isolated_db, SMALL, now=NOW, chunk_units=20)
    assert resumed["unitsPresent"] > 0 and resumed["unitsToAdd"] > 0
    assert _counts(isolated_db, expected) == expected


def test_real_database_options_create_no_open_pickups_logins_or_notifications(isolated_db):
    before_prices = isolated_db.query(MaterialPriceRow).count()
    apply(isolated_db, SMALL, now=NOW)
    pickups = isolated_db.query(RecyclingPickup).filter(RecyclingPickup.id.like("RCY-DEMOL-%")).all()
    assert pickups and not [p for p in pickups if p.status == "requested"]
    assert all(p.phone is None for p in isolated_db.query(Profile).filter(Profile.id.like("demol-%")).all())
    assert isolated_db.query(Notification).count() == 0
    assert isolated_db.query(MaterialPriceRow).count() == before_prices
    assert isolated_db.query(PushDelivery).count() == 0


def test_id_sequences_do_not_move(isolated_db):
    prefixes = ["INC", "FTC", "WO", "SRV", "RCY", "COL", "WGH"]
    # readable counters reserve ids transactionally, so compare the ids a fresh transaction would hand out
    before = {p: next_id(isolated_db, p) for p in prefixes}, _next_suggestion_id(isolated_db)
    isolated_db.rollback()
    apply(isolated_db, SMALL, now=NOW)
    isolated_db.rollback()
    after = {p: next_id(isolated_db, p) for p in prefixes}, _next_suggestion_id(isolated_db)
    isolated_db.rollback()
    assert after == before


def test_referential_integrity(isolated_db):
    apply(isolated_db, SMALL, now=NOW)
    assert isolated_db.execute(text("PRAGMA foreign_key_check")).all() == []
    for inc in isolated_db.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).all():
        if inc.work_order_id:
            assert isolated_db.get(WorkOrder, inc.work_order_id).incident_id == inc.id
    for act in isolated_db.query(ActivityLog).all():
        if "DEMOL" not in act.entity_id:
            continue
        model = {"incident": Incident, "service_request": ServiceRequest, "work_order": WorkOrder,
                 "recycling_pickup": RecyclingPickup}[act.entity_type]  # fmt: skip
        assert isolated_db.get(model, act.entity_id) is not None


# ----------------------------------------------------------------------------- cleanup
def _real_graph(db: Session) -> None:
    db.add(Profile(id="real-1", role="citizen", name="Real person", phone="+201000000001"))
    db.flush()
    db.add(Incident(id="INC-900", category_id="pothole", title="real", lat=30.0, lng=31.0, address="real street"))
    db.flush()
    db.add(
        Report(
            id="FTC-2000", reporter_id="real-1", incident_id="INC-900", category_id="pothole", lat=30.0, lng=31.0,
            address="real street",
        )
    )  # fmt: skip
    db.add(
        RecyclingPickup(
            id="RCY-5000", citizen_id="real-1", items=[], lat=30.0, lng=31.0, address="real", district="d", day="2026-10-24",
            slot="morning", mode="free",
        )
    )  # fmt: skip
    db.commit()


def test_cleanup_restores_the_exact_previous_state(isolated_db):
    seed_citycycle_additive(isolated_db, apply=True)
    _real_graph(isolated_db)
    before = _snapshot(isolated_db)
    apply(isolated_db, SMALL, now=NOW)
    assert _snapshot(isolated_db) != before
    dry = cleanup(isolated_db)
    assert dry["mode"] == "cleanup-dry-run" and not dry["blockers"] and dry["counts"]["incidents"] > 0
    done = cleanup(isolated_db, apply=True)
    assert done["deleted"]["incidents"] == dry["counts"]["incidents"]
    assert _snapshot(isolated_db) == before
    for table, patterns in SELECTORS.items():
        for pattern in patterns:
            n = isolated_db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE id LIKE :p"), {"p": pattern}).scalar_one()
            assert n == 0
    assert cleanup(isolated_db, apply=True)["deleted"]["incidents"] == 0  # idempotent


def test_cleanup_refuses_when_a_real_row_depends_on_demo_data(isolated_db):
    apply(isolated_db, SMALL, now=NOW)
    isolated_db.add(Report(id="FTC-2001", reporter_id="citizen-001", incident_id="INC-DEMOL-0001", category_id="pothole",
                           lat=30.0, lng=31.0, address="real"))  # fmt: skip
    isolated_db.commit()
    before = _snapshot(isolated_db)
    result = cleanup(isolated_db, apply=True)
    assert result["refused"] is True and result["blockers"]["reports"]["count"] == 1
    assert _snapshot(isolated_db) == before


# ----------------------------------------------------------------------------- business rules (scale 1.0, local)
def test_counts_at_full_scale(big):
    c = big.report["counts"]
    assert c["incidents"] == 700 and c["recycling_pickups"] == 300 and c["smart_bins"] == 60
    assert c["service_requests"] == 120 and c["collectors"] == 25 and c["profiles"] == 326
    for table in ("reports", "incident_followers", "activity_log", "ai_suggestions", "work_orders", "recycling_weighings",
                  "bin_readings", "bin_reports", "notifications", "material_prices"):  # fmt: skip
        assert c[table] > 0, table
    assert big.report["wall"] < 30


def test_priority_matches_the_formula_and_followers_are_consistent(big):
    cats = {c.id: c for c in big.query(Category).all()}
    now = now_utc()
    for inc in big.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).all():
        reporters = big.query(Report).filter(Report.incident_id == inc.id).count()
        created = inc.created_at.replace(tzinfo=UTC)
        expected = compute_priority(
            {
                "severity": inc.severity.value,
                "near_sensitive_place": bool(inc.sensitive_place),
                "reporters": reporters,
                "days_open": max(0, (now - created).days),
                "target_days": cats[inc.category_id].target_days,
                "area_underserved": bool(inc.area_underserved),
            }
        )
        # ``days_open`` crosses a day boundary at most once between generation and this check
        assert abs(inc.priority_score - expected["score"]) <= 15
        followers = big.query(IncidentFollower).filter(IncidentFollower.incident_id == inc.id).count()
        assert inc.followers_count == followers >= 1


def test_incident_timelines_are_ordered_and_end_at_the_current_status(big):
    now = now_utc().replace(tzinfo=None)
    by_incident: dict[str, list[ActivityLog]] = {}
    for a in big.query(ActivityLog).filter(
        ActivityLog.entity_type == "incident", ActivityLog.entity_id.like("INC-DEMOL-%")
    ):
        by_incident.setdefault(a.entity_id, []).append(a)
    for inc in big.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).all():
        rows = sorted(by_incident[inc.id], key=lambda a: a.id)
        statuses = [r.status for r in rows]
        assert statuses == list(INCIDENT_STATUSES[: len(statuses)])
        assert statuses[-1] == inc.status.value
        stamps = [r.at for r in rows]
        assert stamps == sorted(stamps) and len(set(stamps)) == len(stamps) and stamps[-1] <= now


def test_work_orders_match_incident_status(big):
    expected = {
        "assigned": {"open", "assigned"},
        "in_progress": {"in_progress"},
        "resolved": {"done"},
        "closed": {"done"},
    }
    for wo in big.query(WorkOrder).filter(WorkOrder.incident_id.like("INC-DEMOL-%")).all():
        inc = big.get(Incident, wo.incident_id)
        assert wo.status.value in expected[inc.status.value]
        assert (wo.resolved_at is not None) == (wo.status.value == "done")
        assert inc.work_order_id == wo.id


def test_variety_of_categories_statuses_and_severities(big):
    incs = big.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).all()
    assert len({i.category_id for i in incs}) == 12
    assert {i.status.value for i in incs} == set(INCIDENT_STATUSES)
    assert {i.severity.value for i in incs} == {"low", "medium", "high", "critical"}
    cats = {c.id: c for c in big.query(Category).all()}
    open_incs = [i for i in incs if i.status.value in OPEN_STATUSES]
    assert 120 < len(open_incs) < 350
    overdue = [i for i in open_incs if is_overdue(i, cats[i.category_id])]
    assert len(overdue) >= 0.10 * len(open_incs)


def test_dashboard_is_full(big):
    d = build_dashboard(big, "7d")
    assert d["resolvedThisWeek"] > 0 and d["overdue"] > 0 and d["open"] > 100
    assert len(d["byCategory"]) == 12 and len(d["departments"]) >= 6 and len(d["overdueList"]) == 5
    created = [i.created_at for i in big.query(Incident).filter(Incident.id.like("INC-DEMOL-%"))]
    now = now_utc().replace(tzinfo=None)
    last7 = sum(1 for c in created if c > now - timedelta(days=7))
    prev7 = sum(1 for c in created if now - timedelta(days=14) < c <= now - timedelta(days=7))
    assert last7 > prev7


def test_hotspots_and_duplicates_exist(big):
    admin = {"role": "admin", "sub": "admin-001"}
    spots = cluster_incidents(big, admin, days=30, radius_meters=500, min_count=3, now=now_utc())
    assert len(spots["items"]) >= 3
    with_dupes = 0
    for inc in big.query(Incident).filter(Incident.id.like("INC-DEMOL-%"), Incident.status.in_(OPEN_STATUSES)).all():
        if find_duplicates(big, inc):
            with_dupes += 1
    assert with_dupes >= 10


def test_bins_cover_every_status_and_the_forecast_works(big):
    admin = {"role": "admin", "sub": "admin-001"}
    bins = big.query(SmartBin).filter(SmartBin.id.like("%-DEMOL-%")).all()
    assert len(bins) == 60 and all(b.is_simulated for b in bins)
    assert {_bin_status(b) for b in bins} == {"normal", "full", "heat", "low_battery", "offline"}
    forecast = forecast_bins(big, admin, 24, now=now_utc())["items"]
    demo = {b.id for b in bins if b.last_seen_at}
    reasons = [f["reason"] for f in forecast if f["binId"] in demo]
    assert reasons.count("ok") >= 0.5 * len(reasons)
    assert {"non_increasing", "insufficient_data"} <= set(reasons)
    assert big.query(BinReport).count() > 0
    hubs = [b for b in bins if b.id.startswith("HUB-")]
    assert len(hubs) == 8


def test_pickups_weighings_and_collectors_are_consistent(big):
    collectors = {c.id: c for c in big.query(Collector).all()}
    pickups = big.query(RecyclingPickup).filter(RecyclingPickup.id.like("RCY-DEMOL-%")).all()
    assert {p.status for p in pickups} == {"requested", "accepted", "weighed", "completed", "cancelled"}
    assert {c.status for c in collectors.values() if c.id.startswith("COL-DEMOL")} == {
        "verified",
        "pending",
        "suspended",
    }
    for p in pickups:
        weighings = big.query(Weighing).filter(Weighing.pickup_id == p.id).order_by(Weighing.at).all()
        if p.status in ("weighed", "completed"):
            assert weighings
        else:
            assert not weighings
        if p.status in ("accepted", "weighed"):
            assert collectors[p.collector_id].status == "verified"
        if p.status in ("requested", "cancelled"):
            assert p.collector_id is None
        if p.status == "completed":
            assert collectors[p.collector_id].status in ("verified", "suspended")
        if p.collector_id:
            assert p.created_at <= p.accepted_at <= weighings[0].at if weighings else p.created_at <= p.accepted_at
        if p.confirmed_at:
            assert weighings[-1].at <= p.collector_finished_at <= p.confirmed_at
        if p.paid_to_household_egp is not None:
            assert p.mode == "paid"
        for w in weighings:
            assert w.value_egp == (round(w.price_egp_per_kg * w.kg, 2) if w.price_egp_per_kg is not None else None)


def test_service_requests_follow_the_calendar_rule(big):
    for sr in big.query(ServiceRequest).filter(ServiceRequest.id.like("SRV-DEMOL-%")).all():
        status = sr.status.value
        if sr.service_type == "bulky_waste":
            assert sr.details["payment"] in {"cash", "fawry", "instapay", "wallet"}
            if status in OPEN_STATUSES:
                assert datetime.fromisoformat(sr.details["day"]).weekday() not in (4, 5)
    assert {s.status.value for s in big.query(ServiceRequest).filter(ServiceRequest.id.like("SRV-DEMOL-%"))} == set(
        INCIDENT_STATUSES
    )


def test_demo_citizen_and_collector_are_linked_locally(big):
    mine = big.query(Report).filter(Report.reporter_id == "citizen-001", Report.id.like("FTC-DEMOL-%")).count()
    assert mine >= 12
    assert big.query(ServiceRequest).filter(ServiceRequest.citizen_id == "citizen-001").count() >= 4
    assert big.query(RecyclingPickup).filter(RecyclingPickup.citizen_id == "citizen-001").count() >= 8
    assert big.query(RecyclingPickup).filter(RecyclingPickup.collector_id == "COL-1").count() >= 30
    assert big.query(Notification).filter(Notification.recipient_id == "citizen-001").count() > 0
    assert big.query(AISuggestion).filter(AISuggestion.id.like("AS-DEMOL-%")).count() > 0


# ----------------------------------------------------------------------------- API performance smoke
def test_api_endpoints_stay_fast_on_the_large_set(client, db, admin_h):
    seed_large_local(db)
    paths = [
        ("GET", "/admin/dashboard?range=7d"),
        ("GET", "/admin/incidents"),
        ("GET", "/admin/work-orders"),
        ("GET", "/admin/service-requests"),
        ("GET", "/admin/insights"),
        ("GET", "/incidents"),
        ("GET", "/map/incidents"),
        ("GET", "/bins"),
        ("GET", "/admin/bins"),
        ("GET", "/admin/bins/forecast?horizonHours=24"),
        ("GET", "/admin/hotspots?days=30"),
        ("GET", "/admin/recycling/summary"),
        ("GET", "/admin/recycling/pickups?limit=500"),
        ("GET", "/admin/collectors"),
        ("GET", "/admin/payouts"),
        ("POST", "/admin/budget/optimize"),
    ]
    total = 0.0
    rows = []
    for method, path in paths:
        started = time.monotonic()
        if method == "POST":
            response = client.post(path, headers=admin_h, json={"budgetEgp": 300000})
        else:
            response = client.get(path, headers=admin_h)
        elapsed = time.monotonic() - started
        total += elapsed
        rows.append((method, path, response.status_code, elapsed, len(response.content)))
        assert response.status_code == 200, (path, response.text[:200])
        assert elapsed < 3.0, (path, elapsed)
    print("\n  method path status seconds bytes")
    for row in rows:
        print("  %-4s %-45s %d %6.2fs %9d" % row)
    print("  total %.2fs" % total)
    assert total < 25


# ----------------------------------------------------------------------------- config and CLI gates
def test_default_seed_scale_is_default():
    assert settings.seed_scale == "default"


def test_local_seed_refuses_non_sqlite(isolated_db, monkeypatch):
    class Bind:
        class dialect:  # noqa: N801
            name = "postgresql"

    monkeypatch.setattr(isolated_db, "get_bind", lambda *a, **k: Bind)
    with pytest.raises(RuntimeError):
        seed_large_local(isolated_db)


def test_cli_gates(tmp_path, monkeypatch, capsys):
    path = tmp_path / "rehearsal.db"
    url = f"sqlite:///{path}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_db(db)
    engine.dispose()
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.delenv(seed_large_demo.CONFIRM_ENV, raising=False)

    assert seed_large_demo.main(["--expected-project-ref", "abcdefgh"]) == 2
    capsys.readouterr()
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--scale", "0.15"]) == 0
    assert json.loads(capsys.readouterr().out)["mode"] == "dry-run"
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--scale", "0.15", "--apply"]) == 2
    assert "CITYFIX_DEMO_SEED_CONFIRM" in capsys.readouterr().err
    engine = create_engine(url)
    with Session(engine) as db:
        assert db.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).count() == 0

    monkeypatch.setenv(seed_large_demo.CONFIRM_ENV, "sqlite")
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--scale", "0.15", "--apply"]) == 0
    applied = json.loads(capsys.readouterr().out)
    assert applied["counts"]["incidents"] > 0 and "device_key_hash" not in json.dumps(applied)
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--scale", "0.15", "--apply"]) == 0
    assert json.loads(capsys.readouterr().out)["unitsToAdd"] == 0
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--cleanup"]) == 0
    assert json.loads(capsys.readouterr().out)["mode"] == "cleanup-dry-run"
    with Session(engine) as db:
        assert db.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).count() > 0
    assert seed_large_demo.main(["--expected-project-ref", "sqlite", "--cleanup", "--apply"]) == 0
    with Session(engine) as db:
        assert db.query(Incident).filter(Incident.id.like("INC-DEMOL-%")).count() == 0
        assert db.query(Profile).filter(Profile.id.like("demol-%")).count() == 0
    engine.dispose()


def test_cli_preflight_fails_cleanly_without_base_data(tmp_path, monkeypatch, capsys):
    url = f"sqlite:///{tmp_path / 'empty.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    engine.dispose()
    monkeypatch.setattr(settings, "database_url", url)
    assert seed_large_demo.main(["--expected-project-ref", "sqlite"]) == 2
    assert "Preflight failed" in capsys.readouterr().err


# ----------------------------------------------------------------------------- PostgreSQL (disposable server only)
def test_postgres_apply_is_idempotent_and_cleanup_restores_counts():
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config

    base = make_url(source_url)
    database_name = f"s1_large_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    try:
        command.upgrade(_alembic_config(test_url.render_as_string(hide_password=False)), "head")
        with Session(engine) as db:
            seed_db(db)
            tables = [t.name for t in Base.metadata.sorted_tables]
            base_counts = _counts(db, tables)
            opts = LargeOptions(scale=0.3)
            first = apply(db, opts)
            assert first["counts"]["incidents"] > 0 and first["counts"]["bin_readings"] > 0
            assert apply(db, opts)["unitsToAdd"] == 0
            assert cleanup(db)["blockers"] == {}
            cleanup(db, apply=True)
            assert _counts(db, tables) == base_counts
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


__all__ = ["staff_headers", "seed_large", "BinReading"]
