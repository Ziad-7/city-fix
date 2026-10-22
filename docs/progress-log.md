# Progress log

Newest first. Each entry: what was done, how to test it, known issues.

## 2026-10-22 — PR #34 supersedes #32 (branch `feat/admin-dashboard`)

**Done**
- Merged Moataz's `feat/api-auth` (PR #32: citizen routes and auth slice, staff login, tests, backend split doc, integration review) into `feat/admin-dashboard` so that PR #34 replaces it with no conflicts. Both branches had implemented the citizen routes and auth; one implementation remains: ours (database-backed, contract-shaped, rewritten admin layer, pyproject + uv, CityFix rebrand, Playwright). PR #32's in-memory demo store and local harness are not kept.
- Ported from PR #32: the shared auth boundary that reloads role and department scope from the database on every request (`app/auth.py`, `auth_adapters.py`, `admin_auth.py`; deactivated or changed staff lose access immediately); `require_role` / `require_department`; missing-scope denial and safe admin reassignment (a work order for another department moves the incident); `DEMO_RESET_ENABLED=true` required for `POST /admin/demo/reset`; staff login with Argon2 or PBKDF2 hashes, an attempt limiter and equalised timing for unknown accounts; optional private-media storage and anonymous reporter masking; citizen validation (link rules, real calendar days, bulky-waste Sunday–Thursday, bbox and enum checks); the readable-ID digit-boundary fix, invalid work-order resource/date validation, self-merge prevention, SQLite timestamp and timezone-offset handling and canonical service statuses (already present in our admin layer and now covered by PR #32's admin tests, `tests/test_admin_pr32.py`); the admin-web 404 test.
- Tooling: `requirements.txt` / `requirements-dev.txt` mirror `pyproject.toml` / `uv.lock`; `backend-ci.yml` runs ruff, scoped mypy (auth boundary) and pytest. The production `npm run build` failure tracked in issue 33 no longer occurs on this tree.
- PR #32's tests `test_auth`, `test_staff_auth`, `test_auth_integration`, `test_citizen_api` and `test_ids` now run against the final app. Where they disagreed with `docs/api-contract.md` the contract won: `StaffSession` has `title` and an Arabic `department` (not `departmentId`); malformed phone and bbox are `400`; `name` is optional in the verify response; work orders need at least one target (both allowed); the local upload stub accepts non-URL paths when no storage is configured.
- Then merged `origin/main` (CityCycle contract and hardware docs): only README, `docs/api-contract.md` and this log conflicted; both sides kept.

**How to test**
- `cd backend && uv run pytest -q && uvx ruff check . && uvx ruff format --check .` (or `python -m pip install -r requirements-dev.txt && python -m pytest -q`)
- `cd apps/admin-web && npm ci && npm run check:shared && npm run typecheck && npm run lint && npm test && npm run build && npx playwright test`
- `node scripts/check-doc-links.mjs`

**Known issues**
- PR #32's older admin-web response-shape adapters were not kept: the backend now returns the contract shapes.
- The auth boundary opens a short database session per request for the user lookup; fine for SQLite, revisit with a pooled Postgres deployment.
- Mypy covers the auth boundary files only; whole-backend typing is incomplete.

## 2026-10-22 — Command Center and backend (branch `feat/admin-dashboard`)

**Done**
- **Backend** (`backend/`, FastAPI + SQLAlchemy 2, SQLite): the citizen contract (auth with demo OTP, incidents, reports, service requests, uploads stub) plus the `/admin/*` routes: staff login, dashboard stats, work orders, service-request schedule, budget plan, demo reset. Priority score and duplicate detection are computed server side. Seed mirrors the mobile mock data. 132 pytest tests, ruff clean.
- **Admin web** (`apps/admin-web`, Next.js 16): login, overview with KPIs, incident queue with filters and side panel, incident detail (status change with required note, work-order panel, timeline, priority factors), work-order kanban, service requests, city map, budget planner. Department staff see only their data. Arabic RTL, design tokens from `ftc.css`.
- Shared mobile code is copied unchanged (`check:shared`); the admin web is renamed to CityFix / سيتي فيكس with the `cityfix-*.svg` assets; demo accounts are `@cityfix.demo`.
- Merged `origin/main` (CityFix rename, optional payment for free services, reopen, uploads). CI: `admin-web-ci.yml` and `backend-ci.yml` run against the real folders.
- Checks: backend 132 pytest, ruff check and format; admin web typecheck, lint, 189 Vitest tests, build, 13 Playwright tests; mobile typecheck and tests unchanged.

