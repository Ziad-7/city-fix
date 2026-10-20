# Progress log

Newest first. Each entry: what was done, how to test it, known issues.

## 2026-10-21 — Phase A: mobile foundation (branch `feat/mobile-citizen-app`)

**Done** (implemented by Sonnet 5.5, checked by Claude Opus 5.5)
- Expo SDK 58 app config: Expo Router entry, `fixthecity` scheme, red splash and app icon, Arabic permission strings, RTL.
- Theme from `docs/design/tokens.json` (flag palette, Readex Pro / IBM Plex Sans Arabic / Aref Ruqaa).
- Shared UI kit: AppText, Button, Card, StatusChip, Chip, TextField, SelectField, ToggleRow, ProgressBar, Screen, ScreenHeader; brand Logo, Cairo Skyline, Medal; SVG Icon set; hotline buttons; incident map (native map, web list fallback).
- Domain model mirroring the plan's DB entities (Report, Incident, ServiceRequest, statuses), Egyptian categories, hotlines, governorates/districts, CityServe catalog, zod schemas.
- Logic: deterministic priority score with factor explanations, duplicate detection (same category, open, within 250 m), mock CityBrain triage (Egyptian Arabic keywords → top-3 categories + severity).
- Services behind interfaces with mock implementations persisted on the phone (10 seeded incidents around Nasr City, a demo report and a service request) and API implementations ready for the FastAPI backend (`EXPO_PUBLIC_API_MODE=api`).
- Zustand stores (session, reports, service requests) and navigation: protected routes, custom tab bar with the gold Report button.
- Sign-in screen complete (+20 phone validation, SMS/WhatsApp code, governorate/district).
- Tests (24 passing), ESLint, CI workflow `.github/workflows/mobile-ci.yml`.
- Fix by Claude: the root layout now sets `direction: 'rtl'`, so the app is right-to-left in Expo Go on any phone language.

**How to test**
- `cd apps/mobile && npm install && npx expo start`, scan with Expo Go.
- Sign in with any valid Egyptian mobile (e.g. `01012345678`) and code `123456`.
- `npm run typecheck && npm run lint && npm test`.

**Known issues**
- Other screens are placeholders ("قيد التنفيذ") until Phase B.
- API mode is untested (no backend yet); it assumes extra endpoints `/auth/otp`, `/auth/verify`, `/triage`, `/incidents/{id}/follow` — to agree with the backend owner.
- Only checked on the web build so far; needs a run on a real Android and iPhone.

## 2026-10-21 — Stage 0/1 kickoff: citizen app moves to mobile

**Done**
- Decision recorded: the citizen portal becomes an Expo mobile app; the Command Center stays web ([0001](decisions/0001-mobile-app-instead-of-web-portal.md)).
- Repo structure, README, contributing rules, docs index.
- Design handed over into the repo: brand book, tokens, 9 screen mockups, logo and skyline SVGs (`docs/design/`).
- Implementation spec for the citizen app (`docs/mobile/implementation-spec.md`).
- Expo SDK 58 app created in `apps/mobile` with Expo Router, maps, camera, location, fonts and state libraries installed.

**How the team builds it**
- Implementation by a Sonnet 5.5 agent per phase; review by an Opus 5.5 agent; coordination and commits by Claude (Opus 5.5). All at medium thinking effort.
- Phase A: foundation (config, theme, components, domain, mock services, store, navigation, sign-in, tests, CI).
- Phase B: screens, split by area — B1 home + report flow, B2 requests/tracking + CityServe + map + profile.
- Phase C: independent review, fixes, then push.

**Known issues**
- GitHub push access for Claude is not set up on `Ziad-7/fix-city` yet; work is committed locally until it is.
