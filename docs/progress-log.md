# Progress log

Newest first. Each entry: what was done, how to test it, known issues.

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
