# FixTheCity Backend

FastAPI backend serving the citizen mobile app, citizen web, and admin Command Center.

## Stack

- **Python 3.12** with `uv`
- **FastAPI** + **Uvicorn** for the API
- **SQLAlchemy 2.0** with SQLite (default) or PostgreSQL
- **Pydantic v2** for schemas with camelCase aliases
- **PyJWT** for authentication
- **pytest** for testing

## Quick Start

### 1. Setup

```bash
# Install Python 3.12 (or use pyenv/asdf)
# Then:

uv venv --python 3.12
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uv sync
```

### 2. Run

```bash
# Create database and seed with demo data
uv run python -c "from app.db import reset_db; reset_db()"

# Start the server
uv run uvicorn app.main:app --reload --port 8000
```

The server will be available at `http://localhost:8000`. The health check is at `/health`.

### 3. Test

```bash
# Run all tests
uv run pytest

# Run with verbose output
uv run pytest -v

# Run a specific test file
uv run pytest tests/test_priority.py

# Run with coverage
uv run pytest --cov=app tests/
```

## Database

### Default (SQLite)

Creates `./fixthecity.db`. Good for development.

```bash
DATABASE_URL=sqlite:///./fixthecity.db
```

### PostgreSQL

For production:

```bash
DATABASE_URL=postgresql://user:password@localhost/fixthecity
```

### Reset Database

```bash
uv run python -c "from app.db import reset_db; reset_db()"
```

This drops all tables, recreates them, and re-seeds with demo data.

## Demo Accounts

### Citizen (via OTP)
- **Phone:** `01012345678`
- **OTP Code:** `123456` (in demo mode)

### Admin
- **Email:** `admin@fixthecity.demo`
- **Password:** `FixCity2026!`
- **Role:** Admin (can see everything, manage budget)

### Staff (Roads Department)
- **Email:** `roads@fixthecity.demo`
- **Password:** `FixCity2026!`
- **Role:** Staff (can see only Roads department incidents)

## API Endpoints (Task 1 Implementation)

### Health
- `GET /health` → `{"status": "ok", "version": "0.1.0"}`

### Authentication
- `POST /auth/otp` → Request OTP code
- `POST /auth/verify` → Verify code, get token
- `POST /auth/staff-login` → Staff login with email/password
- `GET /auth/me` → Get current user info

## Architecture

### `app/`
- **`main.py`** – FastAPI app, CORS, router registration
- **`config.py`** – Environment settings
- **`db.py`** – SQLAlchemy engine, session, init/reset
- **`models.py`** – SQLAlchemy ORM models
- **`schemas.py`** – Pydantic schemas (camelCase)
- **`auth.py`** – JWT, password hashing, dependencies
- **`seed.py`** – Demo data seeding

### `app/logic/`
- **`priority.py`** – Deterministic priority formula (ported from mobile)
- **`duplicates.py`** – Haversine distance for 250m check
- **`ids.py`** – Readable ID formatting
- **`timeline.py`** – Timeline entry generation
- **`status.py`** – Status change functions with activity logging

### `app/routers/`
- **`auth.py`** – OTP, staff login, current user

### `tests/`
- **`conftest.py`** – Pytest fixtures (temp DB, client)
- **`test_priority.py`** – Priority calculation (ported test cases)
- **`test_duplicates.py`** – Haversine distance tests
- **`test_auth.py`** – Auth endpoints
- **`test_seed.py`** – Seed data invariants

## Key Design Decisions

1. **SQLite by default**: Development-friendly, no extra setup. Postgres supported via `DATABASE_URL`.
2. **Float lat/lng**: Simpler than PostGIS for now. Haversine in Python for duplicate detection.
3. **Activity log for timeline**: Every status change writes a row; timelines built from logs on read.
4. **Camel-case aliases**: Pydantic models have `alias_generator=to_camel`, responses use `by_alias=True`.
5. **Role-based access**: `current_user`, `require_staff`, `require_admin` dependencies.
6. **Seed on startup**: If DB is empty and `SEED_ON_START=true`, automatically runs seed.

## Testing Notes

- Tests use a fresh temporary SQLite database per session.
- Auth tests verify OTP flow, staff login, token validation.
- Priority tests port all cases from `apps/mobile/src/logic/__tests__/priority.test.ts`.
- Seed tests verify 10 mobile incidents present, department integrity, priority factors structure.

## Next Steps (Tasks 2–3)

- **Task 2:** Citizen routes (`/reports`, `/incidents`, `/map/incidents`, `/service-requests`, `/triage`, `/uploads`)
- **Task 3:** Admin routes (`/admin/dashboard`, `/admin/incidents`, `/admin/work-orders`, `/admin/budget/optimize`, etc.)

Each task adds routers that reuse the logic and models from Task 1.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit as needed:

- `DATABASE_URL` – Database connection string
- `JWT_SECRET` – Change in production
- `OTP_MODE` – `demo` or `real`
- `SEED_ON_START` – `true` to auto-seed empty DB

## Troubleshooting

### Import errors
```bash
# Make sure you're in the venv and dependencies are installed
source .venv/bin/activate
uv sync
```

### Database locked
```bash
# Remove the SQLite file and restart (it will be re-seeded)
rm fixthecity.db
```

### Tests fail
```bash
# Clear pytest cache
rm -rf .pytest_cache __pycache__
uv run pytest
```
