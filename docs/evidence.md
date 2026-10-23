# Claims vs evidence

What CityCycle claims, how sure we are, and how anyone can check it. Status values: **Verified in tests** (an automated test in this repo asserts it), **Simulated** (works only against a simulator or prototype), **To verify** (not measured or not done; the last column says how). Snapshot: 2026-10-23.

## Claims

| Claim | Status | Evidence | How to reproduce |
| --- | --- | --- | --- |
| A household requests a pickup and gets an estimate from the district price list; materials without a price get no estimate | Verified in tests | `backend/tests/test_citycycle.py::test_create_pickup_estimates_from_price_list`, `::test_create_pickup_without_any_price_has_no_estimate` | Backend test command below |
| A verified collector accepts a job; the first accept wins and a second gets `409` | Verified in tests | `backend/tests/test_citycycle.py::test_first_accept_wins_and_weighing_rules` | Backend test command below |
| Weighings are idempotent and keep the price in force | Verified in tests | `backend/tests/test_citycycle.py::test_full_flow`, `::test_first_accept_wins_and_weighing_rules` (weight limits); idempotent retry by client id in `backend/app/routers/recycling.py` | Backend test command below; read the `add_weighing` handler |
| Impact numbers for the seed data: 13.5 kg diverted, 51.5 EGP value of weighed material, 48 EGP recorded as paid to households, 1 job, 5 pickups, 0.0135 tonnes | Verified in tests (demo seed values, not field data) | `backend/tests/test_citycycle.py::test_impact_and_earnings`, `::test_admin_summary_pickups_payouts` | Backend test command below |
| Staff see a district, not a household: department staff get redacted pickups | Verified in tests | `backend/tests/test_citycycle.py::test_admin_pickup_patch_is_admin_only_and_staff_views_are_redacted` | Backend test command below |
| Collectors cannot locate the exact home from the jobs list | Verified in tests | `backend/tests/test_citycycle.py::test_job_distance_cannot_locate_the_exact_home` | Backend test command below |
| A smart bin posts readings with a device key; `(binId, seq)` is de-duplicated and conflicting repeats are refused | Verified in tests | `backend/tests/test_bins.py::test_device_reading_reaches_command_center_and_retries_once`, `::test_conflicting_or_duplicate_sequence_batch_does_not_partially_write`; key rotation and revoke in `backend/tests/test_citycycle.py::test_admin_bin_patch_rotates_key_and_revokes` | Backend test command below |
| A full or hot bin shows in the public bin list; a citizen can report a full bin | Verified in tests | `backend/tests/test_citycycle.py::test_public_bins`, `::test_report_full_bin_creates_garbage_incident` | Backend test command below |
| The bin readings come from a real sensor in the field | **Simulated** | Readings come from `hardware/simulator/`, the browser page `/smart-bin` in `apps/web`, or the Wokwi ESP32 prototypes in `hardware/wokwi/`. Seed bins are marked `is_simulated`. No physical bench build exists | Run the PC simulator (below) |
| The ESP32 firmware prototypes behave as documented | Simulated (compiled and unit-tested on a PC, not run in Wokwi's interactive simulator here) | `hardware/wokwi/README.md` ("Local checks and evidence") | Hardware test commands below |
| Fill forecast: linear, needs 3+ clock-synced readings over 1+ hour | Verified in tests | `backend/tests/test_bin_forecast.py`; in the local demo seed only, `BIN-012` and `BIN-014` carry synthetic history (stale about 30 minutes after seeding): `backend/tests/test_citycycle.py::test_seeded_bins_with_history_have_a_forecast` | Backend test command below |
| Forecast accuracy on real bins | To verify | No real bin history exists | Collect readings from a pilot bin, compare predicted and actual time-to-full |
| Route optimizer splits pickups across vehicles under a capacity and returns ordered stops (preview, nothing dispatched) | Verified in tests | `backend/tests/test_route_optimizer.py::test_optimizer_partitions_pickups_without_persisting_dispatch` | Backend test command below |
| The optimizer routes full bins | Not built | Only recyclables pickups are stops (`backend/app/logic/route_optimizer.py`) | Future work |
| OR-Tools is present in the production build | To verify | PR #63 adds it to production builds; not confirmed on a deployment | After deploying, call `POST /admin/recycling/routes/optimize` as admin; expect not `503` |
| Money moves to collectors or households | **Not claimed** | Amounts are recorded (`paid_to_household_egp`, weighings, payouts); no payment provider is integrated | n/a |
| Demo prices are real market prices | **Not claimed** | Seed prices are DEMO values in `backend/app/seed_citycycle.py` | District sets real prices with `PUT /admin/material-prices` |
| AI triage on a 33-case synthetic Arabic smoke set: top-1 90.9%, top-3 100%, severity agreement 87.9% | Verified (smoke set only) | `backend/ai_eval/README.md`. This is a keyword-baseline smoke test with synthetic text and **not** an accuracy benchmark | `python -m ai_eval.run_eval` |
| Gemini triage, waste photo and voice transcription quality | To verify | Live harnesses exist, but no run has been done: `backend/ai_eval/README.md` | Needs a Gemini key and consented fixtures: `python -m ai_eval.run_waste_eval --live ...` |
| Photo analysis is safe for faces and plates | To verify | Disabled by default; gate in `backend/ai_tests/PHOTO_PRIVACY_VALIDATION.md` | Follow that document with consented Egyptian samples |
| Collector mode on the phone | Built, mock mode by default | `apps/mobile/src/app/collector/`, `apps/mobile/README.md` | `cd apps/mobile && npm ci && npx expo start` |
| Heat, dust, GSM and battery behavior of a real unit | To verify | No physical unit; design targets are in [team/hardware-iot.md](team/hardware-iot.md) | Bench and field tests per section 7 of that brief |
| Full and heat thresholds (80 % and 60 °C defaults) | To verify | `backend/app/models.py` defaults, illustrative | Agree values with the district |
| CO2 avoided | Withheld | `/me/impact` omits it until emission factors have a cited source | Add a sourced factor per material |
| Bill of Materials prices in EGP | To verify | `hardware/bom/bom.csv` (hardware package, separate PR); a price counts only with a dated supplier source | Collect dated quotes from Egyptian suppliers and record supplier and date on each line |
| Admin screens for forecast, route planning, hotspots and bin registration | API implemented; admin screens added in a parallel PR | Endpoints: `GET /admin/bins/forecast`, `POST /admin/recycling/routes/optimize`, `GET /admin/hotspots`, `POST /admin/bins` | Maintainer: update this row after that PR merges |

## Reproduce

From the repo root. The backend commands need `uv` and Python 3.12 or later. `JWT_SECRET` must be at least 32 bytes (the value below is the one CI uses).

```bash
# CityCycle tests only
cd backend && OTP_MODE=demo JWT_SECRET=ci-dummy-secret-not-for-production uv run --extra dev pytest tests/test_citycycle.py tests/test_bins.py tests/test_route_optimizer.py tests/test_bin_forecast.py -q

# Whole backend suite (tests and ai_tests, as CI runs it)
cd backend && OTP_MODE=demo JWT_SECRET=ci-dummy-secret-not-for-production uv run --extra dev python -m pytest -q

# AI smoke set (expected: the table in backend/ai_eval/README.md)
cd backend && uv run --extra dev python -m ai_eval.run_eval

# Hardware simulator and Wokwi receiver tests
python3 -m unittest discover -s hardware/simulator/tests
python3 -m unittest discover -s hardware/wokwi/tests

# Docs links
node scripts/check-doc-links.mjs
```

Recorded runs on 2026-10-23 on this branch: CityCycle subset 67 passed before the seed change and 68 passed with the new forecast test; whole backend suite 430 passed, 9 skipped; `ai_tests` alone 59 passed (older text in [ai-status.md](ai-status.md) records 53 passed, 1 skipped on an earlier branch); simulator tests 66 OK; Wokwi receiver adapter tests 5 OK. The Wokwi C++ core tests need `g++`; see `hardware/wokwi/README.md`.

Live Gemini evaluations (waste photos, transcription): not run; they need a key and consented fixtures.

## Deployment status

No verified live deployment URL is recorded in this repo as of 2026-10-23. Known facts:

- `backend/README.md` documents Vercel (API) plus Supabase PostgreSQL.
- Applying migrations to the real Supabase project is blocked until the primary operator confirms the project and binding.
- Vercel has no FFmpeg, so voice transcription is unavailable there; the clients fall back to typing.
- Free tiers can sleep, throttle or change; continuous availability cannot be promised.

## Runbook checklist (not done yet)

Do not run these without the operator's go-ahead. No paid billing, no secrets in the repo.

- [ ] **Supabase.** Project exists; `DATABASE_URL` is the session pooler string; reviewed Alembic migrations applied as in `backend/README.md` (`--check`, then `--plan`, then `--apply`); private storage bucket and `SUPABASE_*` variables set; optional demo rows via `backend/scripts/seed_citycycle_additive.py` (run `--dry-run` first).
- [ ] **Vercel API** (root directory `backend`). `JWT_SECRET` set; `OTP_MODE=demo` only for a demo; `CORS_ORIGINS` set; `DEMO_RESET_ENABLED` false except on a disposable deployment; Vercel Authentication turned off for the API project; call `POST /admin/recycling/routes/optimize` and confirm it is not `503`.
- [ ] **Vercel apps** (`apps/web`, `apps/admin-web`). `NEXT_PUBLIC_API_URL` set; `NEXT_PUBLIC_API_MODE=api` for `apps/web`; redeploy because the values are inlined at build time.
- [ ] **Smoke test.** `/health`, staff login, `/bins`, the collector flow end to end; record the URLs in this file.
