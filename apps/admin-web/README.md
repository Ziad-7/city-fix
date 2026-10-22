# CityFix — City Command Center (`apps/admin-web`)

The desktop dashboard for district staff: overview, incident queue sorted by priority, incident detail (status change with a note the citizen reads), work orders, service requests, live map and the repair budget planner. Arabic (Egyptian), right to left. It talks to the FastAPI backend in `backend/` (`/auth/staff-login`, `/incidents`, `/admin/*`, see [`docs/api-contract.md`](../../docs/api-contract.md)).

Next.js 16 (App Router) · TypeScript · Tailwind v4 + the design tokens in `src/app/ftc.css` · TanStack Query · Leaflet · zod · zustand (shared `usePrefs`) · Vitest · Playwright.

## Run it

Start the backend first (it seeds demo data on an empty DB):

```bash
cd backend && uv sync && uv run uvicorn app.main:app --reload --port 8000
```

Then the dashboard:

```bash
cd apps/admin-web
npm ci
npm run dev        # http://localhost:3001
```

Port `3001` is the documented default. If something else already holds it, run `npx next dev -p 3002` instead (the backend accepts any localhost port for CORS).

| Env var | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL, inlined at build time |

### Demo accounts

| Who | Sign in | Sees |
| --- | --- | --- |
| Admin (سارة محمود) | `admin@cityfix.demo` / `FixCity2026!` | everything, budget, demo reset |
| Roads staff (م. هشام عادل) | `roads@cityfix.demo` / `FixCity2026!` | only `صيانة الطرق` data |

Other departments: `sanitation@`, `lighting@`, `sewage@`, `water@`, `electricity@`, `parks@`, `utilities@`, `veterinary@` (`@cityfix.demo`, same password). The citizen demo account for the round trip is `01012345678` / code `123456`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on 3001 |
| `npm run build && npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next rules) |
| `npm test` | Vitest (189 tests: logic, services, components, pages) |
| `npm run e2e` | Playwright (13 tests), see below |
| `npm run check:shared` | Fails if the copied mobile code drifted from `apps/mobile/src` |

## End-to-end tests

`npx playwright test` starts its own backend (port 8020, throwaway `backend/_e2e.db`, needs `uv`) and its own web server (`next dev -p 3120`; on CI `next build && next start`). Install the browser once with `npx playwright install chromium`. Do not run `npm run dev` from this folder at the same time as the e2e run: Next allows one dev server per directory.

## Shared code

`src/domain/{types,categories}.ts`, `src/logic/priority.ts`, `src/utils/{time,geo,digits}.ts` are **unchanged copies** from `apps/mobile/src`, together with the two small files they import (`src/store/usePrefs.ts`, `src/i18n/labels.ts`). Change them in the mobile app first, then copy again; `npm run check:shared` (run by CI) reports drift. `src/platform/async-storage.ts` stands in for the React Native storage package (aliased in `tsconfig.json` and `vitest.config.ts`). Admin-only types live in `src/domain/admin-types.ts`.

## Brand

Name and logo follow [ADR 0003](../../docs/decisions/0003-rename-to-cityfix.md): CityFix / سيتي فيكس, assets in `public/brand/cityfix-*.svg`. The internal `--ftc-` CSS prefix stays on purpose.
