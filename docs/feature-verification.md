# Feature verification and backend optimisation

What was checked, how to repeat it, and what is still unverified. Every number below was produced by a command in the section "Reproduce"; nothing is estimated. All runs are local: SQLite, in-process or against a local uvicorn plus the admin-web dev server. **No real Supabase, Vercel or hosted database was touched.**

Environment of the recorded runs: Linux container, 4 CPUs, Python 3.12.3, Node 22, SQLite. Playwright used the preinstalled Chromium 141 (the Playwright download host was not reachable), so the browser is not the version Playwright pins.

## Summary

| Area | Result |
|---|---|
| Backend suite (default seed) | 778 passed, 9 skipped (the skips are the Postgres-only tests that need a disposable server) |
| Backend suite on a local branch that also contains the large demo seed (S1) | 804 passed, 10 skipped |
| Backend lint, format, mypy (CI list) | all clean |
| admin-web typecheck, lint, vitest, build | clean, 260 tests passed |
| Playwright, default seed (25 specs: 10 new feature-matrix, 9 page smoke, auth, budget, triage) | 25 passed |
| Playwright, large seed (same 25 specs) | 25 passed (after fixing two real UI bugs the large data exposed, and making the new spec data-size independent) |
| Response shapes of 68 endpoint calls vs a snapshot taken on the unmodified code | identical |
| Bugs found and fixed (each with a test that failed first) | 7 backend/admin-web fixes (B1 to B5, B14, B15), see below |
| Slowest endpoint fixed | `POST /admin/budget/optimize`: 1160 ms to 39 ms at 500k EGP, 3206 ms to 44 ms at 5M EGP |

Not verified (details in "Unverified"): behaviour on real PostgreSQL, a deployed Vercel build, real Gemini, real map tiles, the mobile and citizen web clients against the changed API.

## Reproduce

```bash
# backend (from backend/)
export JWT_SECRET=ci-dummy-secret-not-for-production OTP_MODE=demo
python -m ruff check . && python -m ruff format --check .
python -m mypy app/auth.py app/auth_adapters.py app/admin_auth.py app/media.py app/staff_auth.py app/routers/auth.py app/routers/staff_auth.py --ignore-missing-imports --follow-imports=skip
python -m pytest                                  # 778 passed, 9 skipped
python -m scripts.bench_api --scale large --repeat 7 --json bench.json   # local benchmark, own temp SQLite file only
UPDATE_SHAPES=1 python -m pytest tests/test_api_shapes.py                # regenerate the shape snapshot (deliberate API change only)

# admin-web (from apps/admin-web/)
npm ci && npm run typecheck && npm run lint && npm test && npm run build
npx playwright install chromium
npx playwright test                               # default seed: starts its own backend (:8020) and dev server (:3120)
SEED_SCALE=large npx playwright test              # needs the large demo seed (branch claude/s1-large-demo-seed, docs/demo-data.md)
```

The Playwright matrix writes screenshots to `apps/admin-web/test-results/matrix/` (not committed) and prints `BUDGET_OPTIMIZE_MS`. Admin-web CI does not run Playwright; these are local runs.

For the large-seed runs the S1 branch was merged into a throwaway local branch (never pushed, deleted afterwards). This PR contains no S1 file.

## Feature matrix

`pass` means the named test passed in the run recorded above. "Large" is the S1 seed (about 700 incidents, 300 pickups, 60 bins, 25 collectors) for the browser column and `add_bulk` synthetic rows or the S1 merge for the backend column.

