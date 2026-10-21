# Role brief — Citizen web portal

**Owner:** _[name]_ · **Folder:** `apps/web` · **Branch:** `feat/citizen-web` · **Can start now:** yes, on mock data

## Your mission

Build the **citizen website** for FixTheCity: the same things a citizen can do in the mobile app (report a problem, follow it, book a city service, see the map), in the browser, for people on a laptop or who don't want to install an app.

You work **in parallel** with the mobile app and the backend, and you all meet at one place: [`docs/api-contract.md`](../api-contract.md). The website and the mobile app talk to **the same backend** with the **same endpoints, shapes and token**. A report sent from the phone shows up on the website for the same phone number, and the other way round.

## 1. Design: use the same design as the mobile app (required)

The website is the **same product** as the mobile app, not a new look. Someone who uses both must feel it is one app. So:

- **Same brand, nothing new.** Use the files we already have:
  - [`docs/design/identity.html`](../design/identity.html): the visual identity guide (colours, type, components, per-surface rules, Tailwind theme). Read it first; it is the single source of rules.
  - [`docs/design/css/fixthecity.css`](../design/css/fixthecity.css): the shared `--ftc-*` variables and `.ftc-*` components the mockups use.
  - [`docs/design/brand-book.md`](../design/brand-book.md): brand idea, voice, Egypt rules, component specs.
  - [`docs/design/tokens.json`](../design/tokens.json): the source of truth for colours, fonts, sizes, spacing, radii, shadows. Turn it into Tailwind theme values / CSS variables. Don't hand-pick colours.
  - [`docs/design/screens/*.html`](../design/screens/): the mockups (`mobile/` for the phone, `web/` for the website — your pages must match `web/`). Open them in a browser (links in [`docs/design/README.md`](../design/README.md)).
  - [`docs/design/assets/`](../design/assets/): the logo lockups, the mark and the Cairo skyline SVG. Use these files; don't redraw them.
  - The running mobile app is the live reference: `cd apps/mobile && npx expo start --web` and compare side by side.
- **Colours:** Egyptian flag palette only: red `#C8102E` (deep `#8E0A20`, soft `#FBE4E7`), gold `#D4A20B` for the main "report" action, ink `#161616`, paper `#F8F6F2` page background, white cards, line `#E6E1D8`. Status chips use the same status colours as the app (`apps/mobile/src/theme/tokens.ts`).
- **Fonts:** Readex Pro (headings, numbers), IBM Plex Sans Arabic (body), Aref Ruqaa (short slogans and greetings only, max 6 words, never buttons, forms or numbers). From Google Fonts via `next/font`.
- **Same components, same look:** buttons, cards, status chips, the "خطر" danger tag, choice chips, toggles, the priority strip with reasons, the RTL timeline, the medal, the hotline buttons. Copy the look from `apps/mobile/src/components/ui/` and `components/brand/` (sizes, radii, colours, states), rebuilt as React DOM components.
- **Same words:** Egyptian Arabic copy, exactly as in the app (button labels, empty states, errors, "تسلم إيدك!", "أنا كمان", "نفس المشكلة، تابعها"). Copy the strings from the mobile screens; don't rewrite them.
- **Same icons:** take the SVG paths from `apps/mobile/src/components/Icon.tsx`.
- **RTL everywhere:** `<html lang="ar" dir="rtl">`, logical CSS (`ms-/me-`, `ps-/pe-`, `start/end`), Arabic-Indic digits where the app uses them (`utils/digits.ts`).
- **No new style ideas:** no Islamic patterns, no Ramadan themes, no other colour schemes, no dark mode for now. If a web page needs something the design doesn't cover (e.g. a wide desktop layout), keep to the same tokens and components and show it to Abood before merging.

**Web layout rule:** on a phone-size screen the website looks like the mobile app (same screens, bottom tab bar with the gold report button). On desktop, keep the same cards and colours in a centred column (max ~1100 px) with a top navigation bar instead of the bottom tabs; the map page can go full width.

