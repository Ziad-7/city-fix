# Plan — Admin dashboard (City Command Center) + backend

**Spec (binding authority):** `docs/team/admin-web.md` (admin web brief), `docs/team/api-database.md` (backend brief), `docs/api-contract.md` (shapes and endpoints), `docs/design/screens/admin/*.html` (8 screens, built 1:1), `docs/design/identity.html` + `docs/design/css/fixthecity.css` + `docs/design/tokens.json` (design system).
**Design translation (written by the design agent in Task D1):** `docs/admin-web/design-spec.md`.

## Global constraints

1. **Folders.** Backend lives in `backend/`. Admin web lives in `apps/admin-web/`. Do not edit `apps/mobile/` (read-only source of shared code).
2. **API conventions** (from the contract): JSON camelCase keys; ISO 8601 UTC timestamps (`2026-10-21T10:12:00Z`); dates `YYYY-MM-DD`; `Authorization: Bearer <token>` everywhere except `/auth/*` and `/health`; errors are HTTP status + `{ "detail": "<short Egyptian Arabic>" }` (400, 401, 403 `"مش مسموح"`, 404 `"مش موجود"`, 409); lists newest first unless stated; IDs `FTC-1042`, `INC-501`, `SRV-2001`, `WO-318`.
3. **Enums:** `IncidentStatus = received|triaged|assigned|in_progress|resolved|closed` (service requests too). `Severity = low|medium|high|critical`. `WorkOrderStatus = open|assigned|in_progress|done` (Arabic: اتسلّم · اتوزّع · شغالين عليه · اتحلّت). Category ids exactly as `apps/mobile/src/domain/categories.ts`.
4. **Priority formula** identical to `apps/mobile/src/logic/priority.ts`: severity 5/15/28/40; sensitive place +20; reporters `min(20,(n-1)*3)`; age `min(15, round(daysOpen/targetDays*10))` where daysOpen = whole days; underserved +5; cap 100. Levels: ≥85 critical, ≥65 high, ≥40 medium, else low. Factor keys/labels exactly as in that file.
5. **Duplicates:** open incident, same category, within 250 m (haversine in Python — no PostGIS locally; documented deviation).
6. **Every status change** (incident, service request, work order) goes through ONE function per entity that also writes an `activity_log` row; timelines are built from `activity_log`, oldest first.
7. **Privacy:** admin views never show a citizen's name or phone. Reporters appear as `"مواطن"` or (anonymous) `"بلاغ بدون اسم"`.
8. **Admin UI rules:** `<html lang="ar" dir="rtl">`; fonts Readex Pro (display) + IBM Plex Sans Arabic (body) via `next/font/google`; ink `#161616` sidebar 232px, gold active item with ink text, red primary buttons, white cards on paper `#F8F6F2`; **Western digits** in tables/data (`128`, `1,800 جنيه`); no new colours, no gradients, no dark mode, no religious motifs. Status = same word + same colour everywhere (STATUS_LABEL_AR from the mobile types). AI output labelled `"اقتراح الذكاء الاصطناعي"` with confidence and confirm/change buttons; merges need a human click. Every status change form REQUIRES a note to citizens and shows a preview. Desktop-first 1280–1440px, must not break at 768px. Keyboard usable, visible focus (gold 3px outline).
9. **Demo accounts:** admin `admin@fixthecity.demo` / `FixCity2026!` (role admin, name `سارة محمود`, title `مشرفة فرز · حي مدينة نصر`, district `القاهرة · حي مدينة نصر أول`); staff `roads@fixthecity.demo` / `FixCity2026!` (role staff, department `صيانة الطرق`, name `م. هشام عادل`). Citizen demo `01012345678`, OTP `123456`.
10. **Ports:** backend `8000`, admin web `3001`. Admin web env: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`). No secrets in the frontend.
11. **Tests are required in every task** and must pass before the task is reported DONE. Backend: `pytest`. Frontend: `vitest` for logic, `tsc --noEmit`, eslint, `next build`; Playwright for flows (Task 10).

## Shared JSON shapes (contract additions, admin-only)

Existing shapes (`Incident`, `Report`, `ServiceRequest`, `MapPin`, `TimelineEntry`, `Priority`, `TriageSuggestion`, `Place`) are exactly as in `docs/api-contract.md` / `apps/mobile/src/domain/types.ts`. Admin additions (backend returns these; frontend types them in `apps/admin-web/src/domain/admin-types.ts`):

```ts
StaffSession = { userId: string, name: string, title: string, role: 'staff'|'admin', department?: string, district: string, token: string }