| Feature | Endpoints | Admin screen | Backend tests | E2E (Playwright) | Default | Large | Notes |
|---|---|---|---|---|---|---|---|
| Health | `GET /health` | | `test_feature_walk::test_walk_health_and_reference_data` | | pass | pass | |
| Citizen OTP auth | `POST /auth/otp`, `/auth/verify` | | `test_auth*`, `test_otp_provider` | triage-flow (citizen token) | pass | pass | demo OTP only; real SMS provider not exercised |
| Staff auth/session | `POST /auth/staff-login`, `GET /auth/me` | `/login` | `test_staff_auth`, `test_contract_shapes`, `test_o8_get_by_id_uses_one_statement_and_loads_department` | auth.spec (login, wrong password, redirect, staff nav), matrix 1 and 10 | pass | pass | |
| Reference data | `GET /admin/departments`, `/admin/teams` | work-order drawer, filters | `test_walk_health_and_reference_data` (staff 200, citizen 403, anonymous 401) | matrix 4 | pass | pass | |
| Dashboard / insights | `GET /admin/dashboard`, `/admin/insights` | `/` | `test_admin_computed`, `test_b5_*`, `test_o7_*`, `test_query_counts[admin_dashboard]` | matrix 1 (KPIs, insight card, range buttons) | pass | pass | "today" is now a Cairo day (B5) |
| Incidents admin list | `GET /admin/incidents` (+filters) | `/incidents` | `test_admin`, `test_b2_*`, `test_json_fast_path`, `test_query_counts[admin_incidents]`, `test_walk_staff_scope_and_admin_only_writes` | matrix 2 (status, category, search, chips, sort, 100-row cap) | pass | pass | table caps at 100 rows; there is no server pagination (see "Measured, not changed") |
| Incident detail / patch | `GET/PATCH /admin/incidents/{id}`, `PATCH /incidents/{id}` | `/incidents/[id]` | `test_admin*`, `test_walk_report_to_resolution_and_reopen` | triage-flow.spec | pass | pass | |
| Similar / merge | `GET .../similar`, `POST .../merge` | DuplicateCard | `test_duplicates`, `test_admin`, `test_b3_merged_incident_cannot_be_merged_again` | matrix 3 (two nearby reports, card, confirm dialog, merge) | pass | pass | B3 |
| Triage confirm | `POST .../triage/confirm` | AiSuggestionCard | `test_admin_pr32`, `test_walk_report_to_resolution_and_reopen` | triage-flow.spec | pass | pass | AI is the keyword fallback (no Gemini key) |
| Work orders | `GET/POST /admin/work-orders`, `GET/PATCH /{id}` | `/work-orders`, drawer | `test_admin`, `test_query_counts[admin_work_orders]` | matrix 4 (department filter, drawer, in_progress with note) | pass | pass | |
| Service requests | `GET /admin/service-requests`, `PATCH /{id}`, citizen `POST/GET /service-requests` | `/service-requests` | `test_admin`, `test_citizen_api`, `test_b2_*` | matrix 5 (select, message) | pass | pass | reschedule dialog not driven (message path only) |
| Budget | `POST /admin/budget/optimize`, `/commit` | `/budget` | `test_budget_knapsack` (300 + 5000 random comparisons with the old algorithm), `test_admin*` | budget.spec, matrix 6 (slider, commit) | pass | pass | O1 |
| Demo reset | `POST /admin/demo/reset` | (dev only) | `test_admin` | matrix `beforeAll` | pass | pass | disabled by default in production |
| Citizen reports / incidents | `POST/GET /reports`, `GET /incidents(/{id})`, follow, reopen | | `test_citizen*`, `test_final_fixes`, `test_walk_report_to_resolution_and_reopen` | matrix 3 (API creation) | pass | pass | |
| Map | `GET /map/incidents`, `GET /admin/hotspots` | `/map` | `test_citizen_api`, `test_hotspots`, `test_json_fast_path` | matrix 7 (leaflet, hotspot toggle returns 200, period filter) | pass | pass | OpenStreetMap tiles are unreachable here, so the screenshots show a grey base map; markers, clusters and hotspot circles render |
| Uploads | `POST /uploads/sign`, `PUT /uploads/local/{path}` | | `test_supabase_media`, `test_citizen` | | pass | pass | Supabase storage itself not exercised |
| Notifications / push | `GET /notifications`, `PATCH /{id}`, push tokens | | `test_notifications`, `test_push`, `test_status_change_notification_fanout_is_constant` | | pass | pass | Postgres-only notification tests skipped |
| Bins admin | `GET/POST /admin/bins`, `PATCH /{id}`, `/{id}/readings`, `/{id}/latest` | `/bins`, RegisterBinModal | `test_bins`, `test_walk_register_bin_ingest_forecast` | matrix 8 (register, key dialog, device reading, full state, wrong key 401) | pass | pass | `PATCH` and `/latest`: backend-verified, no admin UI |
| IoT ingest | `POST /iot/bins/{id}/readings`, `/iot/hubs/{id}/weighings` | | `test_bins`, `test_citycycle` | matrix 8 | pass | pass | |
| Forecast | `GET /admin/bins/forecast` | `/bins` | `test_bin_forecast`, `test_analytics_*`, `test_walk_register_bin_ingest_forecast` | matrix 8 | pass | pass | O3, identical output verified on 47 varied bins |
| Route optimise | `POST /admin/recycling/routes/optimize` | `/citycycle` "مسارات الجمع" | `test_route_optimizer`, `test_analytics_*` | matrix 9 (centroid, run, distance KPI, route list), matrix 10 (tab hidden for staff) | pass | pass | about 3 s per call by design; OR-Tools in the production build is still unverified |
| Recycling admin | `GET /admin/recycling/summary`, `/pickups`, `/pickups/{id}`, `PATCH` | `/citycycle` tabs | `test_citycycle*`, `test_walk_recycling_pickup_to_payout` | matrix 9 (admin cancels a pickup) | pass | pass | admin pickup assign: backend-verified, no admin UI |
| Collectors admin | `GET /admin/collectors`, `PATCH /{id}` | `/citycycle` "الجامعون" | `test_citycycle`, `test_b1_*`, `test_query_counts[admin_collectors]` | matrix 9 (verify, suspend), matrix 10 (no buttons for staff) | pass | pass | B1 |
| Prices | `GET/PUT /admin/material-prices`, `GET /recycling/materials` | `/citycycle` "الأسعار" | `test_citycycle` | matrix 9 (edit, save, re-read through the API) | pass | pass | |
| Payouts | `GET /admin/payouts` | `/citycycle` "مستحقات الجامعين" | `test_citycycle`, `test_walk_recycling_pickup_to_payout` | matrix 9 (date filter) | pass | pass | |
| Citizen recycling | `POST/GET /recycling/pickups`, cancel, confirm, `GET /me/impact` | | `test_citycycle`, `test_walk_recycling_pickup_to_payout` | | pass | pass | |
| Collector flow | `POST /collectors/apply`, `GET /collectors/me`, `/collector/*` | | `test_citycycle`, `test_walk_recycling_pickup_to_payout` | | pass | pass | |
| AI triage / transcribe / waste | `POST /triage`, `/ai/transcribe`, `/ai/waste-classify` | AiSuggestionCard | `ai_tests/*`, `test_waste_classify`, `test_walk_ai_routes_without_a_gemini_key` | | pass | pass | fallbacks only; real Gemini unverified |
| Department staff scope | all `/admin/*` as `roads@cityfix.demo` | all screens | `test_walk_staff_scope_and_admin_only_writes` | matrix 10 (rows all roads, no routes tab, budget forbidden state, no failed API call) | pass | pass | |

