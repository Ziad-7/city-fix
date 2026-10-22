# Mobile app: remaining work

Date: 2026-10-22. Owner: Abood + Claude agents. Status of `apps/mobile` after Phase D, the English layer and the review fixes. Details for each item live in [the mobile README "Known stubs"](../../apps/mobile/README.md), [`progress-log.md`](../progress-log.md), [`api-contract.md`](../api-contract.md) and the [reviews](../reviews/). Tick items off here and add a progress-log entry when one is done.

## 1. Check on real phones (nothing below has been tried on a device)

- [ ] Keyboard avoidance on Android (edge-to-edge), RTL layout on Android and iOS, chip rows starting on the right in Arabic and on the left in English.
- [ ] Live language switch (Arabic / English) on Android and iOS; only the web preview was checked.
- [ ] Voice notes (record, play, re-record, 60 s limit), map pin picker, local notifications, secure storage of the login token.
- [ ] A rebuilt EAS preview APK from current `main` (`eas build -p android --profile preview`); the last confirmed build was from PR #9.
- [ ] Set `GOOGLE_MAPS_API_KEY` as an EAS environment variable (never commit it); without it a standalone build crashes on the map tab, report form and tree form.
- [ ] iPhone build and test (no iOS build has been made).

## 2. Needs the backend (API mode is untested)

- [ ] Run the app with `EXPO_PUBLIC_API_MODE=api` against the real FastAPI backend and fix contract mismatches.
- [ ] Agree and implement the endpoints the app already calls but the contract marks as proposed: `/auth/otp`, `/auth/verify`, `/triage`, `/incidents/{id}/follow`, `/uploads/sign` (+ `PUT`), `/ai/transcribe`, reopen, free tree bookings, `GET /services/garbage-schedule`.
- [ ] Real OTP over SMS/WhatsApp (mock accepts `123456`).
- [ ] Real AI triage (the app uses a deterministic keyword classifier) and real transcription (canned text in mock mode).
- [ ] Server push notifications (needs a development build and a backend sender); today only local OS notifications fire while the app runs.
- [ ] Replace the static garbage schedule (`domain/garbage-schedule.ts`) with the API.
- [ ] Idempotency key on report creation so offline-queue retries can't create duplicates (mobile and web, with the backend).

## 3. Known gaps in the app

- [ ] Queued offline reports keep local file URIs; if the OS clears the cache before sending, the upload keeps failing and the item stays queued. Copy files into app storage when queuing.
- [ ] Emergency alert depends on a triage answer; run `detectEmergency` locally as a fallback when triage errors (phase D review N4).
- [ ] Mock `getReport(id)` returns any user's report (phase D review N3; mock only, the API returns 403).
- [ ] Web preview limits: no native map (list fallback), static location sketch, voice recording on the phone only.
- [ ] Mockup toggles drawn as checkboxes in the design pack; admin INC-0042 score (93) to confirm with the backend priority formula.
- [ ] Priority formula, duplicate rule (same category, open, within 250 m) and medals live in the app; the backend must reproduce them (`docs/api-contract.md`, "Business rules").

## 4. Shared-code duty

`apps/web` and, later, `apps/admin-web` copy files from `apps/mobile/src`. Any change to `domain/`, `logic/`, `utils/` or the pure helpers under `components/` goes into the mobile app first, then is re-copied (`cd apps/web && npm run check:shared`). After the demo, move the shared code into `packages/shared`.

## 5. Nice to have

- Notifications page and more polish ideas from the design review; accessibility pass with TalkBack and VoiceOver.
- Store release: icons and splash already exist; add privacy policy, store listing and a production EAS profile.

## How to work on this

```bash
cd apps/mobile
npm ci
npm run typecheck && npm run lint && npm test
EXPO_OFFLINE=1 npx expo export --platform web
npx expo start        # Expo Go 57; demo login 01012345678 / 123456
```

Implementation is done by Sonnet 5.5 agents; Opus 5.5 reviews, commits and merges once CI is green. Never merge on a red check.