Department = { id: string, nameAr: string, external: boolean, externalHotline?: string }

LinkedReport = { id: string, reporter: 'مواطن'|'بلاغ بدون اسم', description: string, source: 'app'|'web', photoCount: number, createdAt: string }

AdminIncident = Incident & {
  linkedReports: LinkedReport[],
  triage?: TriageSuggestion & { source: 'model'|'fallback', confirmed: boolean },
  dueAt: string,            // createdAt + targetDays (calendar days, simple)
  overdue: boolean,         // open && now > dueAt
  external: boolean, externalHotline?: string,
  inBudgetPlan: boolean,    // selected in the last saved budget plan
  lastReviewedBy?: string, lastReviewedAt?: string
}

WorkOrderTask = { label: string, done: boolean }
WorkOrderUpdate = { status: WorkOrderStatus, note: string, actor: string, at: string }
WorkOrder = {
  id, incidentId?: string, serviceRequestId?: string, title: string, address: string,
  department: string, external: boolean, externalHotline?: string,
  team?: string, teamSize?: number, supervisor?: string,
  status: WorkOrderStatus, dueAt: string, overdue: boolean,
  estimatedCostEgp: number, priorityScore?: number, followers?: number,
  tasks: WorkOrderTask[], updates: WorkOrderUpdate[], createdAt, updatedAt, resolvedAt?: string
}

AdminServiceRequest = ServiceRequest & { department: string, paid: boolean, assignee?: string, workOrderId?: string }

DashboardStats = {
  open: number, openDelta: number, overdue: number,
  resolvedThisWeek: number, resolvedDelta: number,
  avgResolutionDays: number, avgResolutionDeltaDays: number,
  byCategory: { categoryId: CategoryId, count: number }[],      // open only, desc
  byStatus: { status: IncidentStatus, count: number }[],         // open statuses + resolved this week
  overdueList: { incidentId, title, department, address, priorityScore, dueAt, hoursLate: number /* negative = hours remaining */, external: boolean, externalHotline?: string }[], // overdue or due within 12h, priority desc, max 5
  overdueTotal: number,
  departments: { department, external, externalHotline?, open, overdue, avgResolutionDays, loadPct }[],
  activity: { actor: string, text: string, entityId?: string, status?: IncidentStatus, at: string }[], // latest 8
  nav: { incidentsOpen: number, serviceRequestsOpen: number }
}

BudgetItem = { incidentId, title, categoryId, costEgp, priorityScore, followers, reason: string /* one Arabic line */ }
BudgetPlan = { budgetEgp, selected: BudgetItem[], skipped: BudgetItem[], totalCost, remaining, coveredPriority, totalPriority, citizensServed, citizensTotal }

