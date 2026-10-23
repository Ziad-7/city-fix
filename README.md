# CityFix — سيتي فيكس

بلّغ.. وإحنا نتابع لحد ما تتصلّح — *Report it, and we follow it until it's fixed.*

## 🔗 Live app

| App | Link |
| --- | --- |
| 🌐 Citizen website | <https://city-fix-user.vercel.app/> |
| 🛠️ Command Center (admin) | <https://city-fix-admin.vercel.app/> |
| ⚙️ Backend API | <https://city-fix-api-backend.vercel.app/> |
| 📱 Android APK (collector app) | [Expo build](https://expo.dev/accounts/abdulrahman-111s-team/projects/cityfix/builds/2b941844-b726-47a8-b98f-7aff82b792a2) |

Hosted URLs are team-provided; see [Claims vs evidence](docs/evidence.md) for what has been independently verified.

**CityFix (سيتي فيكس)** is our project: a smart-city platform for Egyptian cities that connects citizens, service teams and the Command Center. Its aspects include reporting and incident management, municipal services, operations, city maps and AI assistance. **CityCycle (سيتي سايكل)** is CityFix's waste-and-recycling aspect, through which the project addresses SolveThe17 2.0 · Track 4 "Unlocking Egypt's Waste Economy". It connects recyclables pickups, collectors, recorded weights/payments and simulated smart-bin telemetry.

## The CityCycle story

1. A household sorts recyclables with a picture guide and requests a pickup, with an estimate from the district price list.
2. A verified Zabbal (informal collector) accepts a nearby job (first accept wins) and weighs each material, by hand or on a hub scale.
3. Each weighing keeps the district price per kg that applied at that moment; the collector records what was paid to the household, and the household confirms the weight.
4. Impact moves: kg by material for the household, EGP for the collector, tonnes per district in the Command Center.
5. A smart bin reports its fill level (device key, de-duplicated readings), turns red in the Command Center at the full threshold, and the district can plan a collection route with OR-Tools.

Amounts are recorded only: no payment provider is integrated and no money moves through the platform. Demo prices and weights are seed data, not market prices.

## What actually runs today

| Piece | Status | Evidence |
| --- | --- | --- |
| CityCycle backend API (pickups, collectors, prices, payouts, impact, bins) | Built and tested | `backend/tests/test_citycycle.py`, `backend/tests/test_bins.py` |
| Collector mode (mobile) | Built; mock mode by default; runs in Expo Go, not validated on a new device build | `apps/mobile/src/app/collector/` |
| Citizen web CityCycle screens | Built; mock mode by default | `apps/web/src/app/(portal)/services/recycling/`, [web README](apps/web/README.md) |
| Command Center CityCycle and smart-bin pages | Built | `apps/admin-web/src/app/(app)/citycycle/`, `apps/admin-web/src/app/(app)/bins/` |
| Smart bin | Simulated only: browser page `/smart-bin` in `apps/web`, PC simulator, ESP32 Wokwi prototypes. No physical bench build | [`hardware/simulator/`](hardware/simulator/README.md), [`hardware/wokwi/`](hardware/wokwi/README.md) |
| Route optimizer and fill forecast | Built: admin-only OR-Tools route preview and linear fill forecast, with Command Center screens (bins forecast, route planner, hotspots, payouts). OR-Tools in a production build is still to verify | `backend/tests/test_route_optimizer.py`, `backend/tests/test_bin_forecast.py` |
| AI suggestions (CityBrain) | Suggestions only, with deterministic fallback; photo analysis off by default | [AI status](docs/ai-status.md) |
| Deployment | Team-provided hosted URLs recorded; live end-to-end behaviour not independently verified | [Submission package](deliverables/solvethe17-track4-citycycle/README.md), [Claims vs evidence](docs/evidence.md) |

![System architecture](docs/diagrams/system-architecture.svg)

Clients (mobile, citizen web, Command Center) talk to one FastAPI backend; devices post readings with a per-device key; CityBrain only suggests. Details and data flows: [architecture](docs/architecture.md).

## Submission package

- [Architecture and data flows](docs/architecture.md)
- [Claims vs evidence](docs/evidence.md): what is tested, simulated or still to verify, and how to reproduce
- [Pitch kit](docs/pitch/README.md): 3-minute video script, deck outline, judges' Q&A
- [Vision](docs/vision.md): the full picture and the grading map
- Hardware package: overview [`hardware/README.md`](hardware/README.md), schematics [`hardware/schematics/`](hardware/schematics/README.md), Bill of Materials in EGP [`hardware/bom/`](hardware/bom/README.md) (prices only with a dated supplier source, otherwise to verify)
- Field Deployment Brief: [`docs/field-brief/field-deployment-brief.md`](docs/field-brief/field-deployment-brief.md), printable [HTML](docs/field-brief/field-deployment-brief.html)

## CityFix aspects

CityFix combines the following aspects, which share the platform backend, accounts and design. CityCycle is one aspect of this wider project.

- **FixFirst** — report → incident management, explainable priority score, budget planning. Citizens report potholes, open manholes, broken streetlights, garbage and more.
- **CityServe** — municipal service requests (bulky-waste pickup, tree maintenance).
- **CityCycle** (سيتي سايكل — إعادة التدوير) — waste and recycling, described above ([vision](docs/vision.md)).
- **CityOps** — work orders, department assignment, status updates.
- **CityPulse** — the live incident map.
- **CityBrain** — AI triage: category + severity from photo and Egyptian Arabic text, duplicate detection, department routing.

## What's in this repo

| Path | What | Status |
| --- | --- | --- |
| `apps/mobile/` | Citizen and collector app — Expo (React Native) + TypeScript, Arabic-first RTL | Built; mock mode by default |
| `apps/web/` | Citizen website (client portal) — Next.js, Arabic and English | Built; mock mode by default |
| `apps/admin-web/` | City Command Center — Next.js web dashboard, Arabic | Built and integrated with the local demo API; deployment pending |
| `hardware/` | CityCycle smart-bin simulator, ESP32 Wokwi prototypes and the hardware design package ([`hardware/README.md`](hardware/README.md)) | Simulated only, no physical build; schematics and BOM are design documents |
| `backend/` | FastAPI API (SQLite locally, PostgreSQL on Supabase for deployment), CityBrain AI, budget optimizer | Built; production PostgreSQL migration, real OTP and deployment pending |
| `docs/` | Decisions, design, specs, progress log | Living |

## Team

| # | Role | Owner | Folder | Brief |
| --- | --- | --- | --- | --- |
| 1 | Citizen mobile app | Abood + Claude | `apps/mobile` | [spec](docs/mobile/implementation-spec.md) |
| 2 | Citizen website (client portal) | _[name]_ | `apps/web` | [brief](docs/team/citizen-web-portal.md) |
| 3 | Admin web (Command Center) | _[name]_ | `apps/admin-web` | [brief](docs/team/admin-web.md) |
| 4 | Backend API & database | Moataz (citizen API/auth) + teammate (DB/operations; name pending) | `backend/` | [ownership split](docs/team/backend-split.md) |
| 5 | AI & smart features (CityBrain) | _[name]_ | `backend/app/ai`, `backend/app/optimizer` | [brief](docs/team/ai-features.md) |
| 6 | Hardware & IoT (CityCycle smart bin) | _[name]_ | `hardware/` | [brief](docs/team/hardware-iot.md) |

Who owns what, hand-offs, the week plan and how we review: **[docs/team/README.md](docs/team/README.md)**. Design for every screen: [docs/design/index.html](docs/design/index.html).

## Run the backend and the Command Center

Use two terminals, one per command.

```bash
cd backend && uv sync && LOCAL_SCHEMA_BOOTSTRAP=true SEED_ON_START=true uv run uvicorn app.main:app --reload --port 8000
cd apps/admin-web && npm ci && npm run dev                                   # http://localhost:3001
```

### CityCycle demo logins

| Who | Login |
| --- | --- |
| Command Center admin | `admin@cityfix.demo` / `FixCity2026!` |
| Household (citizen) | phone `01012345678`, code `123456` |
| Verified collector | phone `01022223333`, code `123456` |

Demo prices and weights are seed data, not market prices. Details: `backend/README.md`, `apps/admin-web/README.md`.

## Run the citizen website and the smart-bin simulator

```bash
cd apps/web && npm install && npm run dev      # mock mode by default, no backend needed
python hardware/simulator/run.py               # PC panel for smart-bin telemetry, mock receiver by default
```

## Run the citizen app

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS). The app runs fully on **mock data** by default — see `apps/mobile/README.md`.