**How to test**
- `cd backend && uv run pytest -q && uvx ruff check . && uvx ruff format --check .`
- `cd apps/admin-web && npm ci && npm run check:shared && npm run typecheck && npm run lint && npm test && npm run build && npx playwright test`
- By hand: start the backend, `npm run dev` in `apps/admin-web`, sign in as `admin@cityfix.demo` / `FixCity2026!`, change a status with a note; the citizen sees it in the timeline.

**Known issues**
- Photos are placeholders (no real files are stored); `POST /uploads` is a stub.
- `/ai/transcribe` and the garbage-schedule endpoints are not implemented in the backend.
- SQLite plus haversine distance instead of Supabase/PostGIS; no migrations, delete the DB file after model changes.
- Budget planner: the "بدون حد" preset is disabled.
- The incident detail page has a location card without a map.
- `NEXT_PUBLIC_API_URL` is inlined at build time. Port `3001` may be taken by another app on your machine; use `next dev -p 3002`.

## 2026-10-22 — Backend and admin integration review

**Branch:** `feat/api-auth`, incorporating `feat/admin-dashboard`. This combines the two owners' existing work and repairs the integration after an independent code review.

**Scope**
- Retain the shared JWT boundary with persisted user roles and departments; connect staff login, admin operations and database-backed map pins.
- Repair SQLite timestamp handling, service-request status validation, persisted scheduling and AI-confirmation edits, and readable-ID digit boundaries.
- Enforce department access on triage and work-order creation; deny unscoped staff access and scope insights to the staff department.
- Require explicit local configuration before the destructive demo-reset endpoint is available.
- Repair admin response-shape assumptions, department identity handling, duplicate merge direction, table sorting, and asynchronous status errors.
- Reconcile admin component callers with their typed interfaces and run the admin build, typecheck, lint and regression tests.

**How to test**
- `backend/`: install `requirements-dev.txt`; run `python -m pytest -q`, `python -m ruff check .`, `python -m ruff format --check .` and the scoped mypy command in `backend-ci.yml`.
- `apps/admin-web/`: run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
- Repository root: run `node scripts/check-doc-links.mjs` and `git diff --check`.
- Against the local demo API, sign in as admin, open an incident with AI/duplicate suggestions, confirm triage, create a work order, and change its status with a note. Schedule a service request and reload to verify persistence. Roads staff should be denied changes to other departments.

