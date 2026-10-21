# Role brief — Admin web: City Command Center (Member 3)

**Owner:** _[member name]_ · **Folder:** `apps/admin-web` · **Branch prefix:** `feat/admin-…` (e.g. `feat/admin-incidents`) · **Starts:** now, on mock data

## Your mission

Build the **City Command Center**: the website that district staff use on a desktop to see every report, decide what to fix first, send crews, tell citizens what is happening, and plan repairs within a limited budget.

It runs on **the same backend** as the citizen mobile app and the citizen website ([`docs/api-contract.md`](../api-contract.md)) plus the `/admin/*` routes. When staff change a status here, the citizen sees it in their timeline on the phone and on the website. That round trip is the heart of the demo.

**Done means:** a staff member signs in, opens the most urgent incident, confirms the AI suggestion, creates a work order, moves it to "in progress" with a note to citizens, and builds a budget plan, on the deployed backend, with the screens matching the designs.

## 1. Design: the admin designs are the spec (required)

- **Screens to build, 1:1:** [`docs/design/screens/admin/`](../design/screens/admin/): `Login`, `Overview`, `Incidents`, `IncidentDetail`, `Map`, `ServiceRequests`, `WorkOrders`, `Budget`. Open them in a browser through [`docs/design/index.html`](../design/index.html) (online preview links are in [`docs/design/README.md`](../design/README.md)).
- **Rules:** [`docs/design/identity.html`](../design/identity.html) is the single source of rules, especially its "Admin web" surface section. Use the shared variables and components in [`docs/design/css/fixthecity.css`](../design/css/fixthecity.css) and the Tailwind theme snippet from the identity guide. [`docs/design/tokens.json`](../design/tokens.json) is the source of truth for values.
- **Admin look:** ink (`#161616`) sidebar, gold active item with ink text, red primary buttons, white cards and tables on paper. Desktop-first (1280–1440 px); it must not break on a tablet.
- **Same product as the citizen apps:** the same status chips and colours, the "خطر" tag, the priority breakdown, the timeline and the icons (SVG paths from `apps/mobile/src/components/Icon.tsx`). A status means the same colour and word everywhere.
- **Admin-specific rules:** Western digits in tables and data (`128`, `1,800 جنيه`); real Egyptian bodies (الحي، هيئة النظافة والتجميل، شركة مياه الشرب، إنارة الحي، حدائق الحي), with external bodies tagged "جهة خارجية" and their hotline.
- **Privacy:** never show a citizen's name or phone. Reporters appear as "مواطن" or "بلاغ بدون اسم". Photos are the blurred copies.
- **AI is a suggestion:** label it "اقتراح الذكاء الاصطناعي", with confirm and change buttons. Duplicate merges need a human click.
- **No new style ideas:** no other colours, no gradients, no dark mode, no Islamic or Ramadan motifs, no religious phrases.

## 2. Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS**, `<html lang="ar" dir="rtl">`, fonts Readex Pro + IBM Plex Sans Arabic via `next/font`. Optional shadcn/ui primitives, restyled with our tokens.
- Tables: TanStack Table. Charts: a light library (Recharts) styled with the tokens, with visible labels and values.
- Map: Leaflet + OpenStreetMap (`react-leaflet`), pins in status colours, the same as the citizen website.
- State/data: React Query (or zustand) over typed services. Forms: zod.
- Tests: Vitest for logic, Playwright for the main flows. Deploy on Vercel. Runs on port `3001` locally (the citizen website uses `3000`).

## 3. Pages

| Route | Design | What it does | API |
| --- | --- | --- | --- |
| `/login` | `Login.html` | Staff email + password, district | `POST /auth/staff-login` *(proposed)* |
| `/` | `Overview.html` | KPIs (open, overdue, resolved this week, average time), reports by category, SLA overdue list, department workload, map preview, activity feed; AI weekly insight card (stretch) | `GET /admin/dashboard`, `GET /admin/insights` *(proposed)* |
| `/incidents` | `Incidents.html` | Queue sorted by priority, filters (status, category, department, critical), side panel with priority breakdown and work-order summary | `GET /incidents` (admin view) |
| `/incidents/[id]` | `IncidentDetail.html` | Photos (blurred), AI suggestion with confirm/change, priority factors with reasons, linked reports, status change + note to citizens, work-order panel, timeline, duplicate merge suggestion | `GET /incidents/{id}`, `PATCH /incidents/{id}`, `POST /admin/work-orders`, `POST /admin/incidents/{id}/merge` *(proposed)* |
| `/map` | `Map.html` | Operations map with filters, clusters, legend, selected-incident card | `GET /map/incidents` |
| `/service-requests` | `ServiceRequests.html` | CityServe queue (bulky waste, trees), schedule a truck, assign | `GET /admin/service-requests`, `PATCH /admin/service-requests/{id}` *(proposed)* |
| `/work-orders` | `WorkOrders.html` | Kanban by status, department filter, work-order drawer | `GET/PATCH /admin/work-orders` |
| `/budget` | `Budget.html` | Budget input (EGP), run the optimizer, selected vs skipped with one-line reasons, "turn the plan into work orders" | `POST /admin/budget/optimize` (built by Member 5) |