Insights = { summary: string, hotspots: { address, count }[], risingCategories: { categoryId, delta }[], overdueDepartments: string[] }
```

## Endpoints the backend serves

Citizen (contract): `GET /health`, `POST /auth/otp`, `POST /auth/verify`, `POST/GET /reports`, `GET /reports/{id}`, `GET /incidents`, `GET /incidents/{id}`, `POST /incidents/{id}/follow`, `GET /map/incidents` (query `status`, `categoryId`, `bbox`), `POST/GET /service-requests`, `GET /service-requests/{id}`, `POST /triage` (keyword fallback ported from `apps/mobile/src/logic/triage-mock.ts`), `POST /uploads/sign` (local stub returning `{uploadUrl, path}`).

Staff/admin (role `staff` or `admin` unless noted):
- `POST /auth/staff-login` `{email,password}` → `StaffSession`; `GET /auth/me` → `StaffSession` without token.
- `GET /admin/departments` → `Department[]`.
- `GET /admin/dashboard?range=today|7d|30d` → `DashboardStats`.
- `GET /admin/incidents?status=&categoryId=&department=&critical=&overdue=&q=` → `AdminIncident[]` sorted **priority desc**. Staff only see their department.
- `GET /admin/incidents/{id}` → `AdminIncident`.
- `PATCH /incidents/{id}` `{ status?, severity?, categoryId?, department?, note? }` — `note` REQUIRED (400 `"اكتب رسالة للمواطنين"`) when status changes; recomputes priority on severity/category change; writes timeline. Returns `AdminIncident`. Staff can only patch their department (403).
- `POST /admin/incidents/{id}/triage/confirm` `{ categoryId?, severity? }` → marks triage confirmed, sets `lastReviewedBy/At`, moves `received`→`triaged` with a timeline note. Returns `AdminIncident`.
- `GET /admin/incidents/{id}/similar` → `DuplicateMatch[]` (open, same category, ≤ 250 m, not itself).
- `POST /admin/incidents/{id}/merge` `{ intoIncidentId }` → moves linked reports + followers into target, closes source with note, returns target `AdminIncident`.
- `GET /admin/work-orders?status=&department=` → `WorkOrder[]`; `GET /admin/work-orders/{id}`.
- `POST /admin/work-orders` `{ incidentId?, serviceRequestId?, department, team?, teamSize?, supervisor?, dueAt?, tasks?: string[] }` → `WorkOrder` (status `open`, or `assigned` if team given); links `incident.workOrderId`; moves incident to `assigned` (timeline note `"اتحوّل لـ<department>"`) if earlier. 409 `"البلاغ ده ليه أمر شغل بالفعل"` if the incident already has one.
- `PATCH /admin/work-orders/{id}` `{ status?, team?, teamSize?, supervisor?, dueAt?, tasks?: WorkOrderTask[], note? }` → `WorkOrder`; status `in_progress`/`done` also moves the linked incident to `in_progress`/`resolved` (note required → 400) with the same note.
- `GET /admin/service-requests?status=&serviceType=&day=&payment=` → `AdminServiceRequest[]` (day asc).
- `PATCH /admin/service-requests/{id}` `{ status?, day?, slot?, assignee?, note? }` → `AdminServiceRequest` (note required on status change).
- `POST /admin/budget/optimize` `{ budgetEgp, incidentIds? }` → `BudgetPlan` (admin only). 0/1 knapsack (DP, exact over 100 EGP units; costs rounded up) maximising sum of priority score over open incidents whose work order is not `done`; ties broken by followers. Each item gets a one-line Arabic reason (selected: e.g. `"أولوية 78 · قريب من مدرسة · 1,800 جنيه"`; skipped: `"الميزانية مش مكفّية: محتاج 7,500 جنيه والمتبقي 2,100"` or `"أولوية أقل من البدائل بنفس التكلفة"`). Saves the plan (so `inBudgetPlan` works).
- `POST /admin/budget/commit` `{ incidentIds }` → `WorkOrder[]` created for each selected incident without a work order (admin only).
- `GET /admin/insights` → `Insights` (deterministic, computed from data).
- `POST /admin/demo/reset` (admin only) → re-seeds the DB.

## Seed (backend)

Relative to "now" at seed time (like `apps/mobile/src/services/mock/seed.ts`). Must include the 10 mobile seed incidents (`INC-501`…`INC-510`, same titles/addresses/coords/statuses/followers/reporters/work orders `WO-318`, `WO-321`, `WO-324`, `WO-326`), the demo citizen with `FTC-1042` on `INC-501` and `SRV-2001`. Add ~22 more incidents `INC-511`…`INC-532` around Nasr City (lat 30.048–30.063, lng 31.322–31.342) spread over all 12 categories and all statuses, ages 1h–9 days, some overdue, some anonymous reports, so every admin screen has realistic data (at least 3 overdue, 2 critical, 4 resolved in the last 7 days, 2 resolved the week before). ~11 work orders across all 4 statuses (some overdue, one external `شركة مياه الشرب` with hotline 125), each with 3–4 tasks and 1–3 updates. 9 service requests `SRV-1998`, `SRV-2001`…`SRV-2008` (bulky_waste + tree_maintenance, payments cash/fawry/instapay/wallet, mixed paid). Departments derived from categories (external = has `externalHotline` in categories.ts: شركة مياه الشرب 125, شركة الكهرباء 121, الصرف الصحي 175). Teams: `فريق الطرق 1..3`, `فريق النظافة 1..4`, `فريق الإنارة 1..2`, `فريق الحدائق 1`, `فريق الصرف 1..2`. Seed triage suggestions for incidents in `received` (some unconfirmed).

---

## Task D1 — Design spec (design agent, Sonnet; runs in parallel with Tasks 1–3)

Read every file in `docs/design/screens/admin/`, `docs/design/identity.html`, `docs/design/css/fixthecity.css`, `docs/design/tokens.json`, `docs/design/brand-book.md`, `apps/mobile/src/components/icon-shapes.ts`. Write `docs/admin-web/design-spec.md` — the document a junior implementer (who will NOT open the HTML) builds the UI from. It must contain:
1. **Tailwind v4 theme** (`@theme` block for `globals.css`) with every token as a CSS variable, plus the full set of shared `.ftc-*` classes needed by the admin screens, copied/adapted from `fixthecity.css` and the per-screen `<style>` blocks, as ready-to-paste CSS (`apps/admin-web/src/app/ftc.css`).
2. **Component inventory** with props, exact markup structure, classes, sizes and states (default/hover/focus/disabled/selected/loading/empty/error): AppShell + Sidebar (brand block, nav with counts, user block + sign out), PageHead, KpiCard, StatusChip, DangerTag, ScoreBadge, FilterChip, Select, TextField, TextArea, Button variants, Card, DataTable (sortable header, selected row), PriorityBreakdown, Timeline, HBarChart, StackBar, Drawer/side panel, Modal (confirm), Toast, Kanban column + card, Map pin + legend + cluster, Budget slider + presets, EmptyState, Skeleton, ErrorState, Icon (list the icon names used and their SVG path data from `icon-shapes.ts` / the HTML).
3. **Per page (8 pages)**: route, grid layout with column ratios and breakpoints, every section in order, which component and which data field fills each element, exact Arabic copy strings, number/date formatting (Western digits, `1,800 جنيه`, `الخميس 22/10`, `باقي 5 س`, `متأخر يومين`), interactions (what each button does, which API call from the plan's endpoint list), and the states the static mockup does not show (loading, empty, error, no-permission for staff, form validation messages, success toasts).
4. **Formatting helpers spec** (function name, input, output examples) for durations/dates/money in Egyptian Arabic with Western digits.
Do not write application code. Output: `docs/admin-web/design-spec.md` only.

## Task 1 — Backend foundation

`backend/` with `pyproject.toml` (uv, `requires-python >=3.12`; deps fastapi, uvicorn[standard], sqlalchemy>=2, pydantic>=2, pydantic-settings, pyjwt, httpx, pytest), `app/main.py` (CORS for `http://localhost:3000`, `http://localhost:3001`; `/health` → `{"status":"ok","version":"0.1.0"}`; router registration), `app/config.py` (env: `DATABASE_URL` default `sqlite:///./fixthecity.db`, `JWT_SECRET` default dev value, `OTP_MODE=demo`, `SEED_ON_START=true` seeds only when DB empty), `app/db.py` (SQLAlchemy engine/session, `get_db` dependency), `app/models.py` (tables from `docs/team/api-database.md` schema: profiles, departments, categories, incidents (lat/lng float columns), reports, incident_followers, service_requests, work_orders (+ team, team_size, supervisor, due_at, tasks JSON, estimated cost), activity_log (entity_type, entity_id, status, note, actor, at, kind), staff_accounts (pbkdf2_sha256 via hashlib), ai_suggestions, budget_plans), `app/schemas/` (Pydantic v2 camelCase aliases, `by_alias` output) for every shape in the contract and this plan, `app/logic/` (`priority.py` exact port incl. labels; `duplicates.py` haversine 250 m; `ids.py` readable ids; `timeline.py` incident/service timeline entry notes ported from `apps/mobile/src/services/mock/timeline.ts`; `status.py` the single status-change functions writing `activity_log`), `app/seed.py` (the Seed section above; `reset_db()`), `app/auth.py` (OTP demo `123456`, phone regex `^01[0125]\d{8}$` stored `+20…`, JWT HS256 with `sub`, `role`, `department`; `current_user`, `require_staff`, `require_admin`), `app/routers/auth.py` (`/auth/otp` 204, `/auth/verify`, `/auth/staff-login` 401 `"البريد أو كلمة السر غلط"`, `/auth/me`), `scripts/reset_demo.py`, `.env.example`, `README.md` (run: `uv sync && uv run uvicorn app.main:app --reload --port 8000`; test: `uv run pytest`). Tests use a fresh temp SQLite DB per test session. Tests: priority (port every case in `apps/mobile/src/logic/__tests__/priority.test.ts`), duplicates distance, ids, seed counts and invariants (10 mobile incidents present with same ids/titles), auth flows (otp/verify, staff login ok/bad, role in token, 401 without token).

