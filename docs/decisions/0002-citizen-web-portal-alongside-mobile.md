# 0002 — Citizen web portal alongside the mobile app

- **Date:** 2026-10-21
- **Status:** Accepted
- **Builds on:** [0001](0001-mobile-app-instead-of-web-portal.md)

## Context

0001 moved the citizen experience to a mobile app. We now also want a citizen website, for people on a laptop or who won't install an app, built by another team member in parallel.

## Decision

- Add a **citizen web portal** in `apps/web` (Next.js + TypeScript + Tailwind), owned by a separate member. Brief: [`team/citizen-web-portal.md`](../team/citizen-web-portal.md).
- The mobile app stays the main citizen client; the Command Center stays in `apps/admin-web`.
- **One backend, one contract:** mobile, citizen web and admin web all use the same FastAPI API and the same shapes in [`api-contract.md`](../api-contract.md). No client-specific endpoints.
- **One design:** the website uses the same brand, tokens, mockups, components, icons and Egyptian Arabic copy as the mobile app.
- **Shared logic:** domain types, schemas, priority, duplicates and triage-mock are copied unchanged from `apps/mobile/src` with a CI diff check; they move to `packages/shared` after the demo.

## Consequences

- The backend adds CORS for the web origins and a browser-friendly photo upload (`/uploads/sign`).
- Contract changes now affect three clients; every contract PR tags the mobile, web and backend owners.
- A report sent from the phone appears on the website for the same account, and the other way round; this is a demo acceptance check.
