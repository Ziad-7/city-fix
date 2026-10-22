"""Pytest configuration and fixtures."""

import os
import tempfile
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.models import Base
from app.db import get_db
from app.main import app
from app.seed import seed_db
from app.auth import AuthContext, AuthSettings
from app.auth_adapters import DatabaseStaffDirectory, DatabaseUserRepository
from app.config import settings
from app.map_repository import DatabaseMapRepository
from app.staff_auth import StaffLoginContext


@pytest.fixture
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
    Base.metadata.drop_all(bind=db_engine)
    Base.metadata.create_all(bind=db_engine)
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestSessionLocal()

    # Seed the database
    seed_db(session)
    session.commit()

    yield session

    session.close()


@pytest.fixture
def client(db: Session):
    """Provide a FastAPI test client with test database."""
    session_factory = sessionmaker(bind=db.get_bind())

    def override_get_db():
        yield db

    previous_auth_context = app.state.auth_context
    previous_staff_context = app.state.staff_login_context
    previous_citizen_repository = app.state.citizen_repository
    app.state.auth_context = AuthContext(
        AuthSettings(jwt_secret=settings.jwt_secret, demo_otp=True),
        DatabaseUserRepository(session_factory),
    )
    app.state.staff_login_context = StaffLoginContext(
        DatabaseStaffDirectory(session_factory)
    )
    app.state.citizen_repository = DatabaseMapRepository(session_factory)
    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.state.auth_context = previous_auth_context
        app.state.staff_login_context = previous_staff_context
        app.state.citizen_repository = previous_citizen_repository