Roles: `staff` sees and updates their department's incidents; `admin` sees everything and runs the budget. Hide what a role can't do.

## 4. Data layer: same approach as the citizen apps

- Copy the shared, React-Native-free files from `apps/mobile/src` unchanged: `domain/types.ts`, `domain/categories.ts`, `logic/priority.ts`, `utils/time.ts`, `utils/geo.ts`, `utils/digits.ts` (same list and CI diff check as the citizen website, see [`citizen-web-portal.md`](citizen-web-portal.md) §4). Add admin-only types (`WorkOrder`, `DashboardStats`, `BudgetPlan`) in `apps/admin-web/src/domain/admin-types.ts` and mirror them into the contract.
- Typed services (`AdminIncidentService`, `WorkOrderService`, `ServiceRequestAdminService`, `BudgetService`, `AuthService`) with **mock** implementations first (`NEXT_PUBLIC_API_MODE=mock`, seeded with the same Nasr City incidents as `apps/mobile/src/services/mock/seed.ts`), then **API** implementations (`NEXT_PUBLIC_API_MODE=api`, `NEXT_PUBLIC_API_URL`).
- HTTP like the mobile client (`apps/mobile/src/services/api/http.ts`): Bearer token, `Accept-Language: ar`, handle `204`, show `{ "detail" }`, sign out on `401`, "مش مسموح" on `403`.
- **The status change is the most important call:** `PATCH /incidents/{id}` with `status` + `note`. The note is what citizens read in their timeline, so the form must require it for every status change and show a preview.

## 5. Work plan

| # | Step | Done when |
| --- | --- | --- |
| 1 | Scaffold `apps/admin-web` (Next.js, TS, Tailwind, ESLint), RTL layout with the ink sidebar, fonts, tokens | Empty shell matches the sidebar in the designs |
| 2 | UI kit: table, KPI card, status chip, priority breakdown, timeline, filters, drawer, form fields | `/dev/kit` page next to the designs |
| 3 | Shared code + mock services + login (mock) | Sign in with the demo staff account |
| 4 | Incidents queue + incident detail (status change with note, work order) | The full triage flow works on mock data |
| 5 | Overview dashboard | KPIs and charts from mock data |
| 6 | Map, service requests, work orders | All 8 pages built |
| 7 | Budget page (mock optimizer, then Member 5's endpoint) | A plan within budget, with reasons |
| 8 | API mode against the deployed backend | A status change here shows in the citizen's timeline on the phone |
| 9 | CI (`.github/workflows/admin-web-ci.yml`: typecheck, lint, test, shared check) + Vercel deploy | Preview URL in your README |

## 6. Acceptance checks

- Each page side by side with its design: same layout, colours, fonts, copy, icons.
- Fully RTL; keyboard usable (tables, drawer, forms); focus visible; Lighthouse accessibility ≥ 90.
- No citizen names or phones anywhere; no service-role key in the app (only `NEXT_PUBLIC_API_MODE`, `NEXT_PUBLIC_API_URL`).
- End-to-end: citizen reports on mobile → appears in the queue → staff changes status with a note → the citizen sees the note.

## 7. Who you work with

- **Member 4 (API & DB):** staff login, `/admin/*` endpoints, demo staff/admin accounts, deployed URL. Ask for any missing endpoint by PR to the contract.
- **Member 5 (AI):** budget optimizer, triage payload on incidents, insights.
- **Member 2 (citizen web):** share UI decisions so both websites build components the same way. The Tailwind theme and icon set should be identical.
- **Claude (with Abood):** reviews your PRs for design match, contract match and privacy rules.
