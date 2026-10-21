# Contributing

## Branches

```text
main                       always runnable; protected
  ├── feat/mobile-…          member 1 · apps/mobile
  ├── feat/web-…             member 2 · apps/web (citizen website)
  ├── feat/admin-…           member 3 · apps/admin-web (Command Center)
  ├── feat/api-…             member 4 · backend/ (API, database, deploy)
  ├── feat/ai-…              member 5 · backend/app/ai, backend/app/optimizer
  └── docs/… · design/…      shared docs and design (member 1 approves design)
```

- Roles, folders and who reviews what: [`docs/team/README.md`](docs/team/README.md). Stay in your role's folders.
- Short-lived branches, small PRs. Don't keep a branch open until the last day.
- Every PR says **what changed** and **how to test it**, and links the step in `docs/progress-log.md`.
- CI (`.github/workflows/`) must be green before a PR is merged.

## CI

One workflow per folder. A workflow runs only when its own folder (or its own workflow file) changes, so one app's CI never runs or breaks another's. The exception is shared code: the website and admin copy files from `apps/mobile/src`, so their workflows also run when those exact mobile files change, and a drifting copy is caught on the PR that causes it.

| Workflow | Guards | Also runs when | Checks |
| --- | --- | --- | --- |
| `mobile-ci.yml` | `apps/mobile/**` | | typecheck, lint, jest, `expo export --platform web` smoke build |
| `web-ci.yml` | `apps/web/**` | the mobile files listed in `apps/web/scripts/check-shared.sh`, `docs/design/css/cityfix.css` | `check:shared`, typecheck, lint, vitest, build, Playwright e2e |
| `admin-web-ci.yml` | `apps/admin-web/**` | the six shared mobile files in `docs/team/admin-web.md` | `check:shared` (if present), typecheck, lint, test, build |
| `backend-ci.yml` | `backend/**` | | `ruff check`, `ruff format --check`, `pytest` (Python 3.12, dummy env, no secrets; the paid AI eval is not run) |
| `docs-ci.yml` | `docs/**`, `README.md`, `CONTRIBUTING.md`, `apps/*/README.md` | | `scripts/check-doc-links.mjs` (relative links in Markdown and `docs/design` HTML) |

`admin-web-ci.yml` and `backend-ci.yml` finish green without doing anything until `apps/admin-web` / `backend` exist. If you add a shared file to a copy list, add its path to the other app's workflow triggers too.

Run the same checks locally before opening a PR:

```bash
# apps/mobile
cd apps/mobile && npm ci && npm run typecheck && npm run lint && npm test && EXPO_OFFLINE=1 npx expo export --platform web
# apps/web (and apps/admin-web, without the e2e step)
cd apps/web && npm ci && npm run check:shared && npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e
# backend
cd backend && pip install -e ".[dev]" && ruff check . && ruff format --check . && OTP_MODE=demo JWT_SECRET=dummy pytest
# docs (from the repo root)
node scripts/check-doc-links.mjs
```

### For the repo admin

Protect `main` (Settings, Rules, Rulesets): require a pull request and require status checks to pass. Caveat: path-filtered workflows do not run at all for PRs that do not touch their folder, and a required check that never reports stays "Expected" and blocks the merge. So do not add every per-app check as required. Either require only the checks that always report, or add a small always-running workflow (no path filter) that reports one summary check and use that as the single required check. Until then, treat per-app checks as "must be green when they appear" in review.

## Commits

- Present tense, scoped: `mobile: add report flow with mock AI triage`.
- One logical change per commit.

## Before you hand off a stage (from the plan)

- [ ] Works on the latest `main`.
- [ ] Acceptance tests for the stage pass.
- [ ] A teammate reviewed or tested it.
- [ ] API/type changes are documented.
- [ ] Known bugs and limitations are listed in the progress log.
