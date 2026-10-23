"""Local API benchmark: latency, SQL statement count and payload size per endpoint.

Run from ``backend/``::

    python -m scripts.bench_api --scale large --repeat 5 --json bench.json

Safety: this script ALWAYS creates its own temporary SQLite file and points ``DATABASE_URL`` at it
before ``app`` is imported. It never reads an existing ``DATABASE_URL``, and it refuses
``--database-url`` and every argument that is not listed below, so it cannot touch a real database.
Numbers are in-process (TestClient) on SQLite: they exclude network and Postgres latency.
"""

import argparse
import importlib
import json
import os
import platform
import statistics
import sys
import tempfile
import time

_ALLOWED = {"--scale", "--seed-callable", "--repeat", "--json"}


def _parse(argv: list[str]) -> argparse.Namespace:
    for arg in argv:
        if arg.startswith("--") and arg.split("=", 1)[0] not in _ALLOWED:
            sys.exit(f"refused: unknown argument {arg!r} (this script only ever uses its own temp SQLite file)")
    ap = argparse.ArgumentParser(description=__doc__, allow_abbrev=False)
    ap.add_argument("--scale", choices=["default", "large"], default="default")
    ap.add_argument("--seed-callable", default="app.seed:seed_db", help="module:function taking a Session")
    ap.add_argument("--repeat", type=int, default=5)
    ap.add_argument("--json", dest="json_path", default=None)
    return ap.parse_args(argv)


def main(argv: list[str]) -> None:
    args = _parse(argv)
    sys.path.insert(0, os.getcwd())
    fd, path = tempfile.mkstemp(suffix=".db", prefix="cityfix-bench-")
    os.close(fd)
    os.environ["DATABASE_URL"] = f"sqlite:///{path}"  # overrides anything in the caller's environment
    os.environ.setdefault("JWT_SECRET", "bench-dummy-secret-not-for-production")
    os.environ.setdefault("OTP_MODE", "demo")
    try:
        _run(args, path)
    finally:
        os.unlink(path)


