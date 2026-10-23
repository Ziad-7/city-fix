# CityFix backend

FastAPI + SQLAlchemy 2 (SQLite by default) serving the citizen mobile app, the citizen web and the admin Command Center. Shapes and endpoints: [`docs/api-contract.md`](../docs/api-contract.md).

## Run

```bash
cd backend
uv sync                                              # Python >= 3.12
LOCAL_SCHEMA_BOOTSTRAP=true SEED_ON_START=true uv run uvicorn app.main:app --reload --port 8000
```

Health check: `GET http://localhost:8000/health`. Interactive docs: `/docs`.

Schema changes use Alembic. Production startup never runs `create_all()` or seeds automatically. For a disposable local SQLite database, set `LOCAL_SCHEMA_BOOTSTRAP=true`; set `SEED_ON_START=true` only when you want the local demo fixture. The explicit reset tool and `/admin/demo/reset` remain destructive and are never migration steps.

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
| `OTP_MODE` | `demo` | `demo`: no SMS, the code is always `123456`; `twilio`: use Twilio Verify for SMS/WhatsApp and never fall back to demo |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | empty | Required server-only bindings for `OTP_MODE=twilio`; provider is not called if any is missing |
| `EXPO_TOKEN` | empty | Optional server-only Expo API access token; this is not a device token and does not prove delivery |
| `PUSH_ENABLED` | `false` | Explicitly enables the bounded `scripts.send_push` provider worker; keep false until an approved invocation is configured |
| `TOKEN_MINUTES` | `10080` | Session token lifetime (7 days) |
| `DEMO_RESET_ENABLED` | `false` | `POST /admin/demo/reset` deletes and re-seeds every record; it answers `404` unless this is `true`. Tests and the admin-web Playwright server set it. Enable only for a local demo |
| `LOCAL_SCHEMA_BOOTSTRAP` | `false` | Explicitly run SQLite `create_all()` for local setup; ignored for PostgreSQL |
| `SEED_ON_START` | `false` | Seed only a SQLite local database when explicitly enabled |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001` | Comma-separated allowed origins (Expo web `:8081` is always allowed) |
| `CORS_ORIGIN_REGEX` | `^http://(localhost\|127\.0\.0\.1)(:\d+)?$` | Also allow any localhost port; set to your deployed origins (e.g. the Vercel domains) in production |
| `VERSION` | `0.1.0` | Reported by `/health` |
| `ALLOW_LOCAL_UPLOAD_STUB` | unset | Local `/uploads/sign` stub that discards files. Unset = allowed on SQLite only; `503` on Postgres without `SUPABASE_*`. `true` forces it (demo), `false` forbids it |
| `GEMINI_API_KEY`, `GEMINI_PHOTO_ANALYSIS_ENABLED` | empty / `false` | Also gate `/ai/waste-classify` model results (needs `photoConsent: true` per request); otherwise the deterministic fallback answers |

## Deploy on Vercel (with Supabase Postgres)

The API runs as a Vercel FastAPI project with **Root Directory `backend`** (`app/main.py` is the entrypoint, `vercel.json` sets the function limits). The filesystem is read-only there, so SQLite does not work: use PostgreSQL.

Vercel installs from `uv.lock`, so every runtime dependency (for example `ortools`) must be in `[project].dependencies` in `pyproject.toml` (and `requirements.txt`), then run `uv lock`. `tests/test_packaging.py` checks this. After a deploy, call `POST /admin/recycling/routes/optimize` as admin with one requested pickup: a 503 "OR-Tools is unavailable" means the dependency is still missing.

