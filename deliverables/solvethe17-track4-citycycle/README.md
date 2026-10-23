# CityFix — submission package

Track 4: **Unlocking Egypt’s Waste Economy** · Prepared 2026-10-23.

**CityFix is the project. CityCycle is its waste-and-recycling aspect**, alongside FixFirst, CityServe, CityOps, CityPulse and CityBrain. This Track 4 submission focuses on how CityFix addresses the waste challenge through CityCycle: recyclables pickup, collector workflows, recorded weights/payments and simulated smart-bin telemetry. Physical hardware is a design and simulation, not a built field unit.

## Required deliverables

| Requirement | Submit / open | Status and limits |
| --- | --- | --- |
| 1. Functional prototype / proof of concept | [Prototype runbook](PROTOTYPE-RUNBOOK.md) and [verification record](VERIFICATION.md) | Software plus PC/Wokwi simulation; reproducible local checks. No physical prototype is claimed. Hosted addresses are supplied by the team; live end-to-end acceptance is not certified here. |
| 2. Technical documentation, diagrams and estimated EGP BOM | [Technical documentation PDF](CityFix-Technical-Documentation.pdf), [editable source](TECHNICAL-DOCUMENTATION.md), [circuit PDF](CityFix-Circuit-Diagram.pdf), [estimated BOM CSV](CityFix-BOM-Estimate.csv) and [cost methodology](COST-ESTIMATE.md) | Architecture, process flowcharts, device protocol, wiring and budget included. Published supplier prices and quantities are documented; the custom mount needs a workshop quote. |
| 3. Two-page Field Deployment Brief | [Field brief PDF](CityFix-Field-Deployment-Brief.pdf) and [editable HTML](report-sources/field-brief.html) | Exactly two A4 pages; Egyptian operating conditions, accessibility, maintenance, cost and pilot gates. Proposed deployment, not field results. |
| 4. Technical presentation | [PPTX](CityFix-Pitch-Deck.pptx) and [PDF](CityFix-Pitch-Deck.pdf) | Existing team presentation preserved. Proposed improvements are already represented in the P1/P2/P3 slide sources. |
| 5. Demo video, 2–3 minutes maximum | Team-created video | Team reports it is created. **Skipped in this task at the team’s request**; the video is managed separately by the team. |

## Team-provided hosted addresses

- Citizen website: <https://city-fix-user.vercel.app/>
- Command Center: <https://city-fix-admin.vercel.app/>
- Backend: <https://city-fix-api-backend.vercel.app/>
- Backend-connected Android APK build: <https://expo.dev/accounts/abdulrahman-111s-team/projects/cityfix/builds/fe66cbe0-9afe-4541-bb61-d5c9efa24eba>

The cloud workspace could not reach the hosted domains because of its network policy. These are team-provided addresses, not independently verified uptime or Gemini claims. The operator reported Maps working in the earlier APK; that does not establish backend acceptance in this newer build.

## Final submission check

- Submit the technical PDF, field brief PDF, BOM CSV, circuit PDF and existing presentation.
- Video is managed separately by the team and was excluded from this documentation task.
- Follow the runbook on the demo machine; verify real login, photo upload/analysis and one pickup against the intended backend before claiming a live end-to-end demonstration.
- Keep DEMO labels on seeded prices, weights and impacts. Do not equate collected material with confirmed recycling, material value with collector profit, or simulated sensors with tested hardware.

## Rebuild the reports

The Markdown and HTML are editable sources. [Report export instructions](report-sources/README.md) explain regeneration and page-count checks. The [existing architecture](../../docs/architecture.md), [hardware design](../../hardware/README.md) and [supplier-evidence BOM](../../hardware/bom/bom.csv) remain the detailed engineering references.
