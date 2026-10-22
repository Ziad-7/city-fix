# CityFix citizen mobile app — implementation spec

This is the brief the implementers work from. The design is final; implement it faithfully.

## Scope

- **In:** the citizen app only (Arabic-first, RTL), running on Android and iOS through **Expo Go**, plus a web build used only for quick visual checks.
- **Out (for now):** the City Command Center (stays a separate Next.js web app — `apps/admin-web`, later), the FastAPI backend (`backend/`, later), real OTP, real AI. Everything backend-facing is **mocked behind typed service interfaces** so the real API can be swapped in on Day 3–4 without touching screens.

## Design sources (in this repo)

| What | Where |
| --- | --- |
| Screen designs (open in a browser; HTML mockups, 390 px wide) | `docs/design/screens/mobile/*.html` |
| Design tokens (colours light/dark, type, spacing, radii, shadows) | `docs/design/tokens.json` |
| Brand book (rules, voice, Egypt specifics, component specs) | `docs/design/brand-book.md` |
| Logo + skyline SVGs | `docs/design/assets/*.svg` |

Screen file → app route:

| Design file | Route | Notes |
| --- | --- | --- |
| `Login.html` | `src/app/sign-in.tsx` | +20 phone, OTP via SMS/WhatsApp (mock), governorate/district, privacy note, data-saver toggle |
| `Main.html` | `src/app/(tabs)/index.tsx` | Home |
| `Category.html` | `src/app/report/category.tsx` | Emergency hotlines, Egyptian categories, voice entry, utility hotlines |
| `Report.html` | `src/app/report/new.tsx` | Photo, AI suggestion, description, location + landmark, privacy toggles, duplicate check |
| `Success.html` | `src/app/report/success.tsx` | "تسلم إيدك!", next steps, جدع الشارع medal |
| `Track.html` | `src/app/requests/[id].tsx` | Detail + status timeline + WhatsApp toggle |
| `Services.html` | `src/app/services/index.tsx` + `src/app/services/bulky-waste.tsx` | Catalog + bulky-waste booking |
| (no mock) | `src/app/(tabs)/requests.tsx` | "طلباتي" list: report + service-request cards with status chips (use the card style from `Main.html` "آخر التحديثات") |
| (no mock) | `src/app/(tabs)/map.tsx` | CityPulse map: status-coloured pins + filter chips |
| (no mock) | `src/app/(tabs)/profile.tsx` | Name/phone, governorate/district, toggles, language, sign out |

`Admin.html` / `Budget.html` are for the future web admin — not part of this app.

## Stack and versions (already installed in `apps/mobile`)

