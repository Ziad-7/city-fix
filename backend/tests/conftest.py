"""Pytest configuration and fixtures."""

import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth import AuthContext, AuthSettings
from app.auth_adapters import DatabaseStaffDirectory, DatabaseUserRepository
from app.config import settings
from app.db import get_db
from app.main import app
from app.models import Base
from app.seed import seed_db
from app.staff_auth import StaffLoginContext


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
def client(db: Session, monkeypatch):
    """Provide a FastAPI test client with test database.

    The shared auth boundary reloads role + department from the database on every request, so its
    repositories are rebound to the test database too. The destructive demo reset is enabled here
    (it is off by default); ``test_demo_reset_disabled_by_default`` turns it off again.
    """
    session_factory = sessionmaker(bind=db.get_bind())

    def override_get_db():
        yield db

    monkeypatch.setattr(settings, "demo_reset_enabled", True)
    previous = (app.state.auth_context, app.state.staff_login_context, app.state.media_storage)
    app.state.auth_context = AuthContext(
        AuthSettings(jwt_secret=settings.jwt_secret, demo_otp=True),
        DatabaseUserRepository(session_factory),
    )
    app.state.staff_login_context = StaffLoginContext(DatabaseStaffDirectory(session_factory))
    app.state.media_storage = None
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.state.auth_context, app.state.staff_login_context, app.state.media_storage = previous


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
    return staff_headers(client, "admin@cityfix.demo")


@pytest.fixture
def roads_h(client):
    return staff_headers(client, "roads@cityfix.demo")


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
