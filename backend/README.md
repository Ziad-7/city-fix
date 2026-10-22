# Citizen backend slice

Branch: `feat/api-auth`. Ownership: [two-person split](../docs/team/backend-split.md).

## Implemented

- Citizen demo OTP endpoints and signed, expiring JWTs with current-user, role and department checks.
- Citizen report create/list/detail; incident list/detail/follow; map pin filters; service request create/list/detail.
- Contract-shaped Pydantic validation, private report/booking access, anonymous reporter masking for admins, and Sunday–Thursday future-day checks for bulky-waste bookings.
- A storage interface and proposed signed-upload route. Routes verify ownership of uploaded objects and issue short-lived read links through the adapter.
- Opt-in proposed staff login with Argon2 password verification, indistinguishable bad-credential errors, and a bounded per-process attempt limiter.
- Local in-memory harness and repository used to try the full citizen HTTP flow without waiting on Supabase.

## Run the local demo

From Git Bash on Windows:

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
python -m pip install -r requirements-dev.txt
OTP_MODE=demo python -m uvicorn app.citizen_demo:create_app --factory --host 127.0.0.1
```

Open http://127.0.0.1:8000/docs. Request a code for `01012345678` using `sms` or `whatsapp`, then verify with `123456`. No SMS or WhatsApp is sent. Create a report with a 10-character description or an uploaded image, then check `/incidents`, `/map/incidents`, and `/reports`. Book bulky waste for a future Sunday–Thursday date.

The demo resets users, records, and its random signing key on restart. It has no real media provider, so photo uploads return 503. Do not deploy this demo.

## Checks

From `backend/` with the virtual environment active:

```bash
python -m pytest -q
python -m ruff check app tests
python -m ruff format --check app tests
python -m mypy app --ignore-missing-imports
```

Python 3.12 is configured in CI. Local checks here ran on Python 3.14.

## Production integration hand-off

The route layer depends on `AuthContext` and `CitizenRepository` in `app/citizen.py`. The teammate supplies `UserRepository` and `CitizenRepository` adapters. Citizen repository writes must be transactional and implement the documented constraints: priority formula, 250 m PostGIS duplicate check, report linking, idempotent followers, timeline writes, readable IDs, sorted lists, filtering, and ownership. The in-memory adapter intentionally does not implement the production score, departments, duplicate discovery, or durable IDs.

Assemble the routers from `reports`, `incidents`, `map`, and `service_requests` in the teammate's app. Register `uploads.router` only after mobile, web and backend owners agree the still-proposed contract in `docs/api-contract.md`, then provide a `MediaStorage` implementation that creates random per-user private object paths, checks full upload ownership/size/type, and returns short-lived HTTPS upload and read links. A user cannot use an arbitrary local URI as a report image.

Staff login in `routers/staff_auth.py` is also proposed and opt-in. Agree its shape with the admin client owner before registration. Supply `staff_login_context` with the directory adapter and ensure each staff account maps to a current `User` whose role and department are loaded from the database. Its memory limiter is only a local single-worker guard; deployment needs shared rate limiting. Never put the service role key in a client.

The OTP harness only supports the shared demo code. Real authentication still needs expiring, single-use OTP storage, provider delivery and distributed rate limiting. Tokens expire after 60 minutes; refresh and revocation are not implemented.