Admin UI gaps (backend only, no screen; not built here): `PATCH /admin/bins/{id}` (edit, deactivate, rotate key), `GET /admin/bins/{id}/latest`, admin pickup assignment (`status: accepted` + `collectorId`), `GET /admin/recycling/pickups/{id}`.

## Bugs found and fixed (test first)

| Id | Problem | Test that failed first | Fix |
|---|---|---|---|
| B1 | `PATCH /admin/collectors/{id}` accepted any staff member; the contract says every CityCycle write is admin only | `test_b1_department_staff_cannot_change_collector_status` (200 vs 403); vitest "hides verify/suspend buttons from department staff" | route needs `Admin`; admin-web hides the buttons for staff |
| B2 | `?status=bogus` on admin incidents, work orders, service requests is a 500 on Postgres (native enums), `[]` on SQLite | `test_b2_unknown_status_filter_is_422_not_500` (3 params) | typed query parameters, 422 with the contract message |
| B3 | merging an already merged (closed) incident wrote a second "merged" entry | `test_b3_merged_incident_cannot_be_merged_again` | 400 for a resolved/closed source |
| B4 | `next_id` for INC/FTC/WO/SRV/BP was max+1 with no lock (concurrent creates collide on Postgres), and the existing RCY/COL/WGH counters were never re-synced after out-of-band inserts | `test_b4_reservations_do_not_repeat_before_commit`, `test_b4_counter_resyncs_after_out_of_band_insert[RCY]` | all prefixes use the existing `readable_id_counters` row, re-synced to the highest id |
| B5 | "today" on the dashboard started at UTC midnight, so between 00:00 and 02:00/03:00 Cairo time it still counted yesterday | `test_b5_today_window_starts_at_cairo_midnight` (3 params) | Cairo midnight, DST-aware |
| B14 | admin-web: clicking a sortable table header changed `aria-sort` but never reordered the rows (found by the Playwright matrix) | vitest "actually reorders the rows when a sortable header is clicked" | the body renders the sorted rows |
| B15 | admin-web: with 11 or more categories (the large seed) the overview "rest" bar reused the key `other`, a React duplicate-key error on every page after login (found by the large-seed Playwright run) | vitest "does not reuse the real other category key" | key `rest` |

Judgement call to review: `tests/test_admin_computed.py::_since("today")` mirrored the old UTC rule. It reads as an implementation mirror (its docstring is about computing expectations from the DB), not a product requirement, so it was changed to the same Cairo rule together with B5. If UTC "today" was intended, revert the B5 commit.

## Performance

