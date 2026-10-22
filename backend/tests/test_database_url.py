"""DATABASE_URL handling: Postgres URLs use the psycopg 3 driver we ship."""

import pytest

from app.config import Settings, normalize_database_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgresql://u:p@host:5432/postgres", "postgresql+psycopg://u:p@host:5432/postgres"),
        ("postgres://u:p@host:5432/postgres", "postgresql+psycopg://u:p@host:5432/postgres"),
        ("  postgresql://u:p@host/db \n", "postgresql+psycopg://u:p@host/db"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),
        ("sqlite:///./fixthecity.db", "sqlite:///./fixthecity.db"),
    ],
)
def test_normalize_database_url(raw: str, expected: str) -> None:
    assert normalize_database_url(raw) == expected


def test_settings_apply_the_driver_prefix() -> None:
    cfg = Settings(database_url="postgresql://u:p@host:5432/postgres")
    assert cfg.database_url.startswith("postgresql+psycopg://")