**Validation**
- Backend: 132 tests pass on Python 3.14; Ruff lint/format and the configured auth-boundary mypy check pass. Six dependency/deprecation warnings remain.
- Admin: 161 tests pass; typecheck and lint pass (25 unused-variable warnings remain). The default production build is unresolved and tracked in [issue 33](https://github.com/Ziad-7/fix-city/issues/33); no alternate-bundler or font workaround is retained. A diagnostic build is not a passing check for the final PR tree.
- Documentation links and Git whitespace checks pass. Independent agent review verified the confirmed fixes. Remote CI results must be checked on the pushed commit.

**Known limitations**
- `app.main` is a local SQLite demo assembly. Persistent citizen report/follow/booking repositories, private media storage, real OTP, production migrations/PostGIS and deployment are still pending.
- Readable IDs still need transactional sequences before concurrent deployment. Demo credentials, fixed OTP and example secrets must not be used as production authentication.
- Whole-backend ORM typing is incomplete; the passing mypy check covers the configured authentication/integration boundary.
- Independent agent review supplements the team's review; teammate acceptance and remote CI remain separate checks.

## 2026-10-22 — Citizen API route slice

**Branch:** `feat/api-auth` (extends the documented backend split/auth work).

**Done**
- Added contract-shaped report create/list/detail, incident list/detail/follow, map filters, and service-request create/list/detail routes behind an injectable `CitizenRepository`.
- Added validation and access control, admin masking for anonymous reporters, media ownership hooks, and future Sunday–Thursday bulky-waste day checks.
- Added opt-in staff login with Argon2 verification and local attempt limiting, plus an opt-in signed-upload endpoint. Both proposed routes await agreement before production registration.
- Added a local in-memory HTTP harness and adapter for parallel work before database setup; documented how the teammate plugs in persistent repository/storage implementations.

**How to test**
- From `backend/`, install `requirements-dev.txt`, then run `python -m pytest -q`, `python -m ruff check app tests`, `python -m ruff format --check app tests`, and `python -m mypy app --ignore-missing-imports`.
- Run `OTP_MODE=demo python -m uvicorn app.citizen_demo:create_app --factory --host 127.0.0.1` from Git Bash and exercise `/docs`.

**Validation**
- 35 tests pass; Ruff lint, Ruff formatting, mypy, and `git diff --check` pass locally on Python 3.14. Python 3.12 GitHub Actions has not run remotely. Starlette emits an upstream TestClient/httpx deprecation warning.

**Still needs teammate or team agreement**
- Database-backed `UserRepository` and `CitizenRepository`, migrations, transactional persistence, production priority and PostGIS duplicate logic, shared app assembly, deployment.
- Actual private-bucket storage adapter and client agreement for the proposed upload route; client agreement for the proposed staff-login route.
- Real OTP delivery, distributed abuse limits and token refresh/revocation.

## 2026-10-21 — Backend split and citizen auth

**Branch:** `feat/api-auth` (based on local `main` at `5345972`).

**Done**
- Documented [two-person ownership](team/backend-split.md): Moataz owns citizen API/auth; teammate owns database, operations and deployment. AI remains a separate role.
- Added citizen demo OTP request/verification matching existing camelCase auth responses; JWT issue/validation with expiry, issuer and audience; shared current-user, role and department checks.
- Added an injectable user repository contract and an explicitly enabled local in-memory harness so auth can be tested before the database adapter lands.
- Added tests, a Python 3.12 CI workflow, [run/integration instructions](../backend/README.md). (The PR description file was dropped when PR #34 superseded #32.)

**How to test**
- From `backend/`, install `requirements-dev.txt`, then run `python -m pytest -q`, `python -m ruff check app tests`, and `python -m mypy app --ignore-missing-imports`.
- Git Bash: `OTP_MODE=demo python -m uvicorn app.auth_demo:create_app --factory --host 127.0.0.1`; use `/docs` to request/verify `01012345678` with `123456`.

**Validation**
- Local checks: 20 tests pass; Ruff lint and mypy pass. Tests ran outside the Windows sandbox because asyncio's internal socket-pair setup stalled inside it. One upstream Starlette warning notes that its httpx test adapter is deprecated; tests still pass.
- Remote CI, teammate review and comparison with latest remote main are pending; this is not a merged or deployed stage.

**Known limitations / next steps**
- In-memory users and signing key reset on restart. This harness is local only; teammate must supply persistence and application assembly.
- Real OTP, attempt/rate limits, staff login, token refresh/revocation, and other citizen endpoints are not implemented in this first slice. Proposed staff/upload contracts still require agreement.
- Local runtime is Python 3.14; CI targets the planned Python 3.12.
## 2026-10-22 — Mobile remaining-work checklist

**Done**
- [`mobile/remaining-work.md`](mobile/remaining-work.md): what is left on the citizen app (real-device checks, backend-dependent items, known gaps, shared-code duty), collected from the README stubs, reviews and this log.

## 2026-10-22 — CityCycle waste pillar and hardware member (branch `docs/citycycle-and-hardware`)

**Done** (documentation only, nothing existing changed or removed)
- **Direction:** CityFix is entered in SolveThe17 2.0, Track 4 · SDG 11 "Unlocking Egypt's Waste Economy". Waste and recycling becomes a main pillar, **CityCycle** (سيتي سايكل — إعادة التدوير), with a 6th team member for hardware ([0004](decisions/0004-citycycle-waste-pillar.md)).
- [`vision.md`](vision.md): all pillars, how they connect, who benefits, impact metrics, and a map of the five grading criteria. Numbers not from the theme are marked "to verify".
- [`features/`](features/README.md): the CityCycle feature plan, one file per member with priorities, acceptance checks and dependencies, plus the hackathon deliverable owners.
- [`team/hardware-iot.md`](team/hardware-iot.md): member 6 brief (smart bin, hub scale, telemetry protocol, Egyptian field conditions, BOM template in EGP, testing plan, work plan).
- [`api-contract.md`](api-contract.md): new "CityCycle — proposed" section (pickups, collectors, material prices, bins and readings with device auth, impact, admin, AI). Pickups are a separate entity; `ServiceType` is unchanged.
- Additions to the team README (row, diagram, hand-offs, week plan), root README, docs index, CONTRIBUTING (branch prefix, CI row), CODEOWNERS (commented), and a new `hardware-ci.yml` that skips until `hardware/firmware/platformio.ini` exists.

**How to test**
- `node scripts/check-doc-links.mjs`; `actionlint .github/workflows/hardware-ci.yml`.

**Open**
- Material prices, CO₂ factors, bin thresholds and every BOM price are unknown on purpose and must be filled from real sources.
- The CityCycle contract section needs agreement from members 1–4 by PR before anyone builds on it. The `hardware/` folder does not exist yet.

## 2026-10-22 — Citizen website review fixes (branch `fix/citizen-web-review`)

**Done** ([review](reviews/2026-10-21-citizen-web-review.md), every finding has a Resolution)
- **Rename:** سيتي فيكس / CityFix everywhere visible on the website, `cityfix-*.svg` assets.
- **Services:** the two missing pages `/services/tree` (free booking, photo, map pin, day and slot) and `/services/garbage-schedule`; tree bookings show their own details on the tracking page and in the list.
- **Reopen card** for resolved reports; **map pins** carry a status glyph and the status in their title; **photo picker** has a camera and a gallery input; **keyboard**: arrows move focus in every radio group.
- **Offline queue across tabs:** shared outbox got a lock/reload seam (mobile first, no-op there); the website uses Web Locks, re-reads the queue before queuing or sending and follows other tabs; a full disk is reported; the old queue format is converted.
- **Privacy:** the GPS fix is no longer sent to a public geocoder (`NEXT_PUBLIC_GEOCODER_URL` removed).
- Gender-neutral copy, neutral Nasr City street names in the shared seed and tests (mobile first), sign-in error messages, voice notes through the shared upload service, per-page titles, accessibility fixes.
- `check-shared.sh` now also reports mobile helpers that were never copied; `web-ci.yml` paths match it. New Playwright specs (services, keyboard, reopen, two tabs, photo picker); the flaky offline spec is deterministic.
- Checks: mobile typecheck, lint, 211 tests, web export; website check:shared, typecheck, lint, 180 unit tests, build, 48 e2e tests (two full runs), doc links.

**Left**
- Notifications page (W16), English text on the website (W22, W29 `withEnglish`), Next patch for the `postcss` advisory (W31). W25 was not a defect.

**How to test**
- `cd apps/web && npm ci && npm run check:shared && npm run typecheck && npm run lint && npm test && NEXT_PUBLIC_API_MODE=mock npm run build && npm run test:e2e`.

## 2026-10-21 — English as a second language (merged into `feat/mobile-phase-d`, PR #10)

**Done** (language layer by Claude; screens translated by three Sonnet 5.5 agents in parallel; reviewed and fixed by Opus 5.5 — [review](reviews/2026-10-21-english-review.md))
- Profile → Language (العربية / English) or "English" on sign-in. Switches instantly; the whole layout flips to left-to-right; no restart.
- Every screen, notice, error, notification and accessibility label is translated ([glossary](mobile/english-glossary.md)). Western digits, English dates and times in English; Arabic is unchanged.
- Category, status, department, district, service, hotline and medal names have English versions (`src/i18n/labels.ts`); demo data has English titles; the server gets `Accept-Language`.
- The emergency check also understands English ("I smell gas"). The garbage-schedule button now reads «شوف المواعيد» / "See the times".
- Checks: typecheck, lint, 205 tests in 37 suites; English and Arabic screens checked in the web preview.

**Still open**
- Live language switch not yet tried on a real Android/iPhone.

## 2026-10-21 — Phase D: remaining citizen features + rename to CityFix (branch `feat/mobile-phase-d`)

**Done** (three Sonnet 5.5 implementers in parallel, reviewed and fixed by Opus 5.5 — [review](reviews/2026-10-21-phase-d-review.md))
- **Report form:** voice notes (record, play, re-record, 60 s max) turned into editable text; map pin picker (tap/drag, "استخدم موقعي", address from the map); emergency box with ١٢٢ ١٢٣ ١٨٠ ١٢٩ when the text mentions gas, fire, injury or a collapse (also when the AI suggestion fails).
- **Reliability:** photos resized to 1600 px and uploaded through `/uploads/sign`; offline queue (reports sent automatically when the connection returns, "مستني النت" cards in طلباتي); login token in secure storage; requests open directly from a link; pull-to-refresh.
- **Account and services:** notifications centre with a badge on Home and phone notifications; "خط أكبر"; tree maintenance booking (free); garbage collection schedule; reopen a fixed report ("لسه المشكلة موجودة؟").
- **Rename:** the product is now **CityFix / سيتي فيكس** ([0003](decisions/0003-rename-to-cityfix.md)): app name, logo, screens, design pack, docs. Package id, slug, link scheme and `FTC-` numbers stay.
- Checks: typecheck, lint, 172 tests in 30 suites, web export.

**How to test**
- Install a new APK (`eas build -p android --profile preview`) or use Expo Go 57. Try: a voice note on a new report, moving the pin, typing "فيه ريحة غاز", airplane mode then sending a report, "محاكاة تحديث الحالة" on a report to see a notification, booking a tree service, the garbage schedule, and reopening a fixed report.

**Still open**
- Needs a pass on a real phone (recording, map picker, notifications, secure storage). API mode untested against a real backend. English is still a stub.
## 2026-10-21 — Citizen website (`apps/web`)

**Done**
- Next.js App Router site in `apps/web` with every citizen screen from the web mockups: sign-in, home, report flow (category, form with photo, location and duplicate check, success), my requests and tracking timeline, CityServe and bulky-waste booking, Leaflet map with filters, profile. RTL Arabic, desktop and phone layouts.
- Domain, logic, utils and service code copied unchanged from `apps/mobile/src`; `npm run check:shared` fails on drift. Mock mode (localStorage, code `123456`) and API mode, same as mobile.
- Report form extras: voice note (browser speech recognition, or upload + `/ai/transcribe` in API mode), offline queue that sends saved reports when the connection is back, and street names from GPS via OSM Nominatim. Implemented by Claude, reviewed and hardened by a Sonnet 5.5 agent (cross-tab send lock, mic released on unmount, debounced geocoding).
- 100 Vitest tests and 11 Playwright journeys (desktop and phone) pass. CI workflow `.github/workflows/web-ci.yml`.

**How to test**
- `cd apps/web && npm install && npm run dev`, sign in with `01012345678` and `123456`.
- `npm run check:shared && npm run typecheck && npm run lint && npm test && npm run test:e2e`.

**Known issues**
- See the "Known gaps" list in `apps/web/README.md`: token in localStorage, upload and transcribe endpoints not built yet, API mode untested.
- Map tiles could not be loaded in the build sandbox, so the map was checked with its fallback background only.

## 2026-10-21 — Android APK startup crash: root cause and fix

**Done**
- Abood captured the crash on an Android Studio emulator. Root cause: WorkManager (brought in by `react-native-maps`) starts at launch and creates its Room database by reflection; R8 in the release build stripped `WorkDatabase_Impl`. Details: [crash analysis](mobile/2026-10-21-android-startup-crash.md).
- Fix: `expo-build-properties` keep rules (verified in a local `expo prebuild`), `app.config.js` for the Google Maps key (prevents the next crash on the map tab), `eas.json` build profiles. Typecheck, lint, 89 tests pass.
- EAS preview build [`8193f7e1-441d-48f6-9c78-b3a554a471ba`](https://expo.dev/accounts/abdulrahman-111s-team/projects/cityfix/builds/8193f7e1-441d-48f6-9c78-b3a554a471ba) completed from PR #9 commit `ca4a759`; the user confirmed the rebuilt APK works. See the crash analysis for the build configuration and confirmation limits.

**How to test**
- Set `GOOGLE_MAPS_API_KEY` in EAS, `eas build --platform android --profile preview`, install, launch, open the map tab; `adb logcat -b crash` should stay empty.

**Known issues**
- Google Maps API key and map-screen testing are deferred at the user's request. No new device details or crash-buffer capture accompanied the successful startup report; broader real-device and feature testing remains outstanding.

## 2026-10-21 — Review of the SDK 57 change and handoff (PRs #6, #7)

**Done**
- Reviewed and verified from a clean install: typecheck, lint, 89 tests, `expo install --check`, web export, CI all pass ([review](reviews/2026-10-21-sdk57-review.md)). Approved.
- Updated stale "SDK 58 / RN 0.88" notes (implementation spec, `Screen.tsx` comments).
- Mobile README: before the next Android APK, add a Google Maps API key (or the map tab will crash) and commit an `eas.json` build profile.

## 2026-10-21 — Mobile developer handoff: preview and APK investigation

**Done**
- Added the [Expo Go and APK handoff](mobile/2026-10-21-expo-go-and-apk-handoff.md): SDK 57 changes and rationale, temporary cloud Metro/tunnel setup, verification evidence, and Android Studio/Logcat reproduction steps.
- Updated the mobile README's SDK version and linked the handoff.

**How to test**
- Documentation: confirm links, version numbers and PR #6 references match the current repository.

**Known issues**
- The original standalone APK still needs a crash trace and a verified fix. Expo Go preview success does not establish release-APK correctness.

## 2026-10-21 — Android Expo Go SDK 57 compatibility

**Done**
- Aligned Expo, React Native, Router, native modules and test dependencies with SDK 57 to match Expo Go 57.0.9 on the user's Android phone.
- Updated the custom tab bar to use SDK 57's navigation API. The user confirmed the preview opens successfully.

**How to test**
- In `apps/mobile`, run `npm ci`, `npm run typecheck`, `npm run lint`, and `npm test -- --runInBand` (89 tests pass).
- Start Expo and open the project in Expo Go supporting SDK 57. Demo verification code: `123456`.

**Known issues**
- Cloud previews need an active Expo tunnel; the development server and tunnel are temporary runtime processes.

## 2026-10-21 — Design follow-ups

**Done**
- Priority decision: the formula in `apps/mobile/src/logic/priority.ts` is the source of truth (waiting time in whole days; equity bonus only for areas marked underserved). Admin example INC-0042 corrected from 93 to **78** ("أولوية عالية", still "خطر") on Incidents, IncidentDetail, Overview and Map.
- Gender-neutral copy in the app and web design: "البلاغ ده متسجّل باسمك بالفعل".
- Mobile designs: on/off settings drawn as switches, matching the app and website.
- Mobile checks: typecheck, lint, 89 tests passing.
## 2026-10-21 — Team roles: 5 members, one brief each

**Done**
- [`team/README.md`](team/README.md) rewritten as the single page for who does what: the 5 roles with owners, folders and branch prefixes; what each role delivers and doesn't; owners of shared things (contract, design, shared code, schema, demo data, deploys, CI); hand-offs; a 7-day plan per member; review rules; first-hour checklist.
- Briefs: [admin web](team/admin-web.md) (new, 8 pages matching `design/screens/admin/`), [citizen website](team/citizen-web-portal.md) (updated), [API & database](team/api-database.md) (was backend-database; AI and optimizer moved out, staff login, admin endpoints and backend DevOps added), [AI & smart features](team/ai-features.md) (new: triage + fallback, budget optimizer, voice transcription, photo blur, duplicate help, insights, evaluation).
- API contract: proposed staff login, admin list/update endpoints, merge, similar, insights, `/ai/transcribe`, `source`/`emergency` on triage.
- Root README team table, CONTRIBUTING branch prefixes per role, PR template, CODEOWNERS template.

## 2026-10-21 — Design pack: identity guide + screens for every surface (branch `design/identity-and-screens`)

**Done** (three Sonnet 5.5 implementers in parallel, reviewed and fixed by Opus 5.5 — [review](reviews/2026-10-21-design-pack-review.md))
- **Identity everyone follows:** [`design/identity.html`](design/identity.html) (logo, colours, type, spacing, icons, components, voice, Egypt rules, per-surface rules, accessibility, don'ts, CSS/Tailwind snippets) and the shared stylesheet [`design/css/fixthecity.css`](design/css/cityfix.css). `tokens.json` stays the source of truth (now light-only, with six missing tokens added).
- **28 HTML screens:** `screens/mobile/` (10, incl. new Requests, Map, Profile), `screens/web/` (10 citizen website pages, desktop + phone layout), `screens/admin/` (8 Command Center pages: Login, Overview, Incidents, IncidentDetail, Map, ServiceRequests, WorkOrders, Budget). Old design-tool exports cleaned into plain HTML.
- **Design hub:** [`design/index.html`](design/index.html) and [`design/README.md`](design/README.md) with online preview links for every screen.
- Demo data aligned across surfaces (pothole FTC-1042 priority = 66 from `priority.ts`).

**How to open**
- Online: https://raw.githack.com/Ziad-7/fix-city/main/docs/design/index.html
- Locally: open `docs/design/index.html` in a browser.

**Still open** (details in the review)
- Admin INC-0042 score (93) needs the backend to confirm the priority formula; mobile app copy "إنت مبلّغ عنها بالفعل" should become gender-neutral; mobile mockup toggles drawn as checkboxes.

## 2026-10-21 — Citizen web portal role

**Done**
- Decision: a citizen website in `apps/web` alongside the mobile app, same backend and contract, same design ([0002](decisions/0002-citizen-web-portal-alongside-mobile.md)).
- Role brief for the member building it: [`team/citizen-web-portal.md`](team/citizen-web-portal.md): same brand, tokens, mockups, components and copy as the mobile app; pages mirroring the mobile screens; shared domain/logic copied with a CI diff check; mock mode then API mode; 10-step plan and acceptance checks.
- API contract, backend brief and team table updated: three clients on one API, CORS for web origins, browser photo upload.

## 2026-10-21 — Phase C: review and fixes (branch `feat/mobile-citizen-app`, draft PR #1)

**Done**
- Independent review by Opus 5.5: 0 blockers, 6 major, 22 minor, 9 nits, 4 web-only ([review](reviews/2026-10-21-mobile-review.md)).
- Fixes by Sonnet 5.5 (all majors, all web-only, most minors/nits — see the review's Resolution table), checked by Claude:
  - Back navigation after sending a report or booking now returns to Home.
  - The duplicate panel never offers your own report; it says "إنت مبلّغ عنها بالفعل" and links to it. "متابع" state is shared across Home, map and detail.
  - Keyboard no longer covers fields or buttons (sign-in, report, bulky booking); the code auto-submits at 6 digits.
  - Critical problems show the "خطر" badge everywhere, with an alert marker on the map.
  - API mode: handles `204` responses, keeps the login token across restarts, signs out cleanly on `401`.
  - Single medal rule (`domain/medals.ts`), report validation (photo or 10+ characters) in the shared schema, gender-neutral copy, web switches and notices fixed, README rewritten.
- Android RTL checked in React Native's source: the root `direction: 'rtl'` applies on Android too, so no fallback was needed.
- API contract updated: `alreadyReported` in triage results, `isFollowing` on incidents, the duplicate exclusion rule.
- Checks: typecheck and lint clean, 89 tests in 17 suites passing.

**Still open**
- Real-device test on Android and iPhone: keyboard avoidance, RTL, native map pins.
- Login token is stored in AsyncStorage; move to `expo-secure-store` with a development build.
- Offline queue and the photo upload flow (`/uploads/sign`) are not built yet.

## 2026-10-21 — Phase B: all citizen screens (branch `feat/mobile-citizen-app`)

**Done** (two Sonnet 5.5 implementers in parallel, checked by Claude Opus 5.5)
- **B1:** Home (greeting, red hero with the Cairo skyline, service tiles, "حوالين بيتك" with "أنا كمان", latest updates, emergency numbers); problem type screen (emergency box, 12 Egyptian categories with "خطر" tags, voice entry, utility hotlines); report form (camera/gallery photos, mock AI suggestion with top-3 categories and severity, description, GPS location with fallback, landmark, privacy toggles, duplicate panel "نفس المشكلة، تابعها", offline note); "تسلم إيدك!" success screen with the جدع الشارع medal progress and share.
- **B2:** طلباتي list with filters; request tracking (summary, priority strip with reasons, RTL timeline, WhatsApp updates toggle, share, dev-only "simulate progress"); CityServe catalog and bulky-waste booking (items, working-day picker, slot, payment, fee placeholder) that lands in طلباتي; CityPulse map with status/category filters and a pin card; profile (name, area, toggles, stats and medal, sign out).
- Checks: typecheck and lint clean, 61 tests in 14 suites passing.
- Docs: [API contract](api-contract.md) and [team role briefs](team/README.md) so backend & database, AI, admin web and optimizer/DevOps can work in parallel.

**How to test**
- `cd apps/mobile && npx expo start`, sign in with `01012345678` / `123456`, send a report (try "فيه حفرة كبيرة قدام المدرسة" with the pothole category to see the AI card and the duplicate panel), book a bulky-waste pickup, and open both in طلباتي.

**Known issues (going to review)**
- On/off switches look broken in the web preview; `Alert` dialogs don't show on web.
- Voice notes and notifications are stubs ("قريبًا"); the map in the report form is a static preview.
- Not yet run on a real phone.

## 2026-10-21 — Phase A: mobile foundation (branch `feat/mobile-citizen-app`)

**Done** (implemented by Sonnet 5.5, checked by Claude Opus 5.5)
- Expo SDK 58 app config: Expo Router entry, `fixthecity` scheme, red splash and app icon, Arabic permission strings, RTL.
- Theme from `docs/design/tokens.json` (flag palette, Readex Pro / IBM Plex Sans Arabic / Aref Ruqaa).
- Shared UI kit: AppText, Button, Card, StatusChip, Chip, TextField, SelectField, ToggleRow, ProgressBar, Screen, ScreenHeader; brand Logo, Cairo Skyline, Medal; SVG Icon set; hotline buttons; incident map (native map, web list fallback).
- Domain model mirroring the plan's DB entities (Report, Incident, ServiceRequest, statuses), Egyptian categories, hotlines, governorates/districts, CityServe catalog, zod schemas.
- Logic: deterministic priority score with factor explanations, duplicate detection (same category, open, within 250 m), mock CityBrain triage (Egyptian Arabic keywords → top-3 categories + severity).
- Services behind interfaces with mock implementations persisted on the phone (10 seeded incidents around Nasr City, a demo report and a service request) and API implementations ready for the FastAPI backend (`EXPO_PUBLIC_API_MODE=api`).
- Zustand stores (session, reports, service requests) and navigation: protected routes, custom tab bar with the gold Report button.
- Sign-in screen complete (+20 phone validation, SMS/WhatsApp code, governorate/district).
- Tests (24 passing), ESLint, CI workflow `.github/workflows/mobile-ci.yml`.
- Fix by Claude: the root layout now sets `direction: 'rtl'`, so the app is right-to-left in Expo Go on any phone language.

**How to test**
- `cd apps/mobile && npm install && npx expo start`, scan with Expo Go.
- Sign in with any valid Egyptian mobile (e.g. `01012345678`) and code `123456`.
- `npm run typecheck && npm run lint && npm test`.

**Known issues**
- Other screens are placeholders ("قيد التنفيذ") until Phase B.
- API mode is untested (no backend yet); it assumes extra endpoints `/auth/otp`, `/auth/verify`, `/triage`, `/incidents/{id}/follow` — to agree with the backend owner.
- Only checked on the web build so far; needs a run on a real Android and iPhone.

## 2026-10-21 — Stage 0/1 kickoff: citizen app moves to mobile

**Done**
- Decision recorded: the citizen portal becomes an Expo mobile app; the Command Center stays web ([0001](decisions/0001-mobile-app-instead-of-web-portal.md)).
- Repo structure, README, contributing rules, docs index.
- Design handed over into the repo: brand book, tokens, 9 screen mockups, logo and skyline SVGs (`docs/design/`).
- Implementation spec for the citizen app (`docs/mobile/implementation-spec.md`).
- Expo SDK 58 app created in `apps/mobile` with Expo Router, maps, camera, location, fonts and state libraries installed.

**How the team builds it**
- Implementation by a Sonnet 5.5 agent per phase; review by an Opus 5.5 agent; coordination and commits by Claude (Opus 5.5). All at medium thinking effort.
- Phase A: foundation (config, theme, components, domain, mock services, store, navigation, sign-in, tests, CI).
- Phase B: screens, split by area — B1 home + report flow, B2 requests/tracking + CityServe + map + profile.
- Phase C: independent review, fixes, then push.

**Known issues**
- GitHub push access for Claude is not set up on `Ziad-7/fix-city` yet; work is committed locally until it is.
