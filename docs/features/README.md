# CityCycle features: who builds what

**CityCycle (سيتي سايكل — إعادة التدوير)** is the waste and recycling pillar of CityFix ([vision](../vision.md), [decision 0004](../decisions/0004-citycycle-waste-pillar.md)). It is added next to what exists: nothing built so far changes.

## What CityCycle is

A circular-economy loop for an Egyptian district:

1. A household sorts recyclables (with a picture guide), requests a pickup, and sees what the material is worth.
2. A verified informal collector (Zabbal, الزبّال) sees nearby jobs, picks up, weighs, and records the payment.
3. Smart bins tell the district when they are full or hot; collection hubs with a scale give verified weights.
4. The Command Center sees tonnes diverted, bin alerts, routes, dumping hotspots and collector earnings.
5. AI suggests (waste type from a photo, when a bin will be full, the best route); people confirm.

The Track 4 theme asks for waste turned into economic value while elevating informal workers; every feature below serves that.

## Feature list

| # | Feature | Priority | Main owner |
| --- | --- | --- | --- |
| 1 | Recyclables pickup request (materials, kg, photo, slot, free or paid) | Must | 1, 2 (+4) |
| 2 | District material price list in EGP | Must | 3, 4 |
| 3 | Collector mode: jobs, accept, weigh, pay, earnings, offline-first | Must | 1 (+4) |
| 4 | Collectors registry and verification | Must | 3, 4 |
| 5 | Smart bin: telemetry, bin map, fill and heat alerts | Must (bench prototype or simulator) | 6, 4, 3 |
| 6 | Impact screens (kg, EGP, CO₂ with factors to verify) | Must (kg, EGP); CO₂ should | 1, 2, 3, 4 |
| 7 | CityCycle dashboard in the Command Center | Must | 3 |
| 8 | AI waste photo check | Should | 5 (+1, 2) |
| 9 | Picture-based sorting guide for low literacy | Should | 1, 2 |
| 10 | Hub scale with BLE weight to the collector's phone | Should | 6, 1 |
| 11 | Bin fill forecasting | Should | 5 |
| 12 | Collection route optimisation (OR-Tools VRP) | Should | 5, 3 |
| 13 | Dumping hotspot detection | Stretch | 5, 4, 3 |
| 14 | SMS / USSD gateway for feature phones | Stretch | 4 |
| 15 | OTA firmware updates, tamper alert | Stretch | 6 |

**Priority meaning:** *Must* = needed for the demo; *Should* = do it if the musts are green; *Stretch* = only with spare time.

## One file per member

| Member | File |
| --- | --- |
| 1 Mobile | [`member-1-mobile.md`](member-1-mobile.md) |
| 2 Citizen web | [`member-2-citizen-web.md`](member-2-citizen-web.md) |
| 3 Admin web | [`member-3-admin-web.md`](member-3-admin-web.md) |
| 4 API & database | [`member-4-api-database.md`](member-4-api-database.md) |
| 5 AI & smart features | [`member-5-ai.md`](member-5-ai.md) |
| 6 Hardware & IoT | [`member-6-hardware.md`](member-6-hardware.md) → brief [`../team/hardware-iot.md`](../team/hardware-iot.md) |

Each file lists the features, acceptance checks, what the member needs from whom, and priority.

## Dependencies and order

```
 contract PR (member 4 + clients)  ──►  mock data in every client (nobody waits)
        │
        ├─ 4: tables, price list, pickups, collectors ──► 1, 2, 3 switch to API mode
        ├─ 4: bins + device auth + readings ──► 6 sends real readings ──► 3 and 1 show the bin map
        ├─ 6: payload + simulator (day 1) ──► 4 and 3 build against it
        └─ 5: waste classify, forecast, routes (use 4's queries and 6's data)
```

1. **Day 1:** contract PR for the CityCycle section ([api-contract.md](../api-contract.md#citycycle--proposed)); every client builds on mock data; member 6 publishes the payload and the simulator.
2. **Then:** pickups and collector mode (the core story), then bins, then AI and routes.
3. **Last:** hotspots, SMS/USSD, OTA.

The demo story: a household requests a pickup, a collector accepts, weighs (scale or manual) and pays, the impact numbers move, a bin turns red on the Command Center map, and the route plan changes.

## Hackathon deliverables and owners

Required by SolveThe17 2.0: open-source repo, architecture and technical documentation with a BOM in EGP, a two-page Field Deployment Brief, a 3-minute video demo and a technical deck.

| Deliverable | Owner | Notes |
| --- | --- | --- |
| Open-source GitHub repo (clean README, licence, no secrets) | Member 1 (Abood), all contribute | The repo is already the working base |
| **Bill of Materials in EGP** with local sourcing | **Member 6** | [`hardware/bom/bom.csv`](../team/hardware-iot.md#6-bill-of-materials-in-egp); prices from real quotes only |
| **System architecture diagram** | **Member 4** (device part from member 6) | One diagram: apps, API, DB, AI, IoT |
| Technical documentation | Each member for their folder; member 1 assembles | Starts from [`docs/`](../README.md) |
| **Two-page Field Deployment Brief** (temperature, dust, bandwidth, rural-literacy UI) | **Members 6 + 1** | 6: heat, dust, power, GSM, maintenance. 1: low-bandwidth and low-literacy UI, offline-first |
| **3-minute video demo + technical deck** | **Member 1**, with everyone | Everyone supplies their segment (screen recording, hardware shots, accuracy slide) |

## Rules for all CityCycle work

- Add, don't change: existing screens, endpoints and enums keep working.
- Same identity, Egyptian Arabic plus English, gender-neutral copy, no religious content ([brand book](../design/brand-book.md)).
- No invented numbers: prices, CO₂ factors and thresholds say **to verify** until a source exists.
- Collector privacy: no citizen phone or name to collectors; earnings visible only to the collector and admins.
- Contract first: new endpoints and fields start as a PR to [`api-contract.md`](../api-contract.md).
