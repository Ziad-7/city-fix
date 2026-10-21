# Role brief — Backend & Database

**Owner:** _[member name]_ · **Branch:** `feat/backend-workflows` · **Folder:** `backend/` · **Plan stage:** 3 (Days 3–4), starting **now** in parallel with the mobile app.

## Your mission

Build the FastAPI backend and the Supabase database that the citizen mobile app and the admin web app run on. The mobile app already works on mock data behind the exact API in [`docs/api-contract.md`](../api-contract.md). When your endpoints are live, the app switches over with one setting — so the contract is your spec.

**Done means:** a citizen report sent from the phone is stored, gets a priority, shows up on `/incidents` and `/map/incidents`, and status changes made by an admin appear in the citizen's timeline — on a deployed URL, with tests.

You don't depend on anyone to start. You don't touch `apps/mobile`.

## Stack (from the plan)

| Area | Choice |
| --- | --- |
| API | Python 3.12 + FastAPI + Pydantic v2 + Uvicorn |
| Database | Supabase PostgreSQL with **PostGIS** |
| Migrations | Supabase CLI migrations (`supabase/migrations/*.sql`) — or Alembic if you prefer, but pick one |
| DB access | `psycopg` (v3) or SQLAlchemy 2.0 — keep it simple |
| Auth | Phone + one-time code issued by the API (demo code `123456`), JWT signed by the API. Supabase Auth phone login is a stretch goal (it needs an SMS provider). |
| Files | Supabase Storage, private bucket `report-media`, signed URLs |
| Tests | `pytest` + `httpx` TestClient, against a local Supabase (`supabase start`) or a test schema |
| Deploy | Docker image on Railway or Render; `/health` endpoint |

## Folder layout

```
backend/
  app/
    main.py              FastAPI app, CORS, routers, /health
    config.py            settings from env (pydantic-settings)
    db.py                connection pool / session
    auth.py              OTP + JWT, current_user dependency, role checks
    schemas/             Pydantic models (camelCase aliases) mirroring docs/api-contract.md
    routers/             auth.py, reports.py, incidents.py, map.py, service_requests.py, triage.py, uploads.py, admin.py
    logic/               priority.py, duplicates.py, triage_keywords.py, ids.py, timeline.py
  supabase/migrations/   0001_init.sql, 0002_rls.sql, 0003_seed.sql …
  tests/
  Dockerfile
  pyproject.toml (or requirements.txt)
  .env.example
  README.md
```

## Database schema (starting point)

Enable `postgis`. Use enums for statuses so bad values can't get in.

| Table | Key columns |
| --- | --- |
| `profiles` | `id uuid pk`, `phone text unique` (`+201…`), `name`, `role` (`citizen` \| `staff` \| `admin`), `governorate`, `district`, `prefs jsonb` (`whatsappUpdates`, `dataSaver`), `created_at` |
| `departments` | `id text pk`, `name_ar`, `external_hotline`, `district` (jurisdiction) |
| `categories` | `id text pk` (the 12 `CategoryId`s), `label_ar`, `danger bool`, `default_severity`, `department_id → departments`, `target_days int`, `estimated_cost_egp int` — seed from `apps/mobile/src/domain/categories.ts` |
| `incidents` | `id text pk` (`INC-0001`), `category_id`, `title`, `severity`, `status`, `department_id`, `estimated_cost_egp`, `location geography(Point,4326)`, `address`, `landmark`, `sensitive_place`, `area_underserved bool`, `priority_score int`, `priority_factors jsonb`, `followers_count int`, `eta`, `created_at`, `updated_at` · index: GIST on `location`, btree on `(status, category_id)` |
| `reports` | `id text pk` (`FTC-1042`), `reporter_id → profiles`, `incident_id → incidents`, `category_id`, `description`, `photo_paths text[]`, `voice_note_path`, `location geography`, `address`, `landmark`, `anonymous bool`, `blur_faces bool`, `severity_suggested`, `created_at` |
| `incident_followers` | `incident_id`, `user_id`, `created_at` · pk (`incident_id`, `user_id`) |
| `service_requests` | `id text pk` (`SRV-2001`), `citizen_id`, `service_type`, `details jsonb`, `location geography`, `address`, `landmark`, `status`, `created_at` |
| `work_orders` | `id text pk` (`WO-318`), `incident_id?`, `service_request_id?`, `department_id`, `assignee`, `status`, `created_at`, `updated_at` |
| `activity_log` | `id bigserial`, `entity_type` (`incident` \| `service_request` \| `work_order`), `entity_id`, `status`, `note` (shown to citizens), `actor`, `at` |
| `otp_codes` | `phone`, `code_hash`, `expires_at`, `attempts` (only for real OTP; demo mode skips it) |

