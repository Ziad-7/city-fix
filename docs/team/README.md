# Team: who does what

CityFix is built by **5 members in parallel**. Everyone works in their own folder, on their own branches, and meets the others in two shared places:

1. **The API contract** ([`docs/api-contract.md`](../api-contract.md)): one backend, the same endpoints and shapes for every app.
2. **The design** ([`docs/design/index.html`](../design/index.html)): one identity ([`identity.html`](../design/identity.html)) and an HTML design for every screen.

Every app starts on **mock data** behind the contract, so nobody waits for anybody.

```
   Citizens                                   District staff
 ┌──────────────┐  ┌──────────────────┐     ┌────────────────────────┐
 │ ① Mobile app │  │ ② Citizen website │     │ ③ Admin Command Center │
 │ apps/mobile  │  │ apps/web          │     │ apps/admin-web         │
 └──────┬───────┘  └────────┬─────────┘     └───────────┬────────────┘
        └──────────── same API contract (docs/api-contract.md) ───────┘
                                   │
          ┌────────────────────────┴─────────────────────────┐
          │ ④ Backend API & database   │ ⑤ AI & smart features │
          │ backend/ (FastAPI,         │ backend/app/ai,        │
          │ Supabase PostGIS, deploy)  │ backend/app/optimizer  │
          └──────────────────────────────────────────────────┘
```

## The 5 roles

Role 4 is now shared by **Moataz (citizen API/auth)** and **a teammate (database/operations/deployment; name pending)**. Follow the [two-person backend ownership and hand-off plan](backend-split.md). Role 5 remains separate.

**Put your name in the Owner column** in your first PR.

| # | Role | Owner | Owns (folders) | Branch prefix | Brief (read this) |
| --- | --- | --- | --- | --- | --- |
| 1 | **Citizen mobile app** | Abood + Claude agents | `apps/mobile/` | `feat/mobile-…` | [`mobile/implementation-spec.md`](../mobile/implementation-spec.md) |
| 2 | **Citizen website (client portal)** | _[name]_ | `apps/web/` | `feat/web-…` | [`citizen-web-portal.md`](citizen-web-portal.md) |
| 3 | **Admin web (City Command Center)** | _[name]_ | `apps/admin-web/` | `feat/admin-…` | [`admin-web.md`](admin-web.md) |
| 4 | **Backend API & database** | Moataz (citizen API/auth) + teammate (DB/operations; name pending) | `backend/` except AI; [ownership split](backend-split.md) | `feat/api-…` | [`api-database.md`](api-database.md) |
| 5 | **AI & smart features (CityBrain)** | _[name]_ | `backend/app/ai/`, `backend/app/optimizer/`, `backend/app/routers/{triage,ai,budget}.py`, `backend/ai-eval/` | `feat/ai-…` | [`ai-features.md`](ai-features.md) |

### What each role delivers

**① Citizen mobile app** (Abood + Claude): the Expo app citizens use on the street: report a problem with photo, voice and GPS; follow it; book city services; see the map. Also: the source of the shared domain code (`apps/mobile/src/domain`, `logic`, `utils`), keeper of the design pack and the contract, and reviewer of every PR.
*Not responsible for:* the websites and the backend.

**② Citizen website** (member 2): the same citizen features as the app, in the browser, with the **same design**: 10 pages matching `docs/design/screens/web/`. Mock data first, then the real API.
*Not responsible for:* admin screens and the API.

**③ Admin web** (member 3): the Command Center for district staff: overview dashboard, incident queue and detail, status changes with notes to citizens, work orders, service requests, the map and the budget page: 8 pages matching `docs/design/screens/admin/`.
*Not responsible for:* the endpoints themselves (asks member 4) and the optimizer logic (member 5).

**④ Backend API & database** (member 4): Supabase PostgreSQL + PostGIS schema, migrations and seed; the FastAPI app with auth (citizen OTP + staff login), reports, incidents, map, service requests, uploads, admin endpoints; the priority formula, duplicate rule and timeline; **backend DevOps**: CI, Docker, deploy, secrets, CORS, demo reset.
*Not responsible for:* AI models and the optimizer (member 5), any screen.

**⑤ AI & smart features** (member 5): CityBrain: photo + Egyptian Arabic triage with a keyword fallback, voice-note transcription, photo blurring, duplicate help, weekly insights, the **budget optimizer** (OR-Tools), and an evaluation set with accuracy numbers.
*Not responsible for:* the database schema and the main API (asks member 4), any screen.

## Shared things and who owns them