## Task 2 — Backend citizen routes

`app/routers/{reports,incidents,map,service_requests,triage,uploads}.py` per the contract, using Task 1's logic. `POST /reports` validation (category + ≥1 photo or description ≥10 chars → 400 `"اكتب وصف أو صوّر المشكلة"`), linking (`linkToIncidentId`) adds follower, else new incident with priority + `received` timeline entry; `isFollowing` per caller; `/incidents` public fields only; follow idempotent; `/map/incidents` filters incl. bbox; triage keyword fallback port of `apps/mobile/src/logic/triage-mock.ts` + duplicates/alreadyReported from DB; uploads stub. Tests for each endpoint incl. 403 on someone else's report and the follow idempotency.

## Task 3 — Backend admin routes

`app/routers/admin.py` (+ `app/logic/budget.py`, `app/logic/dashboard.py`, `app/logic/insights.py`) implementing every staff/admin endpoint listed above with role rules (staff: own department only, budget/demo-reset admin only → 403; citizen token on any `/admin/*` → 403). Tests: dashboard numbers against seed invariants, PATCH requires note on status change and the citizen `GET /incidents/{id}` timeline shows the note (the round-trip), work order create moves incident to assigned, work order done resolves incident, merge moves reports/followers and closes source, budget optimizer optimality on a small hand-checked case + never exceeds budget + reasons present, service request patch, staff 403 on other department.

