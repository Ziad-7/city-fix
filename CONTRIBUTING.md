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
- CI (`.github/workflows/`) must pass: typecheck, lint, tests.

## Commits

- Present tense, scoped: `mobile: add report flow with mock AI triage`.
- One logical change per commit.

## Before you hand off a stage (from the plan)

- [ ] Works on the latest `main`.
- [ ] Acceptance tests for the stage pass.
- [ ] A teammate reviewed or tested it.
- [ ] API/type changes are documented.
- [ ] Known bugs and limitations are listed in the progress log.
