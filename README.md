# FixTheCity — فيكس ذا سيتي

بلّغ.. وإحنا نتابع لحد ما تتصلّح — *Report it, and we follow it until it's fixed.*

FixTheCity is a smart-city platform for Egyptian cities. Citizens report problems (potholes, open manholes, broken streetlights, garbage…) and request municipal services from a **mobile app**; the city's **Command Center** triages them with AI, prioritises them transparently, coordinates the fix, and plans repairs within a limited budget.

Built in 7 days by a team of 5 for a hackathon.

## What's in this repo

| Path | What | Status |
| --- | --- | --- |
| `apps/mobile/` | Citizen app — Expo (React Native) + TypeScript, Arabic-first RTL | In progress (Stage 1) |
| `apps/web/` | Citizen website (client portal) — Next.js, same design as the app | Planned |
| `apps/admin-web/` | City Command Center — Next.js web dashboard | Planned |
| `backend/` | FastAPI + Supabase (PostgreSQL/PostGIS, Storage) API, CityBrain AI, OR-Tools budget optimizer | Planned |
| `docs/` | Decisions, design, specs, progress log | Living |

## Team

| # | Role | Owner | Folder | Brief |
| --- | --- | --- | --- | --- |
| 1 | Citizen mobile app | Abood + Claude | `apps/mobile` | [spec](docs/mobile/implementation-spec.md) |
| 2 | Citizen website (client portal) | _[name]_ | `apps/web` | [brief](docs/team/citizen-web-portal.md) |
| 3 | Admin web (Command Center) | _[name]_ | `apps/admin-web` | [brief](docs/team/admin-web.md) |
| 4 | Backend API & database | _[name]_ | `backend/` | [brief](docs/team/api-database.md) |
| 5 | AI & smart features (CityBrain) | _[name]_ | `backend/app/ai`, `backend/app/optimizer` | [brief](docs/team/ai-features.md) |

Who owns what, hand-offs, the week plan and how we review: **[docs/team/README.md](docs/team/README.md)**. Design for every screen: [docs/design/index.html](docs/design/index.html).

## Run the citizen app

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). The app runs fully on **mock data** until the backend exists — see `apps/mobile/README.md`.

## Modules

- **FixFirst** — report → incident management, explainable priority score, budget planning.
- **CityServe** — municipal service requests (bulky-waste pickup, tree maintenance).
- **CityOps** — work orders, department assignment, status updates.
- **CityPulse** — the live incident map.
- **CityBrain** — AI triage: category + severity from photo and Egyptian Arabic text, duplicate detection, department routing.

## Documentation

- [Docs index](docs/README.md)
- [Decision 0001 — Citizen mobile app instead of a web portal](docs/decisions/0001-mobile-app-instead-of-web-portal.md)
- [Mobile implementation spec](docs/mobile/implementation-spec.md)
- [Team roles](docs/team/README.md)
- [Design pack: identity + every screen](docs/design/index.html) · [Brand book](docs/design/brand-book.md)
- [API contract](docs/api-contract.md)
- [Progress log](docs/progress-log.md)
- [Contributing: branches, PRs, commits](CONTRIBUTING.md)
