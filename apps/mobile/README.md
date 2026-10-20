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
- `api`: `fetch` against `EXPO_PUBLIC_API_URL` using `POST/GET /reports`, `GET /incidents`, `GET /incidents/{id}`,
  `POST/GET /service-requests`, `GET /map/incidents` (plus assumed `/auth/otp`, `/auth/verify`, `/triage`,
  `/incidents/{id}/follow`). Not wired or tested yet.

Screens only talk to the store hooks, so switching modes needs no screen changes.

## Folder map

```
src/
  app/          routes only (Expo Router): _layout, sign-in, (tabs)/*, report/*, requests/[id], services/*
  components/   Icon, TabBar, Hotlines, ui/ (AppText, Button, Card, Chip, ChoiceChip, StatusChip, TextField,
                SelectField, ToggleRow, ProgressBar, Screen, ScreenHeader, Placeholder),
                brand/ (LogoMark, LogoLockup, LogoPill, Skyline, Medal), map/ (IncidentMap .native/.web)
  domain/       types, categories (12), hotlines, locations, services-catalog, zod schemas
  logic/        priority (score + factors), duplicates (250 m), triage-mock (keyword classifier)
  services/     interfaces.ts, mock/ (seeded, AsyncStorage), api/ (fetch), index.ts (mode switch)
  store/        useSession (persisted), useReports, useServiceRequests, useRequests (merged list), actions
  theme/        tokens.ts (light theme from docs/design/tokens.json)
  utils/        digits (Arabic-Indic, phone), time (Arabic relative time), geo (haversine)
```

## Known stubs

- All screens except `sign-in` are placeholders ("قيد التنفيذ") until Phase B.
- OTP is mocked (no SMS/WhatsApp is sent); AI triage is a deterministic keyword classifier.
- "English" and "خط أكبر" links on the sign-in screen show a "قريبًا" alert.
- `react-native-maps` has no web support; `IncidentMap.web.tsx` renders a list instead. Config plugin not added
  (Expo Go needs no API key); a development build will need one.
- The mock `simulateProgress` actions are for demos only.
