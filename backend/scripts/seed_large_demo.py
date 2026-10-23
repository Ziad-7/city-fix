"""Add (or remove) the large synthetic demo dataset in a database you name explicitly.

Safe by construction, mirroring ``seed_citycycle_additive.py``:
  * dry run unless ``--apply``; ``--cleanup`` is a dry run unless ``--apply`` is also given
  * ``--expected-project-ref`` must match the ``DATABASE_URL`` host (``local`` or ``sqlite`` for rehearsal)
  * any write also needs ``CITYFIX_DEMO_SEED_CONFIRM`` set to that same ref
  * additive only: rows get ``DEMOL`` ids, nothing existing is updated; cleanup removes only those rows and refuses
    when real rows depend on them
See docs/demo-data.md. Exit codes: 0 ok, 1 database error (re-run to resume), 2 refused by a gate, 3 cleanup blocked.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import seed_large
from app.config import settings
from scripts.migrate import _project_matches

CONFIRM_ENV = "CITYFIX_DEMO_SEED_CONFIRM"


def _identity_ok(url: str, ref: str) -> bool:
    if ref == "sqlite":
        return url.startswith("sqlite")
    return _project_matches(url, ref)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add or remove the large synthetic CityFix demo dataset")
    parser.add_argument("--expected-project-ref", required=True)
    parser.add_argument("--apply", action="store_true", help="write (default is a dry run)")
    parser.add_argument("--cleanup", action="store_true", help="remove the demo rows (dry run unless --apply)")
    parser.add_argument("--scale", type=float, default=1.0)
    parser.add_argument("--seed", type=int, default=seed_large.DEFAULT_SEED)
    parser.add_argument("--chunk-units", type=int, default=200)
    parser.add_argument("--pause-ms", type=int, default=0)
    args = parser.parse_args(argv)

    url = settings.database_url
    if not _identity_ok(url, args.expected_project_ref):
        print("Database project identity does not match --expected-project-ref", file=sys.stderr)
        return 2
    if args.apply and os.environ.get(CONFIRM_ENV) != args.expected_project_ref:
        print(f"Refusing to write: set {CONFIRM_ENV}={args.expected_project_ref}", file=sys.stderr)
        return 2

    # Real databases never get requested pickups, linked citizens, notifications or price rows (see the runbook).
    opts = seed_large.LargeOptions(scale=args.scale, seed=args.seed)
    engine = create_engine(url, pool_pre_ping=True)
    try:
        with Session(engine) as db:
            if args.cleanup:
                report = seed_large.cleanup(db, apply=args.apply)
                code = 3 if report.get("refused") else 0
            elif args.apply:
                report = seed_large.apply(db, opts, chunk_units=args.chunk_units, pause_ms=args.pause_ms)
                code = 0
            else:
                report = seed_large.plan(db, opts)
                code = 0
    except seed_large.DemoSeedError as exc:
        print(f"Preflight failed: {exc}", file=sys.stderr)
        return 2
    except SQLAlchemyError as exc:
        print(
            f"Database error ({type(exc).__name__}); earlier chunks stay committed, re-run to resume", file=sys.stderr
        )
        return 1
    finally:
        engine.dispose()
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
