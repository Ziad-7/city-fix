# CityFix backend

FastAPI + SQLAlchemy 2 (SQLite by default) serving the citizen mobile app, the citizen web and the admin Command Center. Shapes and endpoints: [`docs/api-contract.md`](../docs/api-contract.md).

## Run

```bash
cd backend
uv sync                                              # Python >= 3.12
uv run uvicorn app.main:app --reload --port 8000     # seeds demo data when the DB is empty
```

Health check: `GET http://localhost:8000/health`. Interactive docs: `/docs`.

Schema changes need no migration on SQLite: models + `create_all`. After changing `app/models.py` delete `fixthecity.db` (stop the server first) and it re-seeds on start, or run `uv run python scripts/reset_demo.py`. `POST /admin/demo/reset` (admin, needs `DEMO_RESET_ENABLED=true`) re-seeds a running server.

## Test and lint

```bash
uv run pytest -q          # fresh temp SQLite DB per session, never touches fixthecity.db
uvx ruff check .          # CI also runs: ruff format --check .
```

CI (`.github/workflows/backend-ci.yml`) runs ruff check, ruff format --check, a scoped mypy over the auth boundary and `python -m pytest`:

```bash
uv run --extra dev mypy app/auth.py app/auth_adapters.py app/admin_auth.py app/media.py   app/staff_auth.py app/routers/auth.py app/routers/staff_auth.py --ignore-missing-imports --follow-imports=skip
```

### pip instead of uv

`requirements.txt` (runtime) and `requirements-dev.txt` (adds pytest, httpx, ruff, mypy) mirror `pyproject.toml`; keep the three in sync when adding a dependency.

```bash
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./fixthecity.db` | SQLAlchemy URL |
| `JWT_SECRET` | dev value | HS256 secret (>= 32 bytes). **Required** when `OTP_MODE` is not `demo`: the app refuses to start with the built-in dev value |
| `OTP_MODE` | `demo` | `demo`: no SMS, the code is always `123456`. Any other value has no OTP store yet, so `POST /auth/otp` and `/auth/verify` answer `503` (the demo code is never accepted outside demo mode) |
| `TOKEN_MINUTES` | `10080` | Session token lifetime (7 days) |
| `DEMO_RESET_ENABLED` | `false` | `POST /admin/demo/reset` deletes and re-seeds every record; it answers `404` unless this is `true`. Tests and the admin-web Playwright server set it. Enable only for a local demo |
| `SEED_ON_START` | `true` | Seed demo data on startup when the DB has no incidents |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Comma-separated allowed origins (Expo web `:8081` is always allowed) |
| `CORS_ORIGIN_REGEX` | `^http://(localhost\|127\.0\.0\.1)(:\d+)?$` | Also allow any localhost port; set to your deployed origins (e.g. the Vercel domains) in production |
| `VERSION` | `0.1.0` | Reported by `/health` |

## Demo accounts

| Who | Login | Notes |
| --- | --- | --- |
| Admin | `admin@cityfix.demo` / `FixCity2026!` | `POST /auth/staff-login`; سارة محمود, sees everything, budget, demo reset |
| Staff (roads) | `roads@cityfix.demo` / `FixCity2026!` | `م. هشام عادل`; only `صيانة الطرق` data. Also `sanitation@`, `lighting@`, `sewage@`, `water@`, `electricity@`, `parks@`, `utilities@`, `veterinary@cityfix.demo` (same password) |
| Citizen | phone `01012345678`, OTP `123456` | `POST /auth/otp` (204) then `POST /auth/verify`; owns `FTC-1042` on `INC-501` and `SRV-2001` |

## Authentication boundary

One boundary (`app/auth.py`) serves every router. Tokens carry only the user id (`sub`, `iat`, `exp`, `iss`, `aud`); `current_user` reloads the **current role and department scope from the database on every request** through `app.state.auth_context` (`DatabaseUserRepository`), so a deactivated, demoted or re-assigned staff member loses (or changes) access immediately. Staff without a department scope are denied (`403`). `require_role` / `require_department` are available for new routes; the handlers use the dict claims from `app/admin_auth.py` (`require_staff`, `require_admin`, `current_claims`), also sourced from the database. Staff login (`app/staff_auth.py`, `routers/staff_auth.py`) verifies Argon2 or the seeded PBKDF2 hashes, always hashes (also for unknown e-mails) and limits attempts per e-mail (5 per minute, then `429`).

