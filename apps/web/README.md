# CityFix — citizen website (`apps/web`)

The browser version of the citizen app: report a problem, follow it, book a CityServe service, browse the map. It mirrors the mobile app screen for screen and follows the web mockups in [`docs/design/screens/web/`](../../docs/design/screens/web/). Brief: [`docs/team/citizen-web-portal.md`](../../docs/team/citizen-web-portal.md).

Next.js (App Router) · TypeScript · Tailwind v4 · Leaflet + OpenStreetMap · zod · zustand · Vitest · Playwright. Arabic (right to left) by default, English as a second language.

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
| `/services`, `/services/bulky-waste`, `/services/tree`, `/services/garbage-schedule` | CityServe, the bulky-waste booking, the free tree-trimming booking and the garbage collection schedule |
| `/services/recycling` | CityCycle recyclables pickup: materials and kg, free or paid with an EGP estimate, photo with AI suggestion, place, day and slot, voice note |
| `/impact` | My recycling impact (kg, EGP; CO₂ only when the backend sends a verified figure) |
| `/recycling-guide` | Picture sorting guide, printable; open without signing in |
| `/map` | Incident map with category filters and pin cards, and a smart-bin layer with "report full" |
| `/notifications` | Notifications, reached from the bell in the top bar |
| `/profile` | Name, area, language (Arabic / English), CityCycle links, a collector card that points to the app, sign-out |

Pickups appear in `/requests` under the Recycling filter (`RCY-` ids). Everything except `/sign-in` and `/recycling-guide` sits in the `(portal)` route group, which sends signed-out visitors to sign-in and brings them back afterwards. Collector mode is not on the web; collectors use the app.

## Languages

Arabic (right to left) is the default; English (left to right) is a second language, chosen from the sign-in link, the top-bar toggle or the profile. The choice is saved in `localStorage` (`ftc.prefs.v1`) and `<html lang dir>` is set before the first paint. Strings are written inline as `tr('عربي', 'English')` exactly like the mobile app, with domain labels in `src/i18n/labels.ts`; use the bilingual helpers (`localDigits`, `formatDate`, `relativeTime`) rather than the `*Ar` variants.

## Folder layout

```
src/
  app/          routes (App Router)
  shared/       code copied unchanged from apps/mobile/src: domain, logic, utils, components/*.ts
  services/     mock and API services (same interface as mobile; storage swapped for localStorage)
  store/        zustand stores (session persisted in localStorage)
  ui/           web components (shell, controls, map, chips, rows)
  lib/          browser helpers (location, photo, voice, share, boot, page titles)
  platform/     browser stand-ins for the native modules the shared code imports (AsyncStorage, image manipulator)
  styles/       design tokens and the mockup CSS
e2e/            Playwright specs
scripts/        check-shared.sh
```

## Shared code rule

`src/shared/` and parts of `src/services` and `src/store` are byte-for-byte copies of the mobile app's code, so both apps validate, triage and format the same way. **Change them in `apps/mobile` first (by PR), then copy them here.** `npm run check:shared` (also in CI) fails on any drift, on a pure mobile helper in `components/` that has no copy here (it walks the mobile side), and on a copy with no mobile original. `.github/workflows/web-ci.yml` lists exactly the mobile paths the script compares, so a mobile change to one of them runs the website's checks.

The only files that differ on purpose are the platform ones: `services/index.ts`, `services/network.ts`, `services/api/http.ts` and `services/api/uploads.ts` (`NEXT_PUBLIC_` env names, browser `fetch`), `services/mock/db.ts` and `store/useSession.ts` (localStorage instead of AsyncStorage), `store/useOutboxSync.ts` (browser events) with `store/outboxTabs.ts`, and `notifications/os.ts`; plus `platform/*` for the native modules.

## Deploying

Vercel works out of the box: set the project root to `apps/web`, and set `NEXT_PUBLIC_API_MODE` (and `NEXT_PUBLIC_API_URL` for `api`). No secrets are needed for mock mode.

## Report form extras

- **Voice note** (`src/lib/voice.ts`): in API mode the browser records, uploads the clip through the shared `uploadAndTranscribeVoiceNote` (`/uploads/sign`, then `/ai/transcribe`) and fills the description; otherwise it uses the browser's own speech recognition in Egyptian Arabic (Chrome, Edge, Safari), so it works in mock mode too. Firefox in mock mode says it can't record and the citizen types.
- **Photos**: "صوّر المشكلة" opens the camera on a phone (`capture`), "أو من المعرض" is a second input without `capture` so a photo that was already taken can be picked. On a computer both open the file dialog.
- **Offline queue**: the shared outbox (`store/useOutbox.ts`, `store/outboxFlush.ts`, mounted by `store/useOutboxSync.ts`). A report sent with no connection is kept in `localStorage` (`ftc.outbox.v1`) and sent, oldest first, when the browser is back online, on page load and when the tab becomes visible; a banner shows what is waiting. A transient failure keeps the item with an exponential backoff, a 4xx drops it with the server's message, a 401 keeps it until the citizen signs in again. Several tabs share the one queue, so `store/outboxTabs.ts` plugs the shared outbox's cross-tab seam in: only one tab sends at a time (Web Locks, lock `ftc-outbox`), a tab reads the queue from storage again before it sends or queues anything, and it follows the other tabs' writes (the `storage` event). If the disk is full the report is not queued and the form says so. A queue written by the old website build (a plain array under the same key) is converted when it is read (`platform/legacy-outbox.ts`).

### Privacy

- **Location**: a GPS fix is used only to place the pin and is sent only to our own report API with the report. The website does **not** send it to a public street-name service (no reverse geocoding), so the address line shows "موقعك الحالي" until the citizen types the street. Reverse geocoding should go through our backend later (a proposed `GET /geo/reverse?lat&lng`); until then there is no environment variable for it.
- The map tiles come from OpenStreetMap; the browser asks for the tiles of the area on screen (not the GPS fix).
- The only client environment variables are `NEXT_PUBLIC_API_MODE` and `NEXT_PUBLIC_API_URL`.

## Known gaps

- The session token is kept in `localStorage`. An httpOnly cookie needs backend support.
- Photo and voice-note upload in API mode follow the proposed `/uploads/sign` and `/ai/transcribe` contracts, which the backend has not built yet.
- If the server accepts a queued report but the answer is lost, the retry sends it again: preventing that needs an idempotency key in the contract.
- The bell in the header only says that notifications are coming. The shared `useNotifications` store already records status changes; a `/notifications` page (like the app's `notifications.tsx`) is not built yet.
- The website is Arabic only. `src/i18n` and the shared helpers are ready for English, but the website's own text is not translated yet.
- The mock database (`ftc.mock.db.v1`) is read once per tab, so two tabs can overwrite each other's mock data. API mode does not have this problem.
- API mode is untested (no backend yet).