- Expo SDK **57** (pinned to match Expo Go 57 on the team's phones; see [the Expo Go handoff](2026-10-21-expo-go-and-apk-handoff.md)), React Native 0.86.3, React 19.2.3, TypeScript 6, Expo Router 57. Install with `npm ci`; add packages only with `npx expo install`.
- `react-native-svg`, `react-native-maps`, `expo-image-picker`, `expo-location`, `expo-localization`, `expo-font`, `expo-splash-screen`, `@react-native-async-storage/async-storage`, `zustand` 5, `zod` 4.
- Fonts: `@expo-google-fonts/readex-pro`, `@expo-google-fonts/ibm-plex-sans-arabic`, `@expo-google-fonts/aref-ruqaa` — load at runtime with `useFonts` in the root layout and hold the splash screen until loaded. Export names: `ReadexPro_500Medium/600SemiBold/700Bold`, `IBMPlexSansArabic_400Regular/500Medium/600SemiBold/700Bold`, `ArefRuqaa_700Bold`.

## Environment gotchas (verified — read before doing anything)

1. **Expo's version API is blocked** from this sandbox. Always run installs as `EXPO_OFFLINE=1 npx expo install <pkg>` (it uses the SDK's bundled version map). Plain `npm install` works for anything else.
2. **Tabs import:** `import { Tabs } from 'expo-router/js-tabs'` (importing `Tabs` from `'expo-router'` is deprecated). The custom tab bar receives `navigation` (SDK 57 API: `navigation.emit` + `navigation.navigate`). `Stack`, `Link`, `router`, `useLocalSearchParams`, `Redirect` come from `'expo-router'`.
3. **No icon font is installed** (`@expo/vector-icons` is not a dependency). Build a small `Icon` component on `react-native-svg` with Lucide-style 24×24 stroke paths (stroke 1.75, round caps/joins). The SVG paths used in the mockups can be copied straight from `docs/design/screens/mobile/*.html`. Directional icons (arrows/chevrons) must mirror in RTL; objects never mirror.
4. **RTL:** the app is Arabic-only for now. Configure the `expo-localization` plugin in `app.json` with `"forcesRTL": true` and `"supportedLocales": ["ar", "en"]`. Do **not** rely on `I18nManager.forceRTL` at runtime (doesn't work in Expo Go). Write layouts with `flexDirection: 'row'` and let the platform mirror them; use `start`/`end` (not `left`/`right`) for margins/padding/positioning. On **web** only, set `document.documentElement.dir = 'rtl'` and `lang = 'ar'` in the root layout effect so the web preview mirrors too.
5. **Maps:** `react-native-maps` works in Expo Go with no API key; it does not support web. Use platform files: `src/components/map/IncidentMap.native.tsx` (MapView + Markers) and `src/components/map/IncidentMap.web.tsx` (a styled list/placeholder so the web export builds).
6. Entry point: `package.json` `"main": "expo-router/entry"`; routes live in **`src/app/`**; path alias `@/*` → `src/*` in `tsconfig.json` (extend `expo/tsconfig.base`). Keep `typedRoutes` off.
7. Lint/typecheck/tests must pass: `npx tsc --noEmit`, `npx expo lint` (set up ESLint with `eslint-config-expo`, flat config), `npx jest` (use `jest-expo` preset). Web smoke build: `npx expo export --platform web`.

## Architecture

```
apps/mobile/
  app.json, package.json, tsconfig.json, eslint.config.js, jest config
  assets/               icon, splash (brand red #C8102E background)
  src/
    app/                routes only (Expo Router)
      _layout.tsx       fonts + splash + providers + Stack; redirects to /sign-in when no session
      sign-in.tsx
      (tabs)/_layout.tsx  custom tab bar: الرئيسية · الخريطة · [gold Report FAB] · طلباتي · حسابي
      (tabs)/index.tsx, map.tsx, requests.tsx, profile.tsx
      report/category.tsx, report/new.tsx, report/success.tsx
      requests/[id].tsx
      services/index.tsx, services/bulky-waste.tsx
    theme/              tokens.ts (generated by hand from docs/design/tokens.json, light theme), typography helpers
    components/         ui/ (AppText, Button, Card, StatusChip, Chip, TextField, ToggleRow, ProgressBar, Screen, ScreenHeader), brand/ (Logo, Skyline, Medal), Icon, Hotlines, map/
    domain/             types.ts (Incident, Report, ServiceRequest, statuses, Category...), categories.ts, hotlines.ts, locations.ts (governorates → districts), services-catalog.ts
    services/           interfaces.ts (AuthService, IncidentService, ServiceRequestService, TriageService)
                        mock/ (Mock*Service + seed data, persisted with AsyncStorage)
                        api/  (Api*Service using fetch against EXPO_PUBLIC_API_URL — contract from the plan; not wired yet)
                        index.ts  (picks mock vs api from EXPO_PUBLIC_API_MODE, default "mock")
    logic/              priority.ts (deterministic score + factor explanations), duplicates.ts (haversine + same category within 250 m), triage-mock.ts (keyword classifier, Egyptian Arabic keywords → category + severity + top-3 with confidences)
    store/              useSession.ts, useReports.ts … (zustand, persisted)
    utils/              digits.ts (to Arabic-Indic), time.ts (Arabic relative time), geo.ts
```

### Domain (mirror the plan's DB entities so the backend can match)

- `IncidentStatus`: `received | triaged | assigned | in_progress | resolved | closed`. Arabic labels and chip colours from the brand book: received وصل (grey), assigned اتحوّل (blue), in_progress جاري التنفيذ (gold-soft/gold-deep), resolved اتصلّح (green), plus a separate `critical` priority badge (urgent).
- `Report`: id (`FTC-1042` style), reporterId, incidentId, categoryId, description, photoUris[], location {lat, lng, address, landmark}, anonymous, blurFaces, createdAt, voiceNoteUri?.
- `Incident`: id, categoryId, severity (`low|medium|high|critical`), priority {score 0–100, factors: {label, points}[]}, status, department, estimatedCostEgp, linkedReportIds, followers, timeline: {status, note, actor, at}[].
- `ServiceRequest`: id, citizenId, serviceType (`bulky_waste | tree_maintenance | ...`), details (items, day, slot, payment), location, status, timeline.
- `TriageSuggestion`: options [{categoryId, confidence}] (top 3), severity, summary, duplicates [{incidentId, distanceM, followers, status}].

### Behaviour that must work end-to-end on mock data

1. Sign in with a valid Egyptian mobile (`01[0125]` + 8 digits); invalid numbers are rejected inline. "Send code" → code entry (any 6 digits accepted; show "الكود التجريبي: 123456") → governorate/district saved → Home.
2. Home → Report → choose category → photo (camera or gallery; fall back gracefully when permission is denied) → mock AI suggestion appears (top-3 with confidence bars, editable) → description (typed; voice note button may be a stub that records nothing yet, labelled "قريبًا") → location from GPS (fallback to a default Nasr City point with a manual address field) + landmark → duplicate panel if an open incident of the same category is within 250 m ("نفس المشكلة، تابعها" links the report to it and increments followers) → submit → Success → the new report appears at the top of طلباتي with status وصل.
3. Request detail shows the timeline; a dev-only "simulate progress" button (visible in `__DEV__`) advances the status so the demo can show updates.
4. CityServe: catalog → bulky-waste booking (items multi-select, day + slot, payment: كاش مع العامل / فوري / إنستاباي / محفظة موبايل, fee shown as "[حسب لائحة الحي]") → booking appears in طلباتي.
5. Map: shows seed incidents around Nasr City (lat ≈ 30.056, lng ≈ 31.330) with status-coloured pins; filter chips by status.
6. Forms validate with zod; every async screen has loading, empty and error states.
7. Offline-friendly copy: show "النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع" on the report footer.

### Copy and formatting rules

- Egyptian Arabic, gender-neutral ("بلاغك", "طلبك"). No religious phrases or symbols anywhere.
- Arabic-Indic digits in citizen-facing numbers (`toArabicDigits`), except phone inputs and IDs like `#FTC-1042`.
- Ruqaa (`ArefRuqaa_700Bold`) only for short slogans/greetings: sign-in slogan, Home greeting ("صباح الفل" before noon / "مساء الفل" after), "تسلم إيدك!", the medal title.
- Hotlines are `tel:` links via `Linking.openURL`: 122 شرطة, 123 إسعاف, 180 مطافي, 129 غاز, 125 مياه, 121 كهربا, 175 صرف.

## Definition of done for each phase

- `npx tsc --noEmit`, `npx expo lint`, `npx jest` all pass; `npx expo export --platform web` succeeds.
- No `TODO`s left in shipped screens (stubs are labelled in the UI as "قريبًا" and listed in `apps/mobile/README.md`).
- Do not commit — the coordinator commits. Do not edit files outside your assigned paths; if you need a change to a shared file, describe it in your report.
