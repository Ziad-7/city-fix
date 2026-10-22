# 0004 — Add CityCycle (waste and recycling) as a main pillar, and a hardware member

- **Date:** 2026-10-22
- **Status:** Accepted
- **Builds on:** [0002](0002-citizen-web-portal-alongside-mobile.md), [0003](0003-rename-to-cityfix.md)

## Context

CityFix is entered in the SolveThe17 2.0 hackathon (IEEE EUI) under **Track 4 · SDG 11 "Unlocking Egypt's Waste Economy"**: a circular economy framework that turns waste into economic value, raises informal sector workers and improves urban environmental health. The judges score local context and impact (25), technical rigor and MVP (25), innovation and interdisciplinarity (20), economic and field feasibility (20) and communication (10). They require an open-source repo, architecture and technical documentation with a **Bill of Materials in EGP**, a two-page **Field Deployment Brief**, and a 3-minute demo video with a deck.

Today CityFix handles waste only as a complaint ("garbage" category in FixFirst) and as a municipal booking (bulky waste in CityServe). Nothing connects waste to value, to informal collectors, or to hardware.

## Decision

1. **Add CityCycle (سيتي سايكل — إعادة التدوير) as a main pillar** next to FixFirst, CityServe, CityOps, CityPulse and CityBrain. It covers recyclables pickup, collector mode for informal collectors, a district material price list, smart bins and collection-hub scales, and impact reporting. Vision: [`docs/vision.md`](../vision.md). Feature plan: [`docs/features/`](../features/README.md).
2. **Keep everything that exists.** No existing screen, endpoint, enum value, table or brief changes behaviour. CityCycle is added through new screens, new proposed endpoints, new tables and new files. Where an existing doc needs a mention, it gets an addition, not an edit of what is there.
3. **Add Member 6, Hardware and IoT**, owning `hardware/` (ESP32 firmware, schematics, enclosure, BOM), branch prefix `feat/hw-…`. Brief: [`docs/team/hardware-iot.md`](../team/hardware-iot.md). The team goes from 5 to 6.
4. **Recyclables pickups are a separate entity, not a new `ServiceType`.** Reasons: a pickup has a second actor (the collector) and a different lifecycle (requested, accepted, weighed, paid), carries materials, weights and money, and is shown in collector mode. Putting it in `ServiceRequest.details` would overload a shape three clients already use. `ServiceType` stays `bulky_waste | tree_maintenance`. The citizen's "my requests" list can show both lists together on the client.
5. **Hardware talks to the backend like any client**: the same API, device-authenticated, with the same contract-first rule.
6. **Money is recorded, not processed.** The MVP logs what a collector pays or gets paid (cash, as today's market works). Payment-provider integration is out of scope.

## Consequences

- The contract gets a "CityCycle — proposed" section; members 1, 2, 3 are tagged on every change as before. Member 4 owns it; members 5 and 6 own the AI and IoT routes.
- New roles in the backend: `collector` (plus a device identity for bins and scales).
- New CI workflow `hardware-ci.yml`, skipped cleanly until `hardware/firmware/platformio.ini` exists.
- Scope risk: seven days is short. Each feature file marks **must / should / stretch**; only the *must* items are needed for the demo, and the hardware demo can run on a bench prototype plus a simulator that posts the same payload.
- New privacy duties: collector identity and earnings are personal data; bin and scale telemetry is not.
- Prices, emission factors and thresholds are unknown today and are marked **to verify**; nothing on the product or in the pitch shows an unverified number.
- Existing members gain tasks (see [`features/`](../features/README.md)); their existing briefs stay valid.