## 2. Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS.** Optional: shadcn/ui primitives, restyled with our tokens.
- **Map:** Leaflet + OpenStreetMap tiles (`react-leaflet`), no API key. Pins coloured by status, a "خطر" alert marker for critical ones, like the app.
- **Forms/validation:** zod (the same schemas as the app).
- **State:** zustand (same as the app) or React Query; your choice, keep it simple.
- **Tests:** Vitest for logic, Playwright for the main flows.
- Deploy previews on **Vercel**.

## 3. Pages (mirror the mobile screens)

| Route | Mobile equivalent | Mockup | What it does |
| --- | --- | --- | --- |
| `/sign-in` | `sign-in.tsx` | [web/SignIn.html](../design/screens/web/SignIn.html) | +20 phone, SMS/WhatsApp code (demo `123456`), governorate/district |
| `/` | `(tabs)/index.tsx` | [web/Home.html](../design/screens/web/Home.html) | Greeting, red hero + skyline, service tiles, "حوالين بيتك" with "أنا كمان", latest updates, emergency numbers |
| `/report/category` | `report/category.tsx` | [web/Category.html](../design/screens/web/Category.html) | Emergency box, 12 categories with "خطر" tags, utility hotlines |
| `/report/new` | `report/new.tsx` | [web/Report.html](../design/screens/web/Report.html) | Photo upload (file picker; camera on phones via `accept="image/*" capture`), description, AI suggestion card, location (browser geolocation + Leaflet pin picker), landmark, privacy toggles, duplicate panel + "already reported" note |
| `/report/success` | `report/success.tsx` | [web/Success.html](../design/screens/web/Success.html) | "تسلم إيدك!", report number, medal progress, share |
| `/requests` | `(tabs)/requests.tsx` | [web/Requests.html](../design/screens/web/Requests.html) | My reports and service requests, filters |
| `/requests/[id]` | `requests/[id].tsx` | [web/Track.html](../design/screens/web/Track.html) | Summary, priority strip with reasons, timeline, share |
| `/services`, `/services/bulky-waste` | `services/*` | [web/Services.html](../design/screens/web/Services.html) | CityServe catalog, bulky-waste booking (items, working day, slot, payment) |
| `/map` | `(tabs)/map.tsx` | [web/Map.html](../design/screens/web/Map.html) | CityPulse map with status/category filters and a pin card |
| `/profile` | `(tabs)/profile.tsx` | [web/Profile.html](../design/screens/web/Profile.html) | Name, area, toggles, stats and medal, sign out |

Same rules as the app: report = category + (photo **or** 10+ characters); your own nearby reports never appear as "join this"; "متابع" state is the same everywhere; critical items show "خطر".

## 4. Sharing code with the mobile app

The business logic already exists and is tested in `apps/mobile/src`. **Don't rewrite it.** These files have no React Native imports and work in the browser as they are:

- `domain/`: `types.ts`, `categories.ts`, `hotlines.ts`, `locations.ts`, `services-catalog.ts`, `schemas.ts`, `medals.ts`
- `logic/`: `priority.ts`, `duplicates.ts`, `triage-mock.ts`
- `utils/`: `digits.ts`, `time.ts`, `geo.ts`

**This week:** copy them into `apps/web/src/shared/` unchanged (keep the same file names and the `@/utils/...` import paths by setting the `@/` alias, or adjust only the import lines). Add `scripts/check-shared.sh` that diffs your copy against `apps/mobile/src` and run it in CI, so the two never drift. If you need to change one of them, change it in the mobile app by PR and copy it again.

**Later (after the demo):** we move them to `packages/shared` and both apps import from there.

Not shareable: `services/mock/db.ts` (uses AsyncStorage). Write a web version with `localStorage` and the same seed data.

## 5. Data layer: same backend, same contract

Copy the mobile app's approach exactly:

