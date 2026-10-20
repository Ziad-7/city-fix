# 0001 — Citizen mobile app instead of a web portal

- **Date:** 2026-10-21
- **Status:** Accepted

## Context

The original MVP plan had one Next.js web app with both the citizen portal and the admin Command Center, and listed native mobile apps as out of scope for the week.

Reporting a street problem happens on a phone, on the street: it needs the camera, GPS, and a quick flow that works on weak mobile data. In Egypt most citizens reach digital services from Android phones, and the experience we designed (photo first, voice notes, WhatsApp updates, +20 phone sign-up) is a mobile experience.

## Decision

- The **citizen experience is a mobile app** built with **Expo (React Native) + TypeScript + Expo Router**, in `apps/mobile`.
- The **City Command Center stays a web app** (Next.js) in `apps/admin-web` — admin work happens on desktops.
- The **backend contract does not change**: FastAPI + Supabase with the endpoints in the plan (§7). The mobile app talks to it through the same typed service interfaces (`IncidentService`, `ServiceRequestService`, …), with mock implementations first.

## Why Expo

- One TypeScript codebase for Android and iOS, close to the team's React/Next.js skills.
- Teammates and judges can run it on their own phones through **Expo Go** by scanning a QR code — no store builds needed for the demo.
- First-class camera, location, maps and font support; RTL support through `expo-localization`.

## Consequences

- Stage 1 (citizen frontend) now produces a mobile app instead of web pages; acceptance tests run on Android and iOS (Expo Go) instead of desktop/mobile browsers.
- Camera, location and maps must be tested on real phones, not just in a browser. A web build exists only for quick visual checks.
- The demo shows the citizen flow on a phone and the admin flow on a laptop, which matches how the product would really be used.
- Shared types live in `apps/mobile/src/domain` for now and are documented as the API contract; they can move to `packages/shared` when the admin web app starts.
- Native-only libraries beyond Expo Go's bundled set are avoided this week so no custom development build is needed.