def _run(args: argparse.Namespace, path: str) -> None:
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine, event
    from sqlalchemy.orm import sessionmaker

    from app.auth import AuthContext, AuthSettings
    from app.auth_adapters import DatabaseStaffDirectory, DatabaseUserRepository
    from app.config import settings
    from app.db import get_db
    from app.main import app
    from app.models import Base, Incident
    from app.staff_auth import StaffLoginContext
    from scripts.bench_data import add_bulk

    engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False})
    assert str(engine.url.database) == path, "bench must only use its own temp database"
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)

    mod_name, func_name = args.seed_callable.split(":")
    seed = getattr(importlib.import_module(mod_name), func_name)
    db = factory()
    t0 = time.perf_counter()
    seed(db)
    if args.scale == "large":
        add_bulk(db)
    db.commit()
    print(f"seeded ({args.scale}) in {time.perf_counter() - t0:.1f}s", file=sys.stderr)

    popular = max(db.query(Incident).all(), key=lambda i: (i.followers_count or 0, i.id))
    sample = db.query(Incident).order_by(Incident.id.desc()).first()
    assert sample is not None
    popular_id, sample_id = popular.id, sample.id
    from app.models import RecyclingPickup

    requested = [p.id for p in db.query(RecyclingPickup).filter_by(status="requested").limit(30).all()]
    db.close()

    counter = {"n": 0}
    event.listen(engine, "before_cursor_execute", lambda *a, **k: counter.__setitem__("n", counter["n"] + 1))

    def override():
        s = factory()
        try:
            yield s
        finally:
            s.close()

    settings.demo_reset_enabled = False
    app.state.auth_context = AuthContext(
        AuthSettings(jwt_secret=settings.jwt_secret, demo_otp=True), DatabaseUserRepository(factory)
    )
    app.state.staff_login_context = StaffLoginContext(DatabaseStaffDirectory(factory))
    app.state.media_storage = None
    app.dependency_overrides[get_db] = override
    client = TestClient(app)

    def login(email: str) -> dict:
        r = client.post("/auth/staff-login", json={"email": email, "password": "FixCity2026!"})
        return {"Authorization": f"Bearer {r.json()['token']}"}

    admin = login("admin@cityfix.demo")
    staff = login("roads@cityfix.demo")
    r = client.post("/auth/verify", json={"phone": "01012345678", "code": "123456"})
    citizen = {"Authorization": f"Bearer {r.json()['token']}"}

    cases: list[tuple[str, str, dict, dict | None, int]] = [
        ("GET", "/admin/dashboard?range=7d", admin, None, args.repeat),
        ("GET", "/admin/incidents", admin, None, args.repeat),
        ("GET", "/admin/incidents?status=received", admin, None, args.repeat),
        ("GET", "/admin/incidents", staff, None, args.repeat),
        ("GET", "/incidents", citizen, None, args.repeat),
        ("GET", "/incidents", admin, None, args.repeat),
        ("GET", "/map/incidents", citizen, None, args.repeat),
        ("GET", "/admin/insights", admin, None, args.repeat),
        ("GET", "/admin/work-orders", admin, None, args.repeat),
        ("GET", "/admin/service-requests", admin, None, args.repeat),
        ("GET", f"/admin/incidents/{sample_id}", admin, None, args.repeat),
        ("GET", f"/admin/incidents/{sample_id}/similar", admin, None, args.repeat),
        ("GET", "/admin/bins", admin, None, args.repeat),
        ("GET", "/admin/bins/forecast", admin, None, args.repeat),
        ("GET", "/admin/hotspots?days=90", admin, None, args.repeat),
        ("GET", "/admin/recycling/summary", admin, None, args.repeat),
        ("GET", "/admin/recycling/pickups?limit=500", admin, None, args.repeat),
        ("GET", "/admin/collectors", admin, None, args.repeat),
        ("GET", "/admin/payouts", admin, None, args.repeat),
        ("GET", "/bins", citizen, None, args.repeat),
        ("GET", "/auth/me", admin, None, args.repeat),
        ("POST", "/admin/budget/optimize", admin, {"budgetEgp": 500000}, args.repeat),
        ("POST", "/admin/budget/optimize", admin, {"budgetEgp": 5000000}, args.repeat),
        (
            "PATCH",
            f"/admin/incidents/{popular_id}",
            admin,
            {"status": "triaged", "note": "bench"},
            1,
        ),
    ]
    if requested:
        cases.append(
            (
                "POST",
                "/admin/recycling/routes/optimize",
                admin,
                {"pickupIds": requested, "depot": {"lat": 30.06, "lng": 31.34}, "vehicleCount": 3, "capacityKg": 500},
                min(args.repeat, 2),
            )
        )

    # make the PATCH deterministic: the most-followed incident starts as `received`
    from app.models import Incident as Inc

    s = factory()
    row = s.get(Inc, popular_id)
    row.status = "received"
    s.commit()
    s.close()

    rows = []
    for method, url, headers, body, repeat in cases:
        times: list[float] = []
        status = 0
        size = 0
        sql = 0
        for _ in range(repeat):
            counter["n"] = 0
            t = time.perf_counter()
            resp = client.request(method, url, headers=headers, json=body)
            times.append((time.perf_counter() - t) * 1000)
            status, size, sql = resp.status_code, len(resp.content), counter["n"]
        who = "staff" if headers is staff else ("citizen" if headers is citizen else "admin")
        rows.append(
            {
                "endpoint": f"{method} {url} ({who}{', ' + str(body['budgetEgp']) + ' EGP' if body and 'budgetEgp' in body else ''})",
                "status": status,
                "median_ms": round(statistics.median(times), 1),
                "max_ms": round(max(times), 1),
                "sql": sql,
                "bytes": size,
            }
        )

    print(
        f"local in-process SQLite, excludes network/Postgres latency; Python {platform.python_version()}, "
        f"{os.cpu_count()} CPUs, scale={args.scale}, repeat={args.repeat}\n"
    )
    print("| endpoint | status | median ms | max ms | SQL stmts | bytes |")
    print("|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['endpoint']} | {r['status']} | {r['median_ms']} | {r['max_ms']} | {r['sql']} | {r['bytes']} |")
    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as fh:
            json.dump(rows, fh, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main(sys.argv[1:])
