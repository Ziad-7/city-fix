# CityFix (سيتي فيكس): citizen mobile app

Arabic-first (RTL) Expo React Native app for reporting city problems in Egypt and booking city services, with English (LTR)
as a second language switched at runtime (see [Languages](#languages)).
Expo SDK 57, React Native 0.86.3, Expo Router, TypeScript, zustand, zod.

Mobile developer: read the [Expo Go compatibility and APK crash handoff](../../docs/mobile/2026-10-21-expo-go-and-apk-handoff.md)
for what changed, why SDK 57 is pinned, what was tested, and the remaining Android startup-crash investigation.

## Run it

```bash
cd apps/mobile
npm ci
npx expo start          # then scan the QR code with Expo Go (Android or iOS)
npx expo start --web    # quick visual check in a browser (maps show a list on web)
```

The layout direction follows the app language, whatever the phone's system language: the root layout sets
`direction: 'rtl'` for Arabic and `'ltr'` for English (Expo Go ignores the `expo-localization` `forcesRTL` plugin, so we
don't rely on it alone). Recheck RTL screens on Android and iOS after SDK changes; the successful Android preview launch
does not establish that every RTL screen is correct. Native system UI (alerts, the back-swipe gesture) still follows the
phone's language in Expo Go; a development build with `forcesRTL` fixes that for Arabic. The web preview also sets
`dir` and `lang` on the page.

Demo sign-in: any valid Egyptian mobile (`01[0125]` + 8 digits), then any 6-digit code (the screen shows `123456`).

### Scripts

| Script | What it does |
| --- | --- |
| `npm start` / `android` / `ios` / `web` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `expo lint` (flat ESLint config with `eslint-config-expo`) |
| `npm test` | Jest (`jest-expo` preset) |
| `npx expo export --platform web` | Web smoke build into `dist/` |

Installs must use `npx expo install <pkg>` (set `EXPO_OFFLINE=1` in sandboxes where Expo's version API is blocked).

## Build an Android APK

```bash
npm i -g eas-cli && eas login
eas env:create --name GOOGLE_MAPS_API_KEY --value <key> --environment preview   # once
eas build --platform android --profile preview                                  # internal APK
```

Build profiles live in `eas.json` (`preview` = installable APK, `production` = Play Store bundle). Install the APK on a phone
or emulator, then check `adb logcat -b crash` stays empty after launch.

**Startup crash fixed (2026-10-21):** the first APK crashed before any screen because WorkManager (included by
`react-native-maps`) starts at launch and builds its Room database by reflection, and R8 had stripped that class. `app.json`
now adds keep rules through `expo-build-properties`. See the [crash analysis](../../docs/mobile/2026-10-21-android-startup-crash.md).

## Mock vs API mode

`src/services/index.ts` picks the implementation from `EXPO_PUBLIC_API_MODE`:

- `mock` (default): everything is local. Data is seeded on first run and persisted in AsyncStorage (`ftc.mock.db.v1`).
- `api`: `fetch` against `EXPO_PUBLIC_API_URL`, following [`docs/api-contract.md`](../../docs/api-contract.md)
  (`/auth/*`, `/reports`, `/incidents`, `/incidents/{id}/follow`, `/service-requests`, `/map/incidents`, `/triage`, and the
  proposed `/uploads/sign`, `/ai/transcribe`, `/incidents/{id}/reopen`, `/services/garbage-schedule`).
  Not tested against a real backend yet. The bearer token is saved in `expo-secure-store` on native (key `ftc.token`; web keeps it in
  AsyncStorage), restored on app start, and a `401` signs the user out with a notice. Photos are resized (1600 px, JPEG 0.7)
  and uploaded through `POST /uploads/sign` + `PUT` (voice notes and the tree-booking photo too); a report that can't be sent (offline / server down) is queued in
  `useOutbox` (AsyncStorage `ftc.outbox.v1`) and flushed when the connection returns.
  Errors show the contract's `{ "detail" }` or a friendly line in the app language, never "HTTP 500".

Screens only talk to the store hooks, so switching modes needs no screen changes.

## Languages

Arabic is the default; English is a full second language. People switch in **Profile → Language** (or the "English" /
"العربية" link on sign-in). The switch is live: no reload, and the screen you are on updates at once.

How it works:

- The language lives in `store/usePrefs.ts` (`lang: 'ar' | 'en'`, persisted in AsyncStorage `ftc.prefs.v1`, default `'ar'`).
- `src/app/_layout.tsx` flips the root view's `direction` (rtl/ltr). Directional icons (back, forward, chevron) mirror only
  in Arabic (`Icon`). Use logical styles (`start`/`end`, `marginStart`, `paddingEnd`, `borderEndWidth`), never
  `left`/`right` or `row-reverse`.
- `localDigits()` prints Arabic-Indic digits in Arabic and Western digits in English; `formatDate`, `formatDateTime`,
  `relativeTime`, `greeting` (`utils/time.ts`) and `formatDistance` (`utils/geo.ts`) follow the language too.
- Domain names (categories, statuses, severities, departments, districts, services, items, slots, payments, medals,
  hotlines) keep their Arabic in the domain files; `src/i18n/labels.ts` has the English and helpers such as
  `labelOfCategory(c)`, `statusLabel(s, ar)` and `placeName(ar)`.
- Data from the backend comes in the request language (mock: `services/mock/localize.ts` localises at read time). Lists
  are fetched again after a switch (`store/actions.ts`). Notification text is fixed when the notification is created.
- `AppText` never uses Aref Ruqaa for English: slogans switch to Readex Pro bold.

To translate new UI:

```tsx
import { useTr } from '@/i18n';

function MyCard() {
  const tr = useTr(); // subscribes the component: it re-renders on a language switch
  return <AppText>{tr('بلّغ عن مشكلة', 'Report a problem')}</AppText>;
}
```

- Every component that renders translated text calls `useTr()` (or `useLang()`), or is rendered by a parent that does.
- Outside React (helpers, stores, zod messages) use `tr(ar, en)` / `getLang()`; they read the language **when called**.
  Never call them at module level (a constant built at import time stays in one language). Wrap it in a function instead.
- A `useMemo` whose result contains text must list `lang` (or `tr`) in its dependencies. Don't keep translated text in
  `useState`: keep the key or the condition and translate while rendering.
- Plurals: write both forms ("1 report" / "2 reports"); the Arabic helpers handle the Arabic count forms.
- Follow the tone and exact terms in the [English glossary](../../docs/mobile/english-glossary.md) (sentence case, "EGP",
  Western digits, slogans in Readex Pro).

## Folder map

```
src/
  app/          routes only (Expo Router): _layout, sign-in, (tabs)/*, report/*, requests/[id], services/*,
                collector/ ((tabs)/ jobs, map, earnings, account; job/[id]), CityCycle collector mode
  components/   Icon, TabBar, Hotlines, ui/ (AppText, Button, Card, Chip, ChoiceChip, StatusChip, TextField,
                SelectField, ToggleRow, ProgressBar, Screen, ScreenHeader, InlineNotice, confirm),
                brand/ (LogoMark, LogoLockup, LogoPill, Skyline, Medal), map/ (IncidentMap .native/.web),
                collector/ (collector tab bar, job cards, number pad, JobsMap .native/.web, offline queue, mode redirect + pure helpers)
  domain/       types, categories (12), hotlines, locations, services-catalog, zod schemas,
                CityCycle: citycycle (types), materials (catalogue, DEMO prices, value and impact maths), bins (states, thresholds)
  i18n/         tr / useTr / useLang / useIsRTL, labels.ts (English domain labels)
  logic/        priority (score + factors), duplicates (250 m), triage-mock (keyword classifier)
  notifications/ os.ts (expo-notifications: Android channel, local notifications, taps; no-op on web)
  services/     interfaces.ts, mock/ (seeded, AsyncStorage), api/ (fetch, uploads), media (resize + upload pipeline),
                sendReport, network (NetInfo), garbage-schedule, index.ts (mode switch)
  store/        useSession (persisted, token in SecureStore), useReports, useServiceRequests, useRequests (merged list),
                useCityCycle (prices, pickups, impact, bins), useCollector (jobs, weighings, earnings; session `mode`),
                useOutbox + outboxFlush + useOutboxSync (offline queue), useNotifications (status diff), usePrefs, actions
  theme/        tokens.ts (light theme from docs/design/tokens.json)
  utils/        digits (Arabic-Indic / Western, phone), time (Arabic and English dates, relative time), geo (haversine, distance)
```

## Collector mode (CityCycle)

Profile → "اشتغل كجامع / Work as a collector" (mock mode: always offered, signed in as the demo collector Mahmoud Saeed,
COL-101; API mode: only with the `collector` role) switches `useSession.mode` to `collector`. The root layout then exposes
`src/app/collector/*` (guarded by the mode) and `ModeRedirect` moves the person from a citizen tab to `/collector`; Account →
"ارجع لوضع المواطن / Back to citizen mode" goes back. Sign-out resets the mode. Deep links to other routes are not touched.

- Routes: `/collector` (jobs), `/collector/map`, `/collector/earnings`, `/collector/account`, `/collector/job/[id]`
  (way there, weigh, pay, done in one screen, by step).
- Weighing and "complete" are offline-first: `components/collector/useCollectorQueue.ts` keeps them in AsyncStorage
  (`ftc.collector.queue.v1`), shows "مستني النت / Waiting for internet" and sends them on reconnect, foreground and "Try now".
  Weighings carry a `clientId`, so a retry never duplicates a row. Accepting a job is not queued: first accept wins, so it needs the internet.
- The hub-scale button is a **simulation** (mock mode only, clearly labelled); real BLE is out of scope.
- Prices are demo prices: every price or value shows the "Demo prices" label.

## Known stubs

Real since Phase D (mock mode simulates the server side):

- Voice notes (expo-audio, native only; the web preview says recording is on the phone): record up to 60 s, play, delete,
  re-record; the clip is uploaded and transcribed (mock: canned sentences in the app language) into the description.
- Map pin picker with reverse geocoding on the report and tree forms (native; web shows the static sketch).
- Emergency flag from triage (gas, fire, injury, collapse): the hotlines show first, the report can still be sent.
- Uploads (`/uploads/sign` + `PUT`), photo resize, offline queue with backoff and "ابعت دلوقتي", token in SecureStore.
- Detail screens load an uncached id on demand (deep links, notification taps); pull-to-refresh on طلباتي.
- Notifications centre, bell badge and local OS notifications (expo-notifications; works in Expo Go on Android because it
  only uses local notifications, never push tokens). "خط أكبر" (×1.15) on sign-in and profile.
- Tree maintenance booking (free, no payment), garbage collection schedule, reopening a resolved report.

Still stubbed:

- OTP is mocked (no SMS/WhatsApp is sent); AI triage is a deterministic keyword classifier (Egyptian Arabic keywords plus a
  short English list); transcription is canned text in mock mode.
- No push notifications: OS notifications are local and only fire while the app runs and refreshes (on start, pull-to-refresh,
  status changes the app itself sees). Server push needs a development build and a backend sender.
- The garbage schedule is static demo data (`domain/garbage-schedule.ts`) until `GET /services/garbage-schedule` exists.
- Reopen, uploads, transcription, free tree bookings and the garbage schedule are *proposed* contract additions (see
  `docs/api-contract.md`); API mode needs the backend to implement them.
- Queued reports keep local file URIs (photos, voice note) until they are sent; if the OS clears the app cache first, the
  upload keeps failing and the item stays queued.
- `react-native-maps` has no web support; `IncidentMap.web.tsx` renders a list and `LocationPicker.web.tsx` a static sketch
  (the pin cannot be moved in the web preview).
- **Google Maps key (Android builds):** `react-native-maps` uses Google Maps on Android. `app.config.js` reads
  `GOOGLE_MAPS_API_KEY` and puts it in the manifest; set it as an EAS environment variable (never commit it). Without it a
  standalone build crashes when the map tab, the report form or the tree form (pin picker) opens. Expo Go doesn't need it.
- The mock `simulateProgress` actions are for demos only.
- Needs a real-device check: keyboard avoidance on Android (edge-to-edge), RTL on Android, horizontal chip rows starting at the
  right in Arabic and at the left in English, and a live language switch on Android and iOS (only the web preview was checked).
