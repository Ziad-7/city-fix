"""Pytest configuration and fixtures."""

import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db import get_db
from app.main import app
from app.models import Base
from app.seed import seed_db


@pytest.fixture(scope="session")
def db_engine():
    """Create a temporary database engine for testing."""
    # Use a temporary SQLite database
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)

    database_url = f"sqlite:///{path}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    engine.dispose()
    os.unlink(path)


@pytest.fixture
def db(db_engine):
    """Provide a fresh database session for each test."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    connection = db_engine.connect()
    transaction = connection.begin()
    session = SessionLocal(bind=connection)

    # Seed the database
    seed_db(session)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db: Session):
    """Provide a FastAPI test client with test database."""

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


PASSWORD = "FixCity2026!"
DEMO_PHONE = "01012345678"


def _bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def staff_headers(client: TestClient, email: str) -> dict:
    r = client.post("/auth/staff-login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return _bearer(r.json()["token"])


def citizen_session(client: TestClient, phone: str = DEMO_PHONE) -> dict:
    r = client.post("/auth/verify", json={"phone": phone, "code": "123456"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def admin_h(client):
    return staff_headers(client, "admin@fixthecity.demo")


@pytest.fixture
def roads_h(client):
    return staff_headers(client, "roads@fixthecity.demo")


@pytest.fixture
def citizen(client):
    """Demo citizen (01012345678 = profile citizen-001, owner of FTC-1042 / INC-501)."""
    session = citizen_session(client)
    return {"id": session["userId"], "headers": _bearer(session["token"])}


@pytest.fixture
def citizen_h(citizen):
    return citizen["headers"]


@pytest.fixture
def other_citizen_h(client):
    """A second citizen who owns nothing."""
    return _bearer(citizen_session(client, "01099998888")["token"])
