# Contributing

## Branches

```text
main                       always runnable; protected
  ├── feat/mobile-citizen-app
  ├── feat/admin-dashboard
  ├── feat/backend-workflows
  ├── feat/citybrain-triage
  └── feat/budget-optimizer
```

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
