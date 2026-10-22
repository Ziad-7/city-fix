# CityCycle: linking the mobile app to the backend

Date: 2026-10-22. The app is feature complete against the mock. Use this list when moving to `EXPO_PUBLIC_API_MODE=api`. The contract is [`api-contract.md`](../api-contract.md), section "CityCycle — proposed" (agree it by contract PR first).

## Endpoints the app calls

| Screen / action | Call | Notes |
| --- | --- | --- |
| Pickup form: prices | `GET /recycling/materials?district=` | `priceEgpPerKg` may be `null` |
| Pickup form: photo | `POST /uploads/sign` + `PUT`, then `POST /ai/waste-classify {path}` | classify failure is ignored |
| Pickup form: voice note | `POST /ai/transcribe` | same as reports |
| Pickup form: send | `POST /recycling/pickups` | body `NewRecyclingPickupInput` (`items`, `photoUris`, `location`, `day`, `slot`, `mode`, `note?`) |
| طلباتي / detail | `GET /recycling/pickups`, `GET /recycling/pickups/{id}` | `404` for a missing id, `403` for someone else's |
| Cancel / confirm | `POST /recycling/pickups/{id}/cancel`, `…/confirm` | cancel only while `requested` |
| My impact | `GET /me/impact` | |
| Map: bins | `GET /bins`, `POST /bins/{id}/report-full` | creates a garbage incident |
| Collector: apply / status | `POST /collectors/apply`, `GET /collectors/me` | `null`/404 when never applied; verification is by staff (the mock has a demo button) |
| Collector: jobs | `GET /collector/jobs?lat&lng&radiusM`, `GET /collector/pickups` | `/collector/pickups` is **new** |
| Collector: work | `POST /collector/jobs/{id}/accept`, `…/weighings`, `…/complete` | offline queue, see below |
| Collector: earnings | `GET /collector/earnings?from&to` | `YYYY-MM-DD`, inclusive |

## Things to check when linking

- [ ] `/collector/pickups` added to the backend (the contract now lists it).
- [ ] Pickup shape has `paidToHouseholdEgp`, `collectorFinishedAt`, `confirmedAt`, `note`; `Weighing.clientId` is returned.
- [ ] Weighing idempotency on `clientId`; refusal rules return `4xx`, not `5xx` (the offline queue drops on `4xx`, retries on `5xx`).
- [ ] Jobs list hides the caller's own pickups, the citizen's name and phone, and the exact pin until accept.
- [ ] Role `collector` is granted on verification; a non-verified caller gets `403` on `/collector/*`.
- [ ] `RCY-` id prefix on pickups; timeline entries use the shared `TimelineEntry`.
- [ ] Report-full creates a visible incident for the caller.
- [ ] Sign-out: the app clears its pickup and collector stores and the collector queue for that user.
- [ ] Run the manual test list below in api mode, fix mismatches in `services/api/index.ts` only.

## Manual test list (mock first, then api)

1. Services, then Recycling pickup: pick PET + paper, adjust kg, choose a photo (suggestion chips appear), paid mode shows an estimate, send. You land on `RCY-…`.
2. طلباتي: the pickup is listed; the "تدوير" chip shows only pickups; cancel works while requested.
3. Profile, then Collector mode: apply, "(Demo) Mark me as verified", see jobs and the map.
4. Open a job, accept, add weights (manual), finish. In airplane mode every step is saved and shown in the queue banner; "send now" flushes in order.
5. Back as the household: confirm the weighing; My recycling impact shows the kilos.
6. Map tab, Smart bins: tap a full bin, "report full", find the new garbage report in طلباتي.

## Not done yet

- Design-pack mockups for the CityCycle screens (screens follow the existing design system).
- Reading the sorting guide aloud, and the Bluetooth scale (the job screen shows "coming soon"; `source: scale_ble` exists in the contract).
- Real push notifications for pickup status (local notifications cover the status changes the app sees).
- Collector verification, price list and payouts live in the Command Center (admin web), not in the app.