- The same service interfaces as `apps/mobile/src/services/interfaces.ts`: `AuthService`, `IncidentService`, `ServiceRequestService`, `TriageService`.
- **Mock mode first** (`NEXT_PUBLIC_API_MODE=mock`, default): localStorage, seeded with the same 10 incidents around Nasr City, demo OTP `123456`. You can build every page before the backend exists.
- **API mode** (`NEXT_PUBLIC_API_MODE=api`, `NEXT_PUBLIC_API_URL=https://…`): `fetch` following `docs/api-contract.md`. Port `apps/mobile/src/services/api/http.ts`:
  - `Authorization: Bearer <token>` from `/auth/verify`, `Accept-Language: ar`.
  - `204` returns nothing; errors show `{ "detail" }` or a friendly Arabic line, never "HTTP 500".
  - `401` signs the user out with a notice.
- Token storage: `localStorage` is fine for the demo. Mention it in your README as a known gap.
- **Photos:** the browser can't send local file URIs. Use the contract's upload flow: `POST /uploads/sign` → `PUT` the file to `uploadUrl` → send `path` in `photoUris`. In mock mode keep the image as a data URL / object URL. Agree the details with the backend owner (the mobile app needs the same flow).

**Never** add a web-only endpoint or a different shape. If the website needs something new, open a PR on `docs/api-contract.md` and tag the backend and mobile owners.

## 6. What the backend owner adds for you

Already in their brief; check with them:

- **CORS** for your origins: `http://localhost:3000` and the Vercel domains.
- `/uploads/sign` working from the browser (Supabase Storage signed upload URLs allow `PUT` from the browser).
- The same demo account works on both clients.

## 7. Work plan

| # | Step | Done when |
| --- | --- | --- |
| 1 | Scaffold `apps/web` (Next.js, TS, Tailwind, ESLint), RTL root layout, fonts, tokens from `tokens.json` | Blank page in Arabic RTL with our fonts and colours |
| 2 | UI kit matching the app: Button, Card, StatusChip, Chip, TextField, Select, Toggle, ProgressBar, Logo, Skyline, Medal, Icon, layout (bottom tabs on mobile, top bar on desktop) | A `/dev/kit` page showing every component next to the mockups |
| 3 | Shared code copied + `check-shared.sh`; mock services with localStorage; stores | Logic tests pass in Vitest |
| 4 | Sign-in + protected routes | Sign in with `01012345678` / `123456` |
| 5 | Home + category + report form + success | Send a report end to end in mock mode, with duplicate panel |
| 6 | My requests + tracking detail | The report from step 5 shows with its timeline |
| 7 | Services + bulky-waste booking | A booking lands in my requests |
| 8 | Map + profile | Pins, filters, pin card; sign out |
| 9 | API mode against the real backend (+ upload flow) | Same flow works with the backend; a report sent from the phone appears on the website |
| 10 | CI (`.github/workflows/web-ci.yml`: typecheck, lint, test, shared check) + Vercel deploy | Preview URL in your README |

## 8. Acceptance checks

- Side by side with the mobile app (phone width), every page matches in colours, fonts, spacing, copy and icons.
- Fully RTL; works on Chrome, Safari (iPhone) and Firefox; usable at 360 px wide and on desktop.
- Lighthouse accessibility ≥ 90; every input has a label; focus is visible; colour is never the only signal (status chips carry text).
- In API mode, one account sees the same reports on the phone and on the website.
- No secrets in the repo: only `NEXT_PUBLIC_API_MODE` and `NEXT_PUBLIC_API_URL` on the client. The Supabase service-role key never goes into the website.

## 9. Rules

- Work only in `apps/web` (plus `web-ci.yml`). Don't edit `apps/mobile` or `backend/` in your PRs. Ask the owner instead.
- Small PRs into `main` with "how to test" and screenshots next to the matching mockup.
- Add an entry to [`docs/progress-log.md`](../progress-log.md) when a step lands.
- Claude reviews your PRs for design match, contract match and the business rules above.