1. Set `DATABASE_URL` to the Supabase **session pooler** string (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`). The `postgres://` and `postgresql://` prefixes are rewritten to `postgresql+psycopg://` automatically.
2. Set `JWT_SECRET` (random, 32+ bytes), `OTP_MODE=demo`, and set `DEMO_RESET_ENABLED=true` only for a disposable test deployment.
3. Set `CORS_ORIGINS` to the two frontend URLs (comma-separated).
4. Turn off Vercel Authentication for the API project, or browsers get a login page instead of JSON.
5. Run the reviewed migration command below before deployment. Runtime startup does not create tables or seed data.
6. In the frontends set `NEXT_PUBLIC_API_URL` to the API URL (and `NEXT_PUBLIC_API_MODE=api` for `apps/web`), then redeploy: these values are inlined at build time.

Limits on Vercel: no FFmpeg (voice-note validation and `/ai/transcribe` are unavailable; the UI falls back to typing), and photo upload is a stub unless the Supabase storage variables are set.

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
- `/uploads/sign` without Supabase Storage is a local stub that accepts a `PUT` and discards the body. It is only allowed on SQLite (or `ALLOW_LOCAL_UPLOAD_STUB=true`); otherwise it answers `503`.

## CityBrain photo and Arabic text triage

`POST /triage` is mounted in the main FastAPI app and uses the existing bearer-token `current_user` dependency. Gemini structured suggestions use `GEMINI_API_KEY` and `GEMINI_MODEL`; absent credentials, timeouts, quota errors, and invalid responses fall back to the deterministic Arabic/English classifier. Nearby open incidents are queried from the existing SQLAlchemy models, with the caller's reports separated into `alreadyReported` and followed incidents excluded from duplicate suggestions.

Photo inference is disabled unless `GEMINI_PHOTO_ANALYSIS_ENABLED=true`. Create a **private** Supabase Storage bucket, then configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_MEDIA_BUCKET` (default `report-media`) to enable `/uploads/sign`. The adapter refuses public buckets, scopes random object paths to the authenticated user, verifies uploaded MIME type and size, and issues 15-minute read URLs. The `/triage` request must include `photoConsent: true` to read a photo for AI analysis. Before a photo reaches Gemini, the backend strips metadata, caps dimensions, and blurs regions detected by OpenCV's bundled frontal-face and Russian-plate Haar cascades. The repository's tests do not validate detector recall on real Egyptian faces or plates; see [`ai_tests/PHOTO_PRIVACY_VALIDATION.md`](ai_tests/PHOTO_PRIVACY_VALIDATION.md) for the evidence gap and release gate. Keep photo inference disabled until that validation passes and the client shows informed consent. Gemini's free tier may use submitted content to improve Google products.

The route uses the existing `/triage` response contract with an optional `photoConsent` request field. A device-local URI or browser data URL is not accepted by the API; clients must upload first and send the returned storage path.

`POST /ai/transcribe` is mounted in the main app. It reads an uploaded voice note only from the authenticated caller's private storage path, then uses the configured Gemini model to return a short Egyptian Arabic transcription. The app discloses the provider and free-tier data-use policy before recording in API mode. If Gemini or storage is unavailable, the client leaves the description editable so the citizen can type it. Verify availability and transcription quality on representative Egyptian Arabic clips before production rollout.

Voice notes are limited to 5 MB and 30 seconds by the clients and enforced again by the API before calling Gemini. The server uses a bounded FFmpeg pass to check file validity, duration, and peak level; clips at or below -75 dBFS are rejected as effectively silent, while quieter speech above that threshold is allowed. Temporary inspection files are removed immediately. Deploy with the included Dockerfile (the Python-only native build does not include FFmpeg). For a Render web service, set the root directory to `backend`, use Docker as the runtime, and keep the service on the free instance if available. The container uses Render's `PORT` and one Uvicorn worker.

## Smart-bin telemetry and Command Center

- `POST /iot/bins/{binId}/readings` accepts up to 50 readings per request and authenticates the device with `X-Device-Key`. The simulator can retry safely: `(binId, seq)` is unique, identical repeats are acknowledged, and conflicting repeats return `409`. Optional `distanceCm`, `rssi`, `fw`, and nullable `at` follow the hardware simulator's wire shape.
- `POST /admin/bins` is admin-only. It provisions a bin and returns a one-time `deviceKey`; only its SHA-256 hash is stored. Keep the returned key private and deliver it to the device out of band.
- `GET /admin/bins` and `GET /admin/bins/{binId}/readings` require staff/admin auth. Department staff only see their department's bins plus unassigned bins. The authenticated Command Center shows status, current sensor values, alerts, and saved reading history at **الحاويات الذكية**.
- `GET /admin/bins/{binId}/latest` returns the latest recorded reading. Bins with no recent sample (twice their configured interval, with a five-minute minimum) are shown as offline.

Reading temperature and battery are nullable measurements; a missing temperature never triggers heat. The history response keeps `recordedAt` as its effective display time, the actual receive time in `receivedAt`, the original nullable device timestamp in `deviceAt`, and `clockUnsynced` to identify readings recorded without a device clock. Sequence retries compare the original nullable timestamp and every measurement exactly. Latest fleet state advances with a conditional database update, and the `(bin_id, seq)` unique key makes retries safe across workers.

The public Vercel demo at `/smart-bin-simulator.html` is a browser-only simulation: scenarios, sample fleet, charts, and injected faults are stored in that browser and do not reach this API. Use the local Python simulator in real mode to send data into an API deployment. Production schema changes run through reviewed Alembic migrations, never startup `create_all()`.

Do not infer old devices' original timestamps from `recorded_at`: migrated rows retain `device_at = NULL` and `clock_unsynced = NULL` to mean timestamp provenance is unknown. Their original timestamp cannot be compared, so same-sequence retries for those legacy rows return `409` rather than risk acknowledging a changed payload. New rows store `clock_unsynced` as `TRUE` or `FALSE`, and retries compare their exact original timestamp. Existing SQLite databases must be backed up and rebuilt/recreated with the updated schema; old demo data can instead be discarded with the documented reset. Production also needs a persistent PostgreSQL database, HTTPS, secret provisioning, and deployment validation. SQLite on an ephemeral serverless filesystem will lose data.

## CityCycle (recycling) and database migration

Routes: `app/routers/recycling.py` (citizen pickups, collectors, impact), `recycling_admin.py` (Command Center), public bins and `report-full` in `routers/bins.py`, `app/ai/waste.py`. Demo data (`app/seed_citycycle.py`): DEMO prices for `مدينة نصر أول`, open pickups `RCY-3001..3004`, a finished `RCY-3100` for the demo citizen, verified collector `COL-1` (login phone `01022223333`, OTP `123456`), pending `COL-2` (`01033334444`) and seven smart bins `BIN-011..HUB-001` (assigned to the sanitation department).

The legacy `migrations/001_citycycle.sql` is kept for historical review only; production upgrades use the checked Alembic revisions above and never execute that file blindly. Runtime startup does not migrate Postgres or seed it. Use the additive CityCycle seed command when synthetic rows are explicitly wanted.

### Reviewed PostgreSQL migration and additive seed

Use a direct or session PostgreSQL connection that can run DDL. `--check` is read-only, `--plan` emits Alembic SQL, and `--apply` verifies the expected project reference before upgrading. A populated database is stamped only when its tables, columns, types, nullability, keys, foreign keys and indexes match the frozen baseline. Drift and unversioned delivery tables are refused. Never pass the expected reference before confirming the CityFix project identity, and redact database URLs.

```bash
cd backend
python -m scripts.migrate --check --expected-project-ref REF
python -m scripts.migrate --plan --expected-project-ref REF
# Review the SQL and confirm the project before applying.
python -m scripts.migrate --apply --expected-project-ref REF
python -m scripts.seed_citycycle_additive --dry-run --expected-project-ref REF
python -m scripts.seed_citycycle_additive --apply --expected-project-ref REF
```

Revision `0001_existing_schema` is a frozen PostgreSQL snapshot and does not import mutable model metadata. Revision `0002_delivery_foundation` adds OTP state, notifications, push registrations and delivery rows, then enables RLS on CityFix-owned tables and `alembic_version`. The API must connect with a privileged backend database role that bypasses RLS. Do not grant direct `anon` or `authenticated` access to these tables. Real-project migration and seed execution remains blocked until the primary operator confirms the CityFix project and binding.

The additive seed is separate from `app.seed_citycycle.seed_citycycle()`. It inserts synthetic household profiles, a phone-free demo collector and bins marked `isSimulated=true`. ID or unique-key collisions skip the whole dependent group. Existing prices, phones, profiles and device hashes are never updated; dry-run reports synthetic IDs and counts without auth credentials or device keys.

### Notifications, Expo push and citizen OTP

`GET /notifications?limit=50&beforeId=...` and `PATCH /notifications/{id}` are scoped to the refreshed authenticated profile. `POST` and `DELETE /notifications/push-tokens` register or revoke a caller-owned Expo token; tokens are never returned. A status transition stages generic notification and push-delivery rows in its domain transaction. `python -m scripts.send_push --limit 100` dispatches a bounded batch only when `PUSH_ENABLED=true`; add `--receipts` to poll tickets. Expo ticket acceptance is `ticketed`; only an `ok` receipt becomes `delivered`. Receipt polling begins after 15 minutes; after three empty polls at 15-minute intervals a ticket becomes `unknown`. A send timeout or a worker crash after a send starts also becomes `unknown`, so the backend does not blindly resend an uncertain request. No scheduler is provisioned.

`OTP_MODE=demo` keeps the local `123456` flow and sends nothing. `OTP_MODE=twilio` requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`; incomplete bindings return `503`, with no demo fallback. Challenge generations use HMAC phone keys, have ten-minute expiry and rate limits, and can be consumed only once before a citizen session is issued. Provider errors do not reveal response bodies or credentials. No live provider calls were made in local verification.

CityCycle `RCY`, `COL` and `WGH` IDs use `readable_id_counters`: each prefix is lazily seeded above the existing numeric maximum, then reserved with an atomic database increment in the caller transaction. Rollback releases the reservation; commits keep it even if no entity was inserted. Existing deployments must pass the reviewed schema compatibility check and apply the frozen Alembic revisions before using these counters. Counter rows have RLS enabled with no public policies and require the privileged backend database role. Other ID prefixes retain their existing behavior.