## Task 4 — Admin web scaffold, shell, data layer, login

`apps/admin-web`: Next.js (App Router, TS, Tailwind v4, ESLint, `src/` dir), port 3001 (`dev`/`start` scripts `-p 3001`), `<html lang="ar" dir="rtl">`, fonts via `next/font/google`, `ftc.css` + theme from the design spec, `@tanstack/react-query`, `zod`, `vitest`. Copy unchanged from `apps/mobile/src`: `domain/types.ts`, `domain/categories.ts`, `logic/priority.ts`, `utils/time.ts`, `utils/geo.ts`, `utils/digits.ts` (keep the `@/` alias mapping to `src/`). `src/domain/admin-types.ts` with the shapes above. `src/lib/format.ts` per design spec formatting helpers (Western digits) with vitest tests. `src/lib/http.ts` (like mobile http: Bearer, `Accept-Language: ar`, 204, `{detail}`, 401 → sign out + redirect `/login`, 403 → `"مش مسموح"`; supports GET/POST/PATCH). `src/services/*.ts` typed API functions for every endpoint. `src/lib/session.ts` (token in localStorage, `useSession`). Icon component from `icon-shapes.ts`. AppShell + Sidebar (nav: نظرة عامة `/`, البلاغات `/incidents` with count, الخريطة `/map`, طلبات الخدمات `/service-requests` with count, أوامر الشغل `/work-orders`, الميزانية `/budget` (admin only); user block; sign out). Route guard: unauthenticated → `/login`. `/login` page 1:1 with `Login.html` working against the backend. Placeholder pages for the other 7 routes inside the shell.