| Shared thing | Owner (approves changes) | How to change it |
| --- | --- | --- |
| API contract `docs/api-contract.md` | Member 4, with every client owner affected | PR that edits the contract; tag members 1, 2, 3 (and 5 for AI routes). No silent shape changes. |
| Design pack `docs/design/` (identity, tokens, CSS, screens) | Member 1 (Abood) | PR with before/after screenshots. Apps never invent new colours or components. |
| Shared domain code (`apps/mobile/src/domain`, `logic`, `utils`) | Member 1 | Change it in the mobile app first; members 2 and 3 copy it (CI diff check). |
| Database schema and seed | Member 4 | Member 5 asks for columns/queries; member 4 writes the migration. |
| Demo data (Nasr City incidents, `01012345678` / `123456`, FTC-1042, SRV-2001) | Member 4 (backend seed) + member 1 (mock seed) | Keep mock and real seed the same. |
| Deploys | Backend: member 4 · each website: its owner (Vercel) · mobile: member 1 (Expo) | URLs listed in the root README. |
| CI | Each owner keeps their workflow green (`mobile-ci`, `web-ci`, `admin-web-ci`, `backend-ci`) | Don't merge red. |
| `docs/progress-log.md` | Everyone | One entry per landed step: what, how to test, known issues. |

## Who needs what from whom

| From → To | What |
| --- | --- |
| 4 → 1, 2, 3 | Deployed API URL, demo accounts (citizen + staff + admin), CORS for the websites, upload flow |
| 4 → 5 | `logic/queries.py` functions (nearby incidents, categories, departments, budget list), `ai_suggestions` table, routers registered, env vars on the server |
| 5 → 1, 2 | `/triage` (AI suggestion on the report form), `/ai/transcribe` (voice notes) |
| 5 → 3 | `/admin/budget/optimize`, triage payload on incident detail, `/admin/insights` |
| 1 → 2, 3 | Design pack, shared domain code, mock seed, PR reviews |
| 3 ↔ 2 | Same Tailwind theme, icon set and component names in both websites |

## The week

| Day | ① Mobile | ② Citizen web | ③ Admin web | ④ API & DB | ⑤ AI |
| --- | --- | --- | --- | --- | --- |
| 1 | Review others, photo upload flow | Scaffold, tokens, UI kit | Scaffold, sidebar, UI kit | Supabase, schema, seed, `/health` | Keyword fallback `/triage`, eval dataset |
| 2 | Offline queue, secure token | Sign-in, home, report flow (mock) | Login, incidents queue + detail (mock) | Auth (OTP + staff), reports, incidents | LLM triage with timeout + fallback |
| 3 | API mode against the backend | Requests, tracking, services | Overview, map, service requests | Map, service requests, uploads, deploy | Budget optimizer endpoint |
| 4 | Fixes from real-device tests | Map, profile; API mode | Work orders, budget; API mode | Admin endpoints, AI seams, CI | Voice transcription, blur |
| 5 | End-to-end with all apps | End-to-end, polish | End-to-end: status → citizen timeline | Load demo data, hardening | Eval numbers, demo examples |
| 6 | Demo script, polish | Polish, accessibility | Polish, accessibility | Demo reset script, monitoring | Stretch: insights, similar incidents |
| 7 | Demo + backup recording | Demo | Demo | Demo (backend on stage) | Demo (accuracy slide) |

## How we work

- **Branches and PRs:** branch from `main` with your prefix (`feat/web-…`), small PRs into `main`, each with *what changed*, *how to test* and screenshots for UI. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- **Stay in your folder.** A PR touches only the folders your role owns (plus your CI workflow and your progress-log entry). Need something elsewhere? Ask the owner in the team chat or open an issue.
- **Reviews:** every PR gets one review before merging. Frontend PRs (2, 3): Claude + Abood check design and contract match. Backend PRs (4, 5): reviewed by each other, plus Claude for contract match.
- **Contract first:** a new endpoint or field starts as a contract PR, gets agreed, then gets built.
- **Daily rhythm:** 15-minute kickoff (what I did, what I'll do, what blocks me), midday merge, end-of-day demo on the deployed previews.
- **Never commit secrets.** Only `.env.example` files with placeholder values.

## First hour for every member

1. Read this page, your brief, and [`docs/api-contract.md`](../api-contract.md).
2. Open [`docs/design/index.html`](../design/index.html) and [`identity.html`](../design/identity.html) (frontend members: your screens are there).
3. Run the mobile app (`cd apps/mobile && npm install && npx expo start --web`) to see the product working on mock data.
4. Put your name in the table above (first PR), create your branch, and post your Day 1 goal in the team chat.
