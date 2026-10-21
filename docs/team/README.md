# Team roles while the mobile app is being built

The citizen mobile app (and the citizen website) run on mock data behind a fixed API contract ([`docs/api-contract.md`](../api-contract.md)), so nobody has to wait for it. Each role below works in its own folder and branch and only meets the others at the contract.

| Role | Owner | Folder · branch | Can start now? | Brief |
| --- | --- | --- | --- | --- |
| Citizen mobile app | _[name]_ + Claude agents | `apps/mobile` · `feat/mobile-citizen-app` | In progress | [`docs/mobile/implementation-spec.md`](../mobile/implementation-spec.md) |
| **Citizen web portal** | _[name]_ | `apps/web` · `feat/citizen-web` | **Yes** — on mock data, same contract, same design as mobile | [`citizen-web-portal.md`](citizen-web-portal.md) |
| **Backend & database** | _[name]_ | `backend/` · `feat/backend-workflows` | **Yes** | [`backend-database.md`](backend-database.md) |
| CityBrain AI triage | _[name]_ | `backend/app/ai/` · `feat/citybrain-triage` | Yes — prototype in isolation, plug into `POST /triage` | See below |
| Admin web (Command Center) | _[name]_ | `apps/admin-web` · `feat/admin-dashboard` | Yes — on mock data, same contract | See below |
| Budget optimizer + DevOps | _[name]_ | `backend/app/optimizer/`, `.github/`, deploy · `feat/budget-optimizer` | Yes | See below |

## CityBrain AI triage (short brief)

- Build `analyze_report(description, photo, category_hint, location)` returning the `TriageSuggestion` shape in the contract: top-3 categories with confidence, severity, one Arabic summary line.
- Use a hosted multimodal LLM with a strict JSON schema; validate with Pydantic; time out at ~5 s and fall back to the keyword classifier.
- Tools the agent calls (from the plan): `find_nearby_incidents()` (the backend's duplicates query) and `get_responsible_department()` (from the `categories` table).
- Test set: 30 example reports in Egyptian Arabic with photos (potholes, garbage, open manholes, streetlights…) and a script that reports accuracy.
- Guardrails: suggestions only; never auto-merge duplicates or close incidents.

## Admin web — City Command Center (short brief)

- Next.js + TypeScript + Tailwind, Arabic RTL, the flag palette from `docs/design/tokens.json`.
- Screens: incident queue with priority breakdown and work-order panel (`docs/design/screens/Admin.html`), budget optimizer (`docs/design/screens/Budget.html`), map, service-request queue.
- Start on mock data behind the same typed service interfaces as the mobile app (copy `apps/mobile/src/domain/types.ts`), then switch to the API.

## Budget optimizer + DevOps (short brief)

- `POST /admin/budget/optimize`: 0/1 knapsack with Google OR-Tools — maximise total `priority_score` under `budgetEgp`; return selected/skipped with a one-line reason each. Tests: never over budget, only valid incident ids.
- DevOps: GitHub Actions for backend (ruff + pytest) next to the existing mobile CI, Docker image for the API, deploy to Railway/Render, Supabase project and secrets, a "reset demo data" script, and a backup demo recording on Day 7.

## Working agreements

- One design for every citizen screen: the website reuses the mobile app's brand, tokens, mockups, components and copy (`docs/design/`).
- The contract is shared ground: change it only by PR to `docs/api-contract.md`, tagging the people it affects.
- Small PRs into `main`, each with "how to test"; log each landed step in `docs/progress-log.md`.
- Daily: 15-minute kickoff, midday merge, end-of-day demo on the deployed preview (from the plan).
