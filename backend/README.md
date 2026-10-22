# CityFix backend

FastAPI + SQLAlchemy 2 (SQLite by default) serving the citizen mobile app, the citizen web and the admin Command Center. Shapes and endpoints: [`docs/api-contract.md`](../docs/api-contract.md).

## Run

```bash
cd backend
uv sync                                              # Python >= 3.12
uv run uvicorn app.main:app --reload --port 8000     # seeds demo data when the DB is empty
```

Health check: `GET http://localhost:8000/health`. Interactive docs: `/docs`.

Schema changes need no migration on SQLite: models + `create_all`. After changing `app/models.py` delete `fixthecity.db` (stop the server first) and it re-seeds on start, or run `uv run python scripts/reset_demo.py`. `POST /admin/demo/reset` (admin) re-seeds a running server.

## Test and lint

```bash
uv run pytest -q          # fresh temp SQLite DB per session, never touches fixthecity.db
uvx ruff check .          # CI also runs: ruff format --check .
```

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///./fixthecity.db` | SQLAlchemy URL |
| `JWT_SECRET` | dev value | HS256 secret (>= 32 bytes); set it outside dev |
| `OTP_MODE` | `demo` | `demo`: no SMS, the code is always `123456` |
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

## Layout

- `app/routers/` `auth`, `reports`, `incidents`, `map`, `service_requests`, `triage`, `uploads` (citizen) and `admin` (staff/admin; `PATCH /incidents/{id}` lives there too).
- `app/logic/` pure/domain code: `priority`, `duplicates` (haversine, 250 m), `triage` (keyword port of the mobile classifier), `status` (the one status-change function per entity, writes `activity_log`), `overdue`, `dashboard`, `budget` (exact knapsack), `insights`, `serialize` (DB to contract JSON, bulk-loaded), `domain` (report/work-order creation shared by routers).
- `app/seed.py` demo data; `tests/` pytest suite.

## Notes

- Errors are `{ "detail": "<short Egyptian Arabic>" }`; invalid bodies are `422 {"detail": "البيانات مش مكتملة"}`.
- Timestamps are stored naive UTC and sent as `...Z`.
- No PostGIS locally: duplicates use haversine in Python.
- `/uploads/sign` is a local stub: it returns a URL on this server that accepts a `PUT` and discards the body.