## Documentation

- [Submission package: required deliverables, report PDFs, estimated BOM and prototype runbook](deliverables/solvethe17-track4-citycycle/README.md)
- [Docs index](docs/README.md)
- [Architecture](docs/architecture.md) · [Claims vs evidence](docs/evidence.md) · [Pitch kit](docs/pitch/README.md)
- [Vision: the complete sustainable-city picture](docs/vision.md) · [CityCycle features per member](docs/features/README.md) · [Decision 0004 — CityCycle](docs/decisions/0004-citycycle-waste-pillar.md)
- [Decision 0001 — Citizen mobile app instead of a web portal](docs/decisions/0001-mobile-app-instead-of-web-portal.md)
- [Mobile implementation spec](docs/mobile/implementation-spec.md)
- [Team roles](docs/team/README.md)
- [Design pack: identity + every screen](docs/design/index.html) · [Brand book](docs/design/brand-book.md)
- [API contract](docs/api-contract.md)
- [Progress log](docs/progress-log.md)
- [Contributing: branches, PRs, commits](CONTRIBUTING.md)

## License

MIT, see [LICENSE](LICENSE). Bundled third-party assets keep their own licences, for example the fonts in [`apps/web/src/app/fonts/`](apps/web/src/app/fonts/README.md) (SIL OFL 1.1).