Readable IDs: use a Postgres sequence per table and format in the API (`FTC-` + number).

**Row-level security** (if the app ever talks to Supabase directly): citizens read/write only their own `reports` and `service_requests`; everyone authenticated reads `incidents` (public columns); only `staff`/`admin` update incidents and work orders. The API itself connects with the service role and enforces the same rules in code.

**Seed data** (`0003_seed.sql`): departments, the 12 categories, 10 incidents around Nasr City (lat ≈ 30.056, lng ≈ 31.330) with varied statuses and timelines, one demo citizen (`01012345678`) with report `FTC-1042` (pothole near a school, in progress, 7 reporters) and service request `SRV-2001` (bulky waste, assigned), one admin account. Mirror `apps/mobile/src/services/mock/seed.ts` so the demo looks the same in mock and real mode.

## Work plan

| # | Task | Output |
| --- | --- | --- |
| 1 | Supabase project (or `supabase start` locally), PostGIS on, `backend/` skeleton, `/health`, Dockerfile, `.env.example` | Runs locally |
| 2 | Migrations: enums, tables, indexes, seed | `supabase db reset` gives a ready demo DB |
| 3 | Auth: `POST /auth/otp`, `POST /auth/verify` (demo code), JWT, `current_user`, `require_role("admin")` | Token works on protected routes |
| 4 | Reports + incidents: `POST/GET /reports`, `GET /reports/{id}`, `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/follow`, `GET /map/incidents` | Core citizen flow |
| 5 | Logic: priority (same formula as `apps/mobile/src/logic/priority.ts`), duplicates (`ST_DWithin` 250 m, same category, open), timeline from `activity_log`, readable IDs | Unit-tested |
| 6 | Service requests: `POST/GET /service-requests`, `GET /service-requests/{id}` | CityServe works |
| 7 | Uploads: `POST /uploads/sign` → Supabase Storage signed upload URL; signed read URLs in responses | Photos stored |
| 8 | Triage stub: `POST /triage` with the keyword classifier (port `apps/mobile/src/logic/triage-mock.ts`) + DB duplicates — the CityBrain owner replaces the classifier later | AI-ready endpoint |
| 9 | Admin: `GET /admin/dashboard`, `PATCH /incidents/{id}` (writes a timeline note), `POST/PATCH /admin/work-orders` | Admin web can start wiring |
| 10 | Tests + CI (`.github/workflows/backend-ci.yml`: ruff, pytest) + deploy + CORS for the admin web and citizen web origins (`localhost:3000`, Vercel domains) | Deployed URL in the README |

## How to check your work against the app

1. Run the API locally and expose it (e.g. `cloudflared tunnel` or the deployed URL).
2. In `apps/mobile`, create `.env` with `EXPO_PUBLIC_API_MODE=api` and `EXPO_PUBLIC_API_URL=<your url>`, then `npx expo start`.
3. Sign in with `01012345678` / `123456`, send a report, and check it appears in طلباتي and on the map; change its status with `PATCH /incidents/{id}` and watch the timeline update.

## Rules

- `docs/api-contract.md` is the contract. If you need a change (e.g. the upload flow), open a PR editing that file and tell the mobile owner — don't change shapes silently.
- Secrets live in env vars only (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `OTP_MODE`). Never commit `.env`. The service-role key never goes to the mobile app, the citizen website or the admin web app.
- Every status change goes through one function that also writes `activity_log` — that's what keeps citizen and admin views consistent.
- Small PRs into `main` with "how to test" steps; add an entry to `docs/progress-log.md` when a step lands.

## Hand-offs

- **To the CityBrain (AI) owner:** `POST /triage` with a stable request/response and the duplicates query; they swap in the model behind it.
- **To the optimizer owner:** `incidents` with `estimated_cost_egp` and `priority_score`; they add `POST /admin/budget/optimize`.
- **To the admin web owner:** the admin endpoints, an admin demo account, and the deployed URL.
- **To the citizen web owner:** CORS for their origins, `/uploads/sign` working from the browser, the same demo account, and the deployed URL. Same endpoints and shapes as mobile; no web-only routes.
- **To mobile:** the deployed URL and confirmation that every endpoint in the contract answers with the documented shape.
