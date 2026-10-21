# Fix the City — citizen website (`apps/web`)

The browser version of the citizen app: report a problem, follow it, book a CityServe service, browse the map. It mirrors the mobile app screen for screen and follows the web mockups in [`docs/design/screens/web/`](../../docs/design/screens/web/). Brief: [`docs/team/citizen-web-portal.md`](../../docs/team/citizen-web-portal.md).

Next.js (App Router) · TypeScript · Tailwind v4 · Leaflet + OpenStreetMap · zod · zustand · Vitest · Playwright. Arabic, right to left.

## Run it

```bash
cd apps/web
npm install
cp .env.example .env.local   # optional, mock mode is the default
npm run dev                  # http://localhost:3000
```

Sign in with any valid Egyptian mobile number (for example `01012345678`) and the code `123456`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next rules) |
| `npm test` | Vitest: the shared domain/logic tests plus the web services and store |
| `npm run test:e2e` | Playwright, desktop and phone widths, in mock mode |
| `npm run check:shared` | Fails if the copied mobile code has drifted (see below) |

## Modes

| `NEXT_PUBLIC_API_MODE` | Behaviour |
| --- | --- |
| `mock` (default) | Everything runs in the browser. Demo incidents are seeded into `localStorage` (`ftc.mock.db.v1`); "simulate progress" on the tracking page moves a report along. |
| `api` | Calls the FastAPI backend at `NEXT_PUBLIC_API_URL`, following [`docs/api-contract.md`](../../docs/api-contract.md). |

## Pages

| Route | Screen |
| --- | --- |
| `/sign-in` | Phone number and code |
| `/` | Home: greeting, nearby incidents, my latest updates |
| `/report/category` → `/report/new` → `/report/success` | Category, report form (photo, location, details, duplicate check), confirmation |
| `/requests`, `/requests/[id]` | My requests and the tracking timeline |
| `/services`, `/services/bulky-waste` | CityServe and the bulky-waste booking |
| `/map` | Incident map with category filters and pin cards |
| `/profile` | Name, area, sign-out |

Everything except `/sign-in` sits in the `(portal)` route group, which sends signed-out visitors to sign-in and brings them back afterwards.

## Folder layout

```
src/
  app/          routes (App Router)
  shared/       code copied unchanged from apps/mobile/src: domain, logic, utils, components/*.ts
  services/     mock and API services (same interface as mobile; storage swapped for localStorage)
  store/        zustand stores (session persisted in localStorage)
  ui/           web components (shell, controls, map, chips, rows)
  lib/          browser helpers (location, photo, share, boot)
  styles/       design tokens and the mockup CSS
e2e/            Playwright specs
scripts/        check-shared.sh
```

## Shared code rule

`src/shared/` and parts of `src/services` and `src/store` are byte-for-byte copies of the mobile app's code, so both apps validate, triage and format the same way. **Change them in `apps/mobile` first (by PR), then copy them here.** `npm run check:shared` (also in CI) fails on any drift. The only files that differ on purpose are the platform ones: `services/index.ts`, `services/api/http.ts` (`NEXT_PUBLIC_` env names), `services/mock/db.ts` and `store/useSession.ts` (localStorage instead of AsyncStorage), and `services/api/upload.ts` (browser photo upload).

## Deploying

Vercel works out of the box: set the project root to `apps/web`, and set `NEXT_PUBLIC_API_MODE` (and `NEXT_PUBLIC_API_URL` for `api`). No secrets are needed for mock mode.

## Known gaps

- The session token is kept in `localStorage`. An httpOnly cookie needs backend support.
- The voice note button is a stub ("قريبًا") until the backend has `/ai/transcribe`.
- No offline queue: a report sent with no connection fails with a retry message.
- No reverse geocoding: using GPS fills in "موقعك الحالي" rather than a street name.
- Photo upload in API mode follows the proposed `/uploads/sign` contract, which the backend has not built yet.
- API mode is untested (no backend yet).
