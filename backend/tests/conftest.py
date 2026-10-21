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
