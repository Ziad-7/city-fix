# CityFix vision: a sustainable Egyptian city

*سيتي فيكس: مدينة أنضف، وخدمات أسرع، وزبالة بقت فلوس.*

CityFix is one platform for the daily life of an Egyptian city: **fix what is broken, book the services you need, and turn waste into value**. This page is the complete picture. Everything described in the existing docs stays exactly as built; **CityCycle** is added as one more main pillar ([decision 0004](decisions/0004-citycycle-waste-pillar.md)).

## Why waste is a pillar

CityFix is entered in the SolveThe17 2.0 hackathon (IEEE EUI) under **Track 4 · SDG 11 "Unlocking Egypt's Waste Economy"**:

> How might we establish a structured circular economy framework in Egypt that transforms waste streams into economic value while elevating informal sector workers and improving urban environmental health?

Facts from the theme (the only numbers on this page that are not ours to measure):

- About **20 million tonnes** of municipal solid waste a year (EEAA).
- Cairo's informal collectors, the **Zabbaleen (الزبالين)**, recover **up to 80%** of the waste they gather.

CityFix already knows where garbage piles up (FixFirst) and already books bulky-waste pickups (CityServe). CityCycle closes the loop: sorted recyclables go to the people who recover them, the collector gets a fair and verified price, the household sees the result, and the district sees where bins overflow and where dumping keeps coming back.

## The pillars

| Pillar | What it is | Status |
| --- | --- | --- |
| **FixFirst** | Report a problem, explainable priority score, budget planning. | Existing |
| **CityServe** | Municipal service requests: bulky-waste pickup, tree maintenance, garbage schedule. | Existing |
| **CityCycle** (سيتي سايكل — إعادة التدوير) | **New.** Recyclables pickup, collector mode for informal collectors, smart bins, collection hubs with scales, material prices, impact. | New |
| **CityOps** | Work orders, department assignment, status updates. | Existing |
| **CityPulse** | The live map: incidents, and (new) smart bins and dumping hotspots. | Existing (incidents); bins and hotspots new |
| **CityBrain** | AI triage, now also waste photo check, fill forecasting, route optimisation, hotspot detection. | Existing; waste features new |

## How they connect

```
 Citizen app (mobile + web)                    Collector mode (same app)
 report · book · sort & give                   jobs · weigh · get paid
          │                                              │
          └──────────────┬───────────────────────────────┘
                         ▼
        ┌───────────────────────────────────────┐
        │  One backend + one database (PostGIS)  │ ◄── IoT: smart bins, hub scales
        │  FixFirst · CityServe · CityCycle      │      (ESP32, GSM or Wi-Fi)
        └───────────────┬───────────────────────┘
                        │                ▲
                        ▼                │ suggestions only
        ┌───────────────────────┐   ┌─────────────┐
        │ Command Center (web)   │   │ CityBrain AI │
        │ CityOps · CityPulse    │   │ photo · forecast · routes
        └───────────────────────┘   └─────────────┘
```

- **One citizen app:** the same account reports a pothole, books a tree trim, and schedules a recyclables pickup. A collector switches to collector mode in the same app.
- **One Command Center:** district staff see incidents, work orders, bin alerts, collector payouts and dumping hotspots on one map.
- **One backend:** the same API, auth and database; CityCycle adds tables and endpoints, it does not replace any ([api-contract.md](api-contract.md)).
- **AI across all of it:** CityBrain only suggests; a person confirms (existing rule).
- **IoT across all of it:** a smart bin reports its fill level like a citizen reports a problem: it becomes data the Command Center acts on.

## Who benefits

| Who | What changes |
| --- | --- |
| **Citizens** | Sort at home with a picture guide, schedule a pickup, see what the material is worth, choose to give it for free or get paid, see their own impact. Overflowing bins and dumping get reported and fixed. |
| **Informal collectors (Zabbaleen)** | Nearby pickup jobs on a map, verified weights, a record of earnings, payment per kg from a published district price list, no middleman guessing the weight. Works offline-first and with a low-literacy UI. |
| **Districts** | Bins are emptied when full, not on a fixed guess; routes are shorter; dumping hotspots are visible and cleared; tonnes diverted from landfill are measured, not estimated. |

## Impact we will show

Every metric comes from data the platform records. Targets are set after the first pilot data; none is invented here.

| Metric | Source of the number |
| --- | --- |
| **kg diverted from landfill** (by material, by district) | Weighings confirmed by the collector or the hub scale |
| **EGP earned by collectors** | Pickup payments + purchases logged in collector mode, at the district price list |
| **Pickup response time** | Time from request to collector acceptance, and to completed weighing |
| **Bins that never overflow** | Share of time each smart bin stayed under its full threshold; count of "full" alerts that were emptied within the target time (target to set) |
| **Dumping hotspots cleared** | Hotspots detected (repeat reports in one area) vs. cleared, with time to clear |
| **CO₂ avoided** (secondary) | kg by material × an emission factor per material (**factors to verify**, with a source, before we show this number) |

## The five grading criteria and what CityFix shows

| Criterion (points) | What CityFix shows |
| --- | --- |
| **Local context and impact (25)** | Directly answers the Track 4 question: waste into economic value, informal collectors raised from invisible to paid and verified, better urban health through fewer overflowing bins and fewer dumps. Egyptian Arabic and English, picture-based sorting for low literacy, SMS/USSD reporting for feature phones (stretch), district price list in EGP. Measurable benefit: the metrics above. |
| **Technical rigor and MVP (25)** | Working citizen app and website, Command Center, FastAPI + PostGIS backend with a documented contract, collector mode with offline-first sync, device-authenticated telemetry, OR-Tools routing, CI per folder, tests, accuracy numbers for the AI on a labelled set. |
| **Innovation and interdisciplinarity (20)** | Software + hardware + physical science: ESP32 smart bin (ultrasonic or ToF fill level, temperature for heat or fire risk, solar power, deep sleep) and a hub scale (load cell) whose verified kg pay collectors; computer vision for waste type; GIS for pickups, routes and hotspots; ML for fill forecasting. |
| **Economic and field feasibility (20)** | Bill of Materials in EGP with local suppliers ([`hardware/bom/bom.csv`](team/hardware-iot.md#6-bill-of-materials-in-egp), prices **to verify** with suppliers), local availability of every part, maintenance plan, enclosure rated for dust and sun, designed for 45–50 °C, weak GSM, vandalism and theft. |
| **Technical communication and pitch (10)** | System architecture diagram ([`architecture.md`](architecture.md)), technical documentation in this repo, the two-page Field Deployment Brief, a 3-minute demo video and a technical deck (outlines in [`pitch/`](pitch/README.md)). Owners in [`features/README.md`](features/README.md#hackathon-deliverables-and-owners). |

## What is not claimed

- No savings, tonnage or income figure is promised before there is pilot data.
- CO₂ factors, material prices and bin thresholds are marked **to verify** wherever they appear.
- AI output is a suggestion; money moves only after a human (collector or household) confirms.

## Where to read next

- Feature plan per member: [`features/README.md`](features/README.md)
- Hardware: [`team/hardware-iot.md`](team/hardware-iot.md)
- Team and hand-offs: [`team/README.md`](team/README.md)
