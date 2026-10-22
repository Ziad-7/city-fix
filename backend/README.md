# FixTheCity Backend

FastAPI backend for the citizen mobile app, citizen web, and admin Command Center. The assembled app currently supports local demo authentication, admin operations, and map pins. Citizen report/follow/booking persistence and production infrastructure remain unfinished; see [Remaining integration work](#remaining-integration-work).

## Stack

- **Python 3.12** with `uv`
- **FastAPI** + **Uvicorn** for the API
- **SQLAlchemy 2.0** with SQLite for the local demo; production PostgreSQL integration is pending
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
uv sync --extra dev
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

### Planned PostgreSQL integration

`DATABASE_URL` accepts a SQLAlchemy URL, but a production PostgreSQL setup still needs its driver, migrations, constraints and deployment validation. Changing this URL alone does not complete that integration:

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

## API status

### Health
- `GET /health` → `{"status": "ok", "version": "0.1.0"}`

### Authentication
- `POST /auth/otp` and `POST /auth/verify` → Demo citizen login
- `POST /auth/staff-login` and `GET /auth/me` → Staff/admin login backed by seeded accounts
- `/admin/*` and `PATCH /incidents/{id}` → Demo admin operations, work orders, and budget APIs
- `GET /map/incidents` → Authenticated map pins backed by the seeded database
- Report, incident, map-filter, and service-request route modules are also available through the local citizen harness below.

## Architecture

### `app/`
- **`main.py`** – FastAPI app, CORS, router registration
- **`config.py`** – Environment settings
- **`db.py`** – SQLAlchemy engine, session, init/reset
- **`models.py`** – SQLAlchemy ORM models
- **`admin_schemas.py`** – Admin Pydantic schemas (camelCase)
- **`schemas/`** – Shared auth, citizen, and upload schemas
- **`auth.py`** – Shared JWT validation and role dependencies
- **`auth_adapters.py`** – SQLAlchemy user and staff-directory adapters
- **`seed.py`** – Demo data seeding

### `app/logic/`
- **`priority.py`** – Deterministic priority formula (ported from mobile)
- **`duplicates.py`** – Haversine distance for 250m check
- **`ids.py`** – Readable ID formatting
- **`timeline.py`** – Timeline entry generation
- **`status.py`** – Status change functions with activity logging

### `app/routers/`
- **`auth.py`** – Citizen OTP login
- **`staff_auth.py`** – Staff login and current session
- **`admin.py`** – Command Center routes
- **`reports.py`, `incidents.py`, `service_requests.py`, `map.py`** – Citizen route slice

### `tests/`
- **`conftest.py`** – Pytest fixtures (temp DB, client)
- **`test_priority.py`** – Priority calculation (ported test cases)
- **`test_duplicates.py`** – Haversine distance tests
- **`test_auth.py`** – Auth endpoints
- **`test_seed.py`** – Seed data invariants

## Key Design Decisions

1. **SQLite demo database**: Development-friendly, no extra setup. Production PostgreSQL setup and migrations are still pending.
2. **Float lat/lng**: Simpler than PostGIS for now. Haversine in Python for duplicate detection.
3. **Activity log for timeline**: Every status change writes a row; timelines built from logs on read.
4. **Camel-case aliases**: Pydantic models have `alias_generator=to_camel`, responses use `by_alias=True`.
5. **Role-based access**: `current_user`, `require_staff`, `require_admin` dependencies.
6. **Seed on startup**: If DB is empty and `SEED_ON_START=true`, automatically runs seed.

## Testing Notes

- Tests use a fresh temporary SQLite database per test.
- Auth tests verify OTP flow, staff login, token validation.
- Priority tests port all cases from `apps/mobile/src/logic/__tests__/priority.test.ts`.
- Seed tests verify 10 mobile incidents present, department integrity, priority factors structure.

## Remaining integration work

- Connect the citizen report, follow, and service-request routers to transactional database repositories in `app.main`.
- Replace the local SQLite demo setup with agreed migrations and production PostgreSQL/PostGIS, plus real storage and OTP providers.
- Replace demo readable-ID allocation with a transactional database sequence before concurrent or multi-worker deployment.
- Add deployment configuration, production CORS/secrets, and connect the mobile, citizen web, and admin clients to a deployed API.
- Build and register the CityBrain triage, transcription, photo-blur, and budget-optimization services.

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

The example enables demo OTP and seed accounts and contains a placeholder signing key. These settings are for local development; production authentication, secrets and deployment still need integration.

Edit as needed:

- `DATABASE_URL` – Database connection string
- `JWT_SECRET` – Change in production
- `OTP_MODE` – `demo` enables the fixed local code; other values disable OTP because real delivery is not implemented
- `SEED_ON_START` – `true` to auto-seed empty DB
- `DEMO_RESET_ENABLED` – defaults to `false`; enable only for a local demo to allow the admin reset endpoint to delete and reseed all records

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

## Citizen route slice

The citizen authentication and report/service route layer is implemented behind repository interfaces. Run the process-local harness with `OTP_MODE=demo python -m uvicorn app.citizen_demo:create_app --factory --host 127.0.0.1`; it is intended for route testing while persistent citizen repositories and storage are integrated into `app.main`.

Install the combined development dependencies with `python -m pip install -r requirements-dev.txt`. The repository CI runs Ruff lint/format, mypy, and pytest from this directory.
