## What changed

Add a testable citizen API slice before the shared database is available: explicit demo OTP, expiring JWTs, report/incident/map/booking endpoints, repository boundaries, validation, and documented teammate hand-offs. Includes opt-in implementations for the still-proposed staff-login and signed-upload routes.

## Role and area

- [x] API & database (`backend/`): Moataz's citizen/auth slice
- [x] Docs / ownership

## How to test

1. Follow `backend/README.md` to install the backend development requirements.
2. From `backend/`, run `python -m pytest -q`, `python -m ruff check app tests`, `python -m ruff format --check app tests`, and `python -m mypy app --ignore-missing-imports`.
3. Run the local citizen harness with `OTP_MODE=demo`; in `/docs`, request an OTP and verify `01012345678` with `123456`. Expect an empty 204 and a camelCase session respectively. Exercise report, map, and booking routes too.
4. Verify an incorrect six-digit code returns 401. Restarting the harness intentionally clears users and invalidates previous tokens.

Progress: [2026-10-21 backend split and citizen auth](../docs/progress-log.md#2026-10-21--backend-split-and-citizen-auth).

Local validation: 35 tests pass; Ruff lint/format and mypy pass on Python 3.14. One upstream Starlette TestClient/httpx deprecation warning remains. Python 3.12 CI is configured but has not run remotely.

## Limitations / hand-off

- Local in-memory adapter only; teammate must provide the database adapter and application assembly.
- No real OTP delivery, durable data, production PostGIS priority/duplicate transactions, Supabase storage provider, refresh/revocation, or deployed application assembly. Never deploy the local demo harness.
- Citizen routes follow the published contract. Staff-login/upload routes are implemented but stay opt-in pending agreement on proposed contract shapes.
- Python 3.12 CI is added for this slice; include database checks when infrastructure lands.
- Teammate review, remote CI and latest remote main verification remain pending. No PR has been published by this change.
