"""Database connection and session management."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.models import Base

# SQLAlchemy engine. SQLite is the local default; PostgreSQL (Supabase session pooler on Vercel) gets a
# small pool that survives idle connections being dropped between serverless invocations.
if "sqlite" in settings.database_url:
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False}, echo=False)
else:
    engine = create_engine(
        settings.database_url,
        pool_size=2,
        max_overflow=3,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables for explicit disposable SQLite setup only."""
    if engine.dialect.name != "sqlite":
        raise RuntimeError("Production schemas must be changed through reviewed Alembic migrations")
    Base.metadata.create_all(bind=engine)


def reset_session(db: Session) -> None:
    """Delete every row on this session's database and re-seed it (demo reset)."""
    from app.seed import seed_db

    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    seed_db(db)
    if settings.seed_scale == "large" and db.get_bind().dialect.name == "sqlite":
        from app.seed_large import seed_large_local

        seed_large_local(db)


def reset_db():
    """Drop and recreate all tables, then seed (CLI / scripts)."""
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    try:
        reset_session(db)
    finally:
        db.close()
