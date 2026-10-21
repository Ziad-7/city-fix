# FixTheCity: citizen mobile app

Arabic-first (RTL) Expo React Native app for reporting city problems in Egypt and booking city services.
Expo SDK 58, React Native 0.88, Expo Router, TypeScript, zustand, zod.

## Run it

```bash
cd apps/mobile
npm install
npx expo start          # then scan the QR code with Expo Go (Android or iOS)
npx expo start --web    # quick visual check in a browser (maps show a list on web)
```

The layout is right-to-left on every phone, whatever its system language: the root layout sets
`direction: 'rtl'` (Expo Go ignores the `expo-localization` `forcesRTL` plugin, so we don't rely on it alone).
React Native's docs tag `direction` as iOS-only, but in RN 0.88 (Fabric) it is a shared view prop: Yoga resolves it
and Android applies it to views and text (see the comment in `src/app/_layout.tsx`). Still confirm on an Android phone.
Native system UI (alerts, the back-swipe gesture) still follows the phone's language in Expo Go; a development
build with `forcesRTL` fixes that too. The web preview also sets `dir="rtl"` on the page.

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

## Mock vs API mode

`src/services/index.ts` picks the implementation from `EXPO_PUBLIC_API_MODE`:

- `mock` (default): everything is local. Data is seeded on first run and persisted in AsyncStorage (`ftc.mock.db.v1`).
- `api`: `fetch` against `EXPO_PUBLIC_API_URL`, following [`docs/api-contract.md`](../../docs/api-contract.md)
  (`/auth/*`, `/reports`, `/incidents`, `/incidents/{id}/follow`, `/service-requests`, `/map/incidents`, `/triage`).
  Not tested against a real backend yet. The bearer token is saved with the session (AsyncStorage for now; move it to
  `expo-secure-store` when a dev build is used), restored on app start, and a `401` signs the user out with a notice.
  Errors show the contract's `{ "detail" }` or a friendly Arabic line, never "HTTP 500".

Screens only talk to the store hooks, so switching modes needs no screen changes.

## Folder map

```
src/
  app/          routes only (Expo Router): _layout, sign-in, (tabs)/*, report/*, requests/[id], services/*
  components/   Icon, TabBar, Hotlines, ui/ (AppText, Button, Card, Chip, ChoiceChip, StatusChip, TextField,
                SelectField, ToggleRow, ProgressBar, Screen, ScreenHeader, InlineNotice, confirm),
                brand/ (LogoMark, LogoLockup, LogoPill, Skyline, Medal), map/ (IncidentMap .native/.web)
  domain/       types, categories (12), hotlines, locations, services-catalog, zod schemas
  logic/        priority (score + factors), duplicates (250 m), triage-mock (keyword classifier)
  services/     interfaces.ts, mock/ (seeded, AsyncStorage), api/ (fetch), index.ts (mode switch)
  store/        useSession (persisted), useReports, useServiceRequests, useRequests (merged list), actions
  theme/        tokens.ts (light theme from docs/design/tokens.json)
  utils/        digits (Arabic-Indic, phone), time (Arabic relative time), geo (haversine)
```

## Known stubs

Everything below is labelled "قريبًا" (or is copy only) in the UI:

- OTP is mocked (no SMS/WhatsApp is sent); AI triage is a deterministic keyword classifier.
- Voice note recording, the notifications bell, "English" and "خط أكبر" (sign-in, profile), tree maintenance and the other
  non-bulky city services: notice only.
- Offline queue: the report footer says the report is saved and sent when the net returns, but nothing is queued yet; a failed
  submit shows an error. Reopening a resolved report (mentioned in its timeline) does not exist either.
- Photos are sent as local `file://` URIs; the contract's `/uploads/sign` flow is not implemented, so API mode needs it first.
- Detail screens read the cached lists only (a deep link to an uncached id shows "مش لاقيين"); `getReport`, `getIncident`,
  `listMapPins` and `ServiceRequestService.get` exist for that but no screen calls them yet.
- `react-native-maps` has no web support; `IncidentMap.web.tsx` renders a list instead. Config plugin not added
  (Expo Go needs no API key); a development build will need one.
- The mock `simulateProgress` actions are for demos only.
- Needs a real-device check: keyboard avoidance on Android (edge-to-edge), RTL on Android, horizontal chip rows starting at the right.