Local in-process SQLite, excludes network and Postgres latency, indicative only; median of 7 runs, 4 CPUs. "Before" is the unmodified application code (commit with the harness only), "after" is this branch, same machine, run back to back. Data: demo seed plus `scripts/bench_data.add_bulk` defaults (700 incidents, 400 citizens, 60 bins x 336 readings, 300 pickups, 20 collectors). Response bytes are identical before and after for every row.

| endpoint | median ms before | median ms after | SQL stmts before | SQL stmts after |
|---|---|---|---|---|
| `POST /admin/budget/optimize` (500,000 EGP) | 1159.8 | 39.4 | 7 | 8 |
| `POST /admin/budget/optimize` (5,000,000 EGP) | 3206.2 | 44.4 | 7 | 8 |
| `GET /admin/bins/forecast` | 340.7 | 69.2 | 6 | 5 |
| `GET /admin/incidents` (admin) | 229.7 | 144.3 | 9 | 8 |
| `GET /admin/incidents` (roads staff) | 58.3 | 34.3 | 9 | 8 |
| `GET /incidents` (citizen) | 182.7 | 122.1 | 10 | 10 |
| `GET /incidents` (admin) | 220.9 | 142.9 | 11 | 10 |
| `GET /map/incidents` | 34.7 | 22.3 | 2 | 2 |
| `GET /admin/collectors` | 14.3 | 9.4 | 25 | 3 |
| `PATCH /admin/incidents/{id}` status change, 25 followers | 44.8 | 29.5 | 95 | 19 |
| `GET /admin/work-orders` | 15.5 | 15.7 | 10 | 6 |
| `GET /admin/service-requests` | 12.7 | 13.0 | 10 | 6 |
| `GET /admin/dashboard` | 38.7 | 34.8 | 8 | 7 |
| `GET /auth/me` (one auth query fewer on every staff request) | 7.9 | 7.4 | 3 | 2 |
| `POST /admin/recycling/routes/optimize` (30 stops) | 3048.5 | 3094.9 | 3 | 2 |

The budget endpoint does one more statement than before because it now reserves its `BP-` id through the counter row (B4). The route optimiser still takes about 3 s: it runs OR-Tools guided local search until its 3 s time limit by design. That was left alone because changing it changes results.

The same comparison on the S1 large demo seed (the realistic target dataset): `/admin/incidents` 295 to 191 ms, `/incidents` 319 to 196 ms, `/admin/bins/forecast` 295 to 117 ms, `/admin/work-orders` 222 to 154 ms (11 to 7 statements), `/admin/budget/optimize` 266 to 33 ms, `/admin/collectors` 30 to 3 statements, status change with followers 53 to 19 statements. Seed content is relative to run time, so byte counts differ a little between the two S1 runs.

What changed, and the guard for each:

| Id | Change | Guard |
|---|---|---|
| O1 | numpy 1-D knapsack instead of an items x capacity tuple grid (imported lazily) | `test_budget_knapsack.py`: the old implementation is kept as an oracle; 300 seeded cases in CI, 5,000 more compared once with 0 mismatches; a 500-candidate case must finish in under 1 s |
| O2 | `JSONResponse` instead of `jsonable_encoder` for seven large list routes without a `response_model` | `test_json_fast_path.py`: the real payload of each route on bulk data is compared byte for byte with the default path |
| O3 | forecast selects five columns instead of about 20k ORM rows | `test_bin_forecast`, `test_analytics_*`; old and new compared on 47 varied bins (unsynced clocks, resets, stale, mismatched latest), identical |
| O4 | bulk profile and weighing lookups for collectors | `test_query_counts[admin_collectors]` (constant 3 statements) |
| O5 | notification fan-out: two queries and one flush for the whole audience | `test_status_change_notification_fanout_is_constant` (19 vs 19 statements for 2 vs 20 followers) |
| O6 | empty-id context returns early; service-request work orders filtered | `test_query_counts` |
| O7 | `resolved_at_map` as a SQL aggregate | `test_o7_resolved_at_map_returns_the_latest_resolved_entry_per_incident` |
| O8 | profile and staff department in one query per authenticated request | `test_o8_get_by_id_uses_one_statement_and_loads_department`, mypy |

`tests/test_query_counts.py` asserts that each hot route issues the same number of SQL statements on the seed and on bulk data, and no more than the recorded ceiling, so an N+1 cannot come back unnoticed. `tests/test_api_shapes.py` compares 68 endpoint calls (admin, roads staff, citizen, collector, device) with `tests/snapshots/api_shapes.json`, generated on the unmodified code and stable over three further runs.

## Measured, not changed