## Task 5 — UI kit

Every component in the design spec inventory under `src/components/ui/`, and a `/dev/kit` page rendering each in all states. Vitest + Testing Library tests for StatusChip labels/colours, PriorityBreakdown sums, Drawer/Modal keyboard (Esc closes, focus trap), DataTable sorting.

## Task 6 — Incidents queue + incident detail

`/incidents` per `Incidents.html` (KPIs, filter chips, priority-sorted table, side panel with priority breakdown + work-order summary on row select, search). `/incidents/[id]` per `IncidentDetail.html` (header, photo placeholders + blurred notice, AI suggestion card with confirm/change, details, priority factors with reasons, linked reports, status change form with REQUIRED note + citizen preview, work-order panel (create if none / show if exists), timeline, similar/duplicate merge suggestion with confirm modal). React Query; mutations invalidate queries; toasts.

## Task 7 — Overview dashboard

`/` per `Overview.html`: range tabs (النهارده / آخر 7 أيام / الشهر → `range`), 4 KPIs, open-by-category bars, status stack bar + legend, overdue list, departments workload table, map preview, activity feed, AI insight card from `/admin/insights`.

## Task 8 — Map + service requests

`/map` per `Map.html` with `react-leaflet` + OSM tiles (client-only dynamic import), status-coloured pins, cluster counts, filters (status, category, department, period), legend, selected incident card linking to detail. `/service-requests` per `ServiceRequests.html`: KPIs, filter chips + selects, table, detail panel with schedule (day/slot), assign, status change with note.

## Task 9 — Work orders + budget

`/work-orders` per `WorkOrders.html`: kanban 4 columns by `WorkOrderStatus`, department filter chips, card → drawer with details, task checklist (PATCH tasks), status stepper (PATCH with note), updates. `/budget` per `Budget.html` (admin only; staff see no-permission state): budget slider (1k step, 50k–600k) + presets (تقشّف 150 ألف, الحالية 300 ألف, بدون حد), run optimizer (debounced on change), summary metrics, selected vs skipped lists with reasons, "حوّل الخطة لأوامر شغل" → `/admin/budget/commit` with confirm modal.

## Task 10 — E2E, CI, docs

Playwright (`apps/admin-web/e2e/`) running against a real backend started from `backend/` (playwright `webServer` for both): login → open top incident → confirm AI → create work order → change status to in_progress with note → assert citizen `GET /incidents/{id}` (via API with citizen token) shows the note → budget plan within budget → commit. `.github/workflows/admin-web-ci.yml` (typecheck, lint, vitest, build) and `.github/workflows/backend-ci.yml` (pytest). Update `apps/admin-web/README.md`, `backend/README.md`, root README status rows, `docs/api-contract.md` (mark admin endpoints/shapes as implemented, add the admin shapes), `docs/progress-log.md` entry.

## Amendments (from D1 design spec, binding for Tasks 3–9)

- A1. `GET /admin/teams` → `{ name, department, size }[]` from the seeded teams constant.
- A2. `GET /admin/incidents` with no `status` filter returns ALL incidents (open + resolved + closed); the Map page and queue filter client-side or via query.
- A3. `PATCH /admin/service-requests/{id}` and `PATCH /incidents/{id}` with only `note` (no status) append a timeline entry with the current status and that note.
- A4. Priority factor "why" texts are generated client-side (design spec `factorWhy`); backend unchanged.
- A5. Photos stay placeholders (no photo URLs on `LinkedReport`).
- A6. Amendment A6 (rebrand): demo emails are now `@cityfix.demo` (e.g. `admin@cityfix.demo`, `roads@cityfix.demo`); any `@fixthecity.demo` address earlier in this plan means the `@cityfix.demo` one.