Private media is optional: set `app.state.media_storage` to an object with `sign_upload`, `require_uploaded` and `sign_read` (see `app/media.py`). Then `POST /uploads/sign` returns its signed URL, report photo/voice paths must have been uploaded by the caller (`403` otherwise) and reads are signed. Without one, the local upload stub below is used.

## Layout

- `app/routers/` `auth` (citizen OTP), `staff_auth` (staff login, `/auth/me`), `reports`, `incidents`, `map`, `service_requests`, `uploads` (citizen) and `admin` (staff/admin; `PATCH /incidents/{id}` lives there too).
- `app/ai/` CityBrain: `POST /triage` (Gemini with keyword fallback; duplicates / `alreadyReported` come from the database via `ai/integrations.py`) and `POST /ai/transcribe`; its tests live in `ai_tests/`.
- `app/logic/` pure/domain code: `priority`, `duplicates` (haversine, 250 m), `triage` (keyword port of the mobile classifier), `status` (the one status-change function per entity, writes `activity_log`), `overdue`, `dashboard`, `budget` (knapsack, exact over 100 EGP units; costs rounded up), `insights`, `serialize` (DB to contract JSON, bulk-loaded), `domain` (report/work-order creation shared by routers).
- `app/seed.py` demo data; `tests/` pytest suite.

## Notes

- Errors are `{ "detail": "<short Egyptian Arabic>" }`; invalid bodies are `422 {"detail": "البيانات مش مكتملة"}`.
- Timestamps are stored naive UTC and sent as `...Z`.
- No PostGIS locally: duplicates use haversine in Python.
- `/uploads/sign` is a local stub: it returns a URL on this server that accepts a `PUT` and discards the body.

## CityBrain photo and Arabic text triage

`POST /triage` is mounted in the main FastAPI app and uses the existing bearer-token `current_user` dependency. Gemini structured suggestions use `GEMINI_API_KEY` and `GEMINI_MODEL`; absent credentials, timeouts, quota errors, and invalid responses fall back to the deterministic Arabic/English classifier. Nearby open incidents are queried from the existing SQLAlchemy models, with the caller's reports separated into `alreadyReported` and followed incidents excluded from duplicate suggestions.

Photo inference is disabled unless `GEMINI_PHOTO_ANALYSIS_ENABLED=true`. Create a **private** Supabase Storage bucket, then configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_MEDIA_BUCKET` (default `report-media`) to enable `/uploads/sign`. The adapter refuses public buckets, scopes random object paths to the authenticated user, verifies uploaded MIME type and size, and issues 15-minute read URLs. The `/triage` request must include `photoConsent: true` to read a photo for AI analysis. Before a photo reaches Gemini, the backend strips metadata, caps dimensions, and blurs regions detected by OpenCV's bundled frontal-face and Russian-plate Haar cascades. The repository's tests do not validate detector recall on real Egyptian faces or plates; see [`ai_tests/PHOTO_PRIVACY_VALIDATION.md`](ai_tests/PHOTO_PRIVACY_VALIDATION.md) for the evidence gap and release gate. Keep photo inference disabled until that validation passes and the client shows informed consent. Gemini's free tier may use submitted content to improve Google products.

The route uses the existing `/triage` response contract with an optional `photoConsent` request field. A device-local URI or browser data URL is not accepted by the API; clients must upload first and send the returned storage path.

`POST /ai/transcribe` is mounted in the main app. It reads an uploaded voice note only from the authenticated caller's private storage path, then uses the configured Gemini model to return a short Egyptian Arabic transcription. The app discloses the provider and free-tier data-use policy before recording in API mode. If Gemini or storage is unavailable, the client leaves the description editable so the citizen can type it. Verify availability and transcription quality on representative Egyptian Arabic clips before production rollout.

Voice notes are limited to 5 MB and 30 seconds by the clients and enforced again by the API before calling Gemini. The server uses a bounded FFmpeg pass to check file validity, duration, and peak level; clips at or below -75 dBFS are rejected as effectively silent, while quieter speech above that threshold is allowed. Temporary inspection files are removed immediately. Deploy with the included Dockerfile (the Python-only native build does not include FFmpeg). For a Render web service, set the root directory to `backend`, use Docker as the runtime, and keep the service on the free instance if available. The container uses Render's `PORT` and one Uvicorn worker.