- **Pagination or `limit` on `/admin/incidents`, `/incidents`, `/map/incidents`:** the clients fetch the whole list and expect the full array. Payload at 700 incidents is about 1.0 to 1.6 MB. A proposal for later: an opt-in `limit`/`offset` plus a summary view, which needs `docs/api-contract.md` and client changes.
- **GZip middleware:** costs function CPU. To verify: whether Vercel's edge compresses these JSON responses (look for `content-encoding` on a production response in the browser devtools).
- **Connection pool (`db.py`):** pool_size 2, max_overflow 3, pre-ping and 300 s recycle suit the Supabase session pooler. Each warm Vercel instance can hold up to 5 connections, so at peak concurrency the pooler's client limit could be reached. To verify in the Supabase dashboard.
- **Cold start:** `import app.main` takes about 0.74 s (3 runs: 0.741, 0.742, 0.771 s) and numpy and OR-Tools are not imported at startup.
- **Route optimiser time:** about 3 s per call by design, see above.
- **Duplicate search:** 12 ms at 700 incidents; a bounding-box prefilter is a future item.
- **Proposed future index migration (not applied, no schema change in this PR):** `reports.incident_id`, `reports.reporter_id`, `work_orders.incident_id`, `work_orders.service_request_id`, `ai_suggestions.report_id`, `service_requests.citizen_id`, `incident_followers.user_id` have no index (Postgres does not index foreign keys). A sequential scan is cheap at about 1 to 2k reports and every list path is already bulk-loaded. If they are ever needed, ship them as an additive migration with `CREATE INDEX CONCURRENTLY` following `backend/migrations/reviewed/README.md`.

## Known issues (found, not fixed)

| Id | Issue |
|---|---|
| B6 | `ingest_hub_weighing` (same seq, concurrent) and `follow_incident` (double follow) can raise an IntegrityError and return 500; rare |
| B7 | `GET /bins?bbox=` lacks the finite and range checks of `/map/incidents`; harmless empty result |
| B8 | `GET /service-requests/{id}` lets any staff member read any department's request (the docstring says this is intended) |
| B9 | `parse_bound("YYYY-MM-DD")` on payouts and summary treats dates as UTC days, not Cairo days; changes report numbers, so left to a reviewer |
| B10 | every `/admin/budget/optimize` call inserts a `budget_plans` row, once per slider stop |
| B11 | `_next_suggestion_id` (`AS-xxxx`) has the same scan-and-race pattern B4 fixed for the other ids |
| B12 | admin-web `services/serviceRequests.ts::getServiceRequest` calls `GET /admin/service-requests/{id}`, which does not exist; unused. Also, a work-order card that belongs to a service request links to `/service-requests/SRV-...`, a route the admin-web has not built (seen in the large-seed run) |
| B13 | timestamp columns are `timestamp without time zone` while the code writes aware datetimes, so the stored value depends on the session time zone (Supabase default UTC) |
| B16 | admin-web `/bins`: the "تحديث" button refetches the bins but not the forecast, so the "time to full" line can show "بيانات مش كفاية" for up to 60 s after fresh readings (seen in the matrix screenshot; the API already returns `linear`) |
| B17 | `GET /admin/collectors` returns collector phone numbers to any department staff member (the contract says so; the feature brief says "no phone unless the role needs it") |

## Unverified

- **PostgreSQL:** no Postgres server was available locally (only the `psql` client; Docker was not tried). B2 (500 to 422), B4 (`UPDATE ... SET last_value = CASE ... END + 1 RETURNING`), O5 (single flush ordering notifications before push deliveries), O7 (`GROUP BY` on the activity log) and O8 (outer join) were tested on SQLite only. The Postgres-gated tests (`CITYFIX_TEST_POSTGRES_URL`) were skipped. Rehearse them on a disposable local Postgres before relying on them in production.
- **Vercel build and runtime:** nothing was deployed; OR-Tools and numpy in the production bundle are unconfirmed (numpy is in `requirements.txt`; the lazy import keeps cold start unchanged).
- **Clients other than admin-web:** the mobile app and the citizen web app were not run against this branch. Their contract is protected by the byte-equal and shape tests, not by running them.
- **Gemini, real SMS/OTP, Supabase storage, Expo push delivery:** not exercised (no keys, by design).
- **Browser:** Chromium 141 via the preinstalled binary; map tiles blocked in the sandbox; screenshots and traces are local only.
- **Timing numbers** are single-machine, in-process and noisy at the 10 ms level; the large differences (budget, forecast, collectors, status-change fan-out) are well outside that noise, the small ones are not conclusive.
