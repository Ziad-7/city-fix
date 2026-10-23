"""Safe operator entry point for forward-only Alembic migrations."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from alembic.config import Config
from sqlalchemy import create_engine, inspect

from alembic import command
from app.config import normalize_database_url, settings

BACKEND = Path(__file__).resolve().parents[1]
BASELINE = json.loads((BACKEND / "alembic" / "baseline_schema.json").read_text())
HEAD_SCHEMA = json.loads((BACKEND / "alembic" / "head_schema.json").read_text())
EXPECTED_ENUMS = json.loads((BACKEND / "alembic" / "baseline_enums.json").read_text())
ADDITIVE_TABLES = set(HEAD_SCHEMA) - set(BASELINE)


def _type_family(name: str) -> str:
    upper = name.upper()
    if upper in {"STRING", "VARCHAR", "NVARCHAR", "CHAR", "NCHAR"}:
        return "STRING"
    if upper in {"INTEGER", "INT", "BIGINT", "BIGINTEGER", "SMALLINT", "SERIAL", "BIGSERIAL"}:
        return "BIGINT" if upper == "BIGINTEGER" else upper
    if upper in {"FLOAT", "FLOAT4", "FLOAT8", "REAL", "DOUBLE", "DOUBLE PRECISION", "DOUBLE_PRECISION"}:
        return "FLOAT"
    if upper in {"DATETIME", "TIMESTAMP", "TIMESTAMP WITHOUT TIME ZONE"}:
        return "DATETIME"
    if upper in {"JSON", "JSONB"}:
        return upper
    if upper == "ENUM":
        return "ENUM"
    return upper


def baseline_schema_differences(inspector, expected_schema=BASELINE) -> list[str]:
    """Compare an existing schema to a frozen snapshot, including keys and indexes."""
    issues: list[str] = []
    actual_tables = set(inspector.get_table_names())
    for table_name, expected in expected_schema.items():
        if table_name not in actual_tables:
            issues.append(f"missing table '{table_name}'")
            continue
        actual_columns = {col["name"]: col for col in inspector.get_columns(table_name)}
        for column_name, spec in expected["columns"].items():
            col = actual_columns.get(column_name)
            if col is None:
                issues.append(f"{table_name}: missing column '{column_name}'")
                continue
            actual_type = col["type"]
            actual_family = _type_family(type(actual_type).__name__)
            expected_family = _type_family(spec["type"])
            if actual_family != expected_family:
                issues.append(f"{table_name}.{column_name}: type {actual_type} differs from {spec['type']}")
            if expected_family == "DATETIME" and "timezone" in spec:
                actual_timezone = bool(getattr(actual_type, "timezone", False))
                if actual_timezone != bool(spec["timezone"]):
                    issues.append(
                        f"{table_name}.{column_name}: timezone={actual_timezone} differs from {spec['timezone']}"
                    )
            if expected_family == "ENUM" and "enum_name" in spec:
                actual_name = getattr(actual_type, "name", None)
                if actual_name != spec["enum_name"]:
                    issues.append(f"{table_name}.{column_name}: enum {actual_name} differs from {spec['enum_name']}")
            expected_length = spec.get("length")
            actual_length = getattr(actual_type, "length", None)
            if expected_length is not None and actual_length != expected_length:
                issues.append(f"{table_name}.{column_name}: length {actual_length} differs from {expected_length}")
            if bool(col["nullable"]) != bool(spec["nullable"]):
                issues.append(f"{table_name}.{column_name}: nullable={col['nullable']} differs from {spec['nullable']}")
        unexpected = set(actual_columns) - set(expected["columns"])
        for column_name in sorted(unexpected):
            issues.append(f"{table_name}: unexpected column '{column_name}'")
        pk = inspector.get_pk_constraint(table_name).get("constrained_columns") or []
        if list(pk) != expected["primary_key"]:
            issues.append(f"{table_name}: primary key {pk} differs from {expected['primary_key']}")
        fks = sorted(
            (
                {
                    "column": fk["constrained_columns"][0],
                    "table": fk["referred_table"],
                    "referred": fk["referred_columns"][0],
                }
                for fk in inspector.get_foreign_keys(table_name)
                if len(fk["constrained_columns"]) == 1 and len(fk["referred_columns"]) == 1
            ),
            key=lambda item: (item["column"], item["table"], item["referred"]),
        )
        if fks != expected["foreign_keys"]:
            issues.append(f"{table_name}: foreign keys differ from the frozen baseline")
        unique = sorted(sorted(item.get("column_names") or []) for item in inspector.get_unique_constraints(table_name))
        if unique != expected["unique_constraints"]:
            issues.append(f"{table_name}: unique constraints differ from the frozen baseline")
        indexes = sorted(
            (
                {"name": index["name"], "columns": index["column_names"], "unique": bool(index["unique"])}
                for index in inspector.get_indexes(table_name)
                if not index.get("duplicates_constraint")
            ),
            key=lambda item: item["name"],
        )
        expected_indexes = sorted(expected["indexes"], key=lambda item: item["name"])
        if indexes != expected_indexes:
            issues.append(f"{table_name}: indexes differ from the frozen baseline")
    return issues


def rls_disabled_tables(engine, table_names: set[str]) -> list[str]:
    """Find CityFix-owned public tables lacking Row Level Security."""
    if engine.dialect.name != "postgresql":
        return []
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(
            "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname=current_schema() AND c.relkind='r' AND c.relname = ANY(%(names)s) "
            "AND NOT c.relrowsecurity",
            {"names": list(table_names)},
        ).scalars()
        return sorted(rows)


def enum_differences(inspector) -> list[str]:
    """Compare frozen CityFix enum names and labels, including extra labels."""
    actual = {item["name"]: item.get("labels", []) for item in inspector.get_enums()}
    issues = []
    for name, labels in EXPECTED_ENUMS.items():
        if actual.get(name) != labels:
            issues.append(f"enum {name}: labels {actual.get(name)} differ from frozen baseline {labels}")
    return issues


def _project_matches(url: str, expected_ref: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if expected_ref == "local":
        return host in {"localhost", "127.0.0.1", "::1"}
    if host == f"db.{expected_ref}.supabase.co":
        return True
    # Supabase shared pooler hostnames contain only region/instance, so bind
    # identity to the project-qualified database username as well as host.
    username = unquote(parsed.username or "")
    return host.endswith(".pooler.supabase.com") and username == f"postgres.{expected_ref}"


def _alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Inspect or apply reviewed CityFix database migrations")
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--check", action="store_true")
    modes.add_argument("--plan", action="store_true")
    modes.add_argument("--apply", action="store_true")
    parser.add_argument("--expected-project-ref", required=True)
    args = parser.parse_args(argv)
    url = normalize_database_url(
        os.environ.get("CITYFIX_DATABASE_URL") or os.environ.get("CITYFIX_TEST_POSTGRES_URL") or settings.database_url
    )
    if not _project_matches(url, args.expected_project_ref):
        print("Database project identity does not match --expected-project-ref", file=sys.stderr)
        return 2
    parsed = urlparse(url)
    if not parsed.scheme.startswith("postgresql"):
        print(
            "Alembic migration commands require PostgreSQL; use explicit SQLite local bootstrap for development",
            file=sys.stderr,
        )
        return 2

    engine = create_engine(url, pool_pre_ping=True)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        has_version = "alembic_version" in tables
        app_tables = tables - {"alembic_version"}
        if has_version:
            with engine.connect() as conn:
                version = conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one_or_none()
            print(f"Alembic revision: {version or 'empty'}")
            if version == "0002_delivery_foundation":
                expected = HEAD_SCHEMA
            elif version == "0001_existing_schema":
                if tables & ADDITIVE_TABLES:
                    print(
                        "Unversioned delivery tables exist at the baseline revision; refusing an ambiguous upgrade",
                        file=sys.stderr,
                    )
                    return 1
                expected = BASELINE
            else:
                return 1
            issues = baseline_schema_differences(inspect(engine), expected)
            issues.extend(enum_differences(inspect(engine)))
            if issues:
                print("Schema drift detected:", file=sys.stderr)
                for issue in issues:
                    print(f"- {issue}", file=sys.stderr)
                return 1
            if version == "0002_delivery_foundation":
                disabled = rls_disabled_tables(engine, set(HEAD_SCHEMA) | {"alembic_version"})
                if disabled:
                    print(f"RLS disabled on CityFix tables: {', '.join(disabled)}", file=sys.stderr)
                    return 1
            if args.check:
                return 0
        elif app_tables:
            delivery_tables = app_tables & ADDITIVE_TABLES
            if delivery_tables:
                print(
                    "Unversioned delivery tables exist; refusing to stamp a partial or untracked schema",
                    file=sys.stderr,
                )
                return 1
            issues = baseline_schema_differences(inspector)
            issues.extend(enum_differences(inspector))
            if issues:
                print("Existing schema does not match the frozen baseline:", file=sys.stderr)
                for issue in issues:
                    print(f"- {issue}", file=sys.stderr)
                return 1
            if args.check:
                print("Existing schema matches the frozen baseline and can be adopted")
                return 0
        elif args.check:
            print("Database is empty; reviewed migrations can create the baseline")
            return 0

        if args.plan:
            cfg = _alembic_config(url)
            if has_version:
                start = f"{version}:head"
            elif app_tables:
                start = "0001_existing_schema:head"
            else:
                start = "head"
            command.upgrade(cfg, start, sql=True)
            return 0
        if args.apply:
            cfg = _alembic_config(url)
            if app_tables and not has_version:
                command.stamp(cfg, "0001_existing_schema")
            command.upgrade(cfg, "head")
            with engine.connect() as conn:
                version = conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
            print(f"Applied through revision {version}")
            return 0
        return 0
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
