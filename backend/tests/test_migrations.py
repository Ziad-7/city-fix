import os
import uuid

import pytest
from sqlalchemy import create_engine, inspect

from app.models import Base
from scripts.migrate import _project_matches, baseline_schema_differences


def test_baseline_schema_checker_detects_missing_table():
    engine = create_engine("sqlite:///:memory:")
    try:
        issues = baseline_schema_differences(inspect(engine))
        assert any("missing table 'incidents'" in issue for issue in issues)
    finally:
        engine.dispose()


def test_local_bootstrap_remains_available_for_explicit_sqlite_setup():
    assert "incidents" in Base.metadata.tables


def test_project_identity_requires_database_host_or_project_qualified_pooler_username():
    ref = "abc123xyz"
    assert _project_matches(f"postgresql://postgres:secret@db.{ref}.supabase.co:5432/postgres", ref)
    assert _project_matches(
        f"postgresql://postgres.{ref}:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres", ref
    )
    assert not _project_matches(
        f"postgresql://postgres:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?project_ref={ref}", ref
    )
    assert not _project_matches("postgresql://postgres:secret@unrelated.example:5432/postgres", ref)


def test_postgres_migration_enables_rls_for_every_cityfix_table(monkeypatch, capsys):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy.engine import make_url

    from scripts.migrate import HEAD_SCHEMA, main

    base = make_url(source_url)
    database_name = f"member4_{uuid.uuid4().hex[:12]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    try:
        monkeypatch.setenv("CITYFIX_DATABASE_URL", test_url.render_as_string(hide_password=False))
        assert main(["--apply", "--expected-project-ref", "local"]) == 0
        assert main(["--check", "--expected-project-ref", "local"]) == 0
        assert main(["--apply", "--expected-project-ref", "local"]) == 0
        capsys.readouterr()
        assert main(["--plan", "--expected-project-ref", "local"]) == 0
        assert "CREATE TABLE" not in capsys.readouterr().out
        with engine.connect() as conn:
            enabled = set(
                conn.exec_driver_sql(
                    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace "
                    "WHERE n.nspname=current_schema() AND c.relkind='r' AND c.relrowsecurity"
                ).scalars()
            )
        assert enabled == set(HEAD_SCHEMA) | {"alembic_version"}
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


def test_populated_compatible_postgres_baseline_is_adopted_without_changing_ids(monkeypatch, capsys):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy import text
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config, main

    base = make_url(source_url)
    database_name = f"member4_adopt_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    try:
        command.upgrade(_alembic_config(test_url.render_as_string(hide_password=False)), "0001_existing_schema")
        with engine.begin() as conn:
            conn.execute(text("INSERT INTO profiles (id) VALUES ('preserved-profile-id')"))
            conn.execute(text("DROP TABLE alembic_version"))
        monkeypatch.setenv("CITYFIX_DATABASE_URL", test_url.render_as_string(hide_password=False))
        assert main(["--plan", "--expected-project-ref", "local"]) == 0
        plan = capsys.readouterr().out
        assert "CREATE TABLE otp_challenges" in plan
        assert "CREATE TABLE profiles" not in plan
        assert main(["--apply", "--expected-project-ref", "local"]) == 0
        with engine.connect() as conn:
            assert (
                conn.execute(text("SELECT id FROM profiles WHERE id='preserved-profile-id'")).scalar_one()
                == "preserved-profile-id"
            )
            assert (
                conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
                == "0002_delivery_foundation"
            )
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


def test_postgres_additive_migration_failure_rolls_back_its_ddl():
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy import text
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config

    base = make_url(source_url)
    database_name = f"member4_fail_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    engine = create_engine(test_url)
    cfg = _alembic_config(test_url.render_as_string(hide_password=False))
    try:
        command.upgrade(cfg, "0001_existing_schema")
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE push_tokens (collision integer)"))
        with pytest.raises(Exception):
            command.upgrade(cfg, "head")
        with engine.connect() as conn:
            tables = set(__import__("sqlalchemy").inspect(conn).get_table_names())
            revision = conn.exec_driver_sql("SELECT version_num FROM alembic_version").scalar_one()
        assert revision == "0001_existing_schema"
        assert "otp_challenges" not in tables
        assert "otp_throttles" not in tables
        assert "notifications" not in tables
        assert "push_tokens" in tables
    finally:
        engine.dispose()
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


def test_postgres_migration_check_refuses_changed_enum_labels(monkeypatch):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config, main

    base = make_url(source_url)
    database_name = f"member4_enum_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    rendered = test_url.render_as_string(hide_password=False)
    try:
        command.upgrade(_alembic_config(rendered), "0001_existing_schema")
        with psycopg.connect(
            test_url.set(drivername="postgresql").render_as_string(hide_password=False), autocommit=True
        ) as conn:
            conn.execute("ALTER TYPE incidentstatusenum ADD VALUE 'BAD_STATUS'")
            conn.execute("DROP TABLE alembic_version")
        monkeypatch.setenv("CITYFIX_DATABASE_URL", rendered)
        assert main(["--check", "--expected-project-ref", "local"]) == 1
    finally:
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


def test_postgres_migration_check_refuses_changed_timestamp_timezone(monkeypatch):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config, main

    base = make_url(source_url)
    database_name = f"member4_tz_{uuid.uuid4().hex[:10]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    rendered = test_url.render_as_string(hide_password=False)
    try:
        command.upgrade(_alembic_config(rendered), "head")
        with psycopg.connect(
            test_url.set(drivername="postgresql").render_as_string(hide_password=False), autocommit=True
        ) as conn:
            conn.execute("ALTER TABLE otp_throttles ALTER COLUMN window_started_at TYPE TIMESTAMPTZ")
        monkeypatch.setenv("CITYFIX_DATABASE_URL", rendered)
        assert main(["--check", "--expected-project-ref", "local"]) == 1
    finally:
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))


def test_postgres_migration_check_refuses_equivalent_labels_under_forged_enum_name(monkeypatch):
    source_url = os.getenv("CITYFIX_TEST_POSTGRES_URL")
    if not source_url:
        pytest.skip("disposable PostgreSQL is not configured")
    import psycopg
    from psycopg import sql
    from sqlalchemy.engine import make_url

    from alembic import command
    from scripts.migrate import _alembic_config, main

    base = make_url(source_url)
    database_name = f"member4_enumname_{uuid.uuid4().hex[:9]}"
    admin = base.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name)))
    test_url = base.set(database=database_name)
    rendered = test_url.render_as_string(hide_password=False)
    try:
        command.upgrade(_alembic_config(rendered), "head")
        with psycopg.connect(
            test_url.set(drivername="postgresql").render_as_string(hide_password=False), autocommit=True
        ) as conn:
            conn.execute(
                "CREATE TYPE forgedstatusenum AS ENUM ('RECEIVED','TRIAGED','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED')"
            )
            conn.execute(
                "ALTER TABLE incidents ALTER COLUMN status TYPE forgedstatusenum USING status::text::forgedstatusenum"
            )
        monkeypatch.setenv("CITYFIX_DATABASE_URL", rendered)
        assert main(["--check", "--expected-project-ref", "local"]) == 1
    finally:
        with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
            conn.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database_name)))
