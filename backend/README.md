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
- Replace the local SQLite demo setup with agreed migrations and production PostgreSQL/PostGIS, provision private Supabase media storage, and connect a real OTP provider.
- Replace demo readable-ID allocation with a transactional database sequence before concurrent or multi-worker deployment.
- Add deployment configuration, production CORS/secrets, and connect the mobile, citizen web, and admin clients to a deployed API.
- Validate the voice-transcription provider and photo face/plate blur on representative Egyptian recordings and images before enabling those AI paths in production.

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

## CityBrain photo and Arabic text triage

`POST /triage` is mounted in the main FastAPI app and uses the existing bearer-token `current_user` dependency. Gemini structured suggestions use `GEMINI_API_KEY` and `GEMINI_MODEL`; absent credentials, timeouts, quota errors, and invalid responses fall back to the deterministic Arabic/English classifier. Nearby open incidents are queried from the existing SQLAlchemy models, with the caller's reports separated into `alreadyReported` and followed incidents excluded from duplicate suggestions.

Photo inference is disabled unless `GEMINI_PHOTO_ANALYSIS_ENABLED=true`. Create a **private** Supabase Storage bucket, then configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_MEDIA_BUCKET` (default `report-media`) to enable `/uploads/sign`. The adapter refuses public buckets, scopes random object paths to the authenticated user, verifies uploaded MIME type and size, and issues 15-minute read URLs. The `/triage` request must include `photoConsent: true` to read a photo for AI analysis. Before a photo reaches Gemini, the backend strips metadata, caps dimensions, and blurs regions detected by OpenCV's bundled frontal-face and Russian-plate Haar cascades. These detectors can miss faces or Egyptian plates; keep photo inference disabled until they are validated on representative images and the client shows informed consent. Gemini's free tier may use submitted content to improve Google products.

The route uses the existing `/triage` response contract with an optional `photoConsent` request field. A device-local URI or browser data URL is not accepted by the API; clients must upload first and send the returned storage path.

`POST /ai/transcribe` is mounted in the main app. It reads an uploaded voice note only from the authenticated caller's private storage path, then uses the configured Gemini model to return a short Egyptian Arabic transcription. The app discloses the provider and free-tier data-use policy before recording in API mode. If Gemini or storage is unavailable, the client leaves the description editable so the citizen can type it. Verify availability and transcription quality on representative Egyptian Arabic clips before production rollout.
