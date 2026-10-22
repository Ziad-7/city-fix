# Role brief — Hardware & IoT (Member 6)

**Owner:** _[member name]_ · **Branch prefix:** `feat/hw-…` (e.g. `feat/hw-bin-firmware`) · **Folder:** `hardware/` · **Starts:** now, on a bench; talks to the backend through a simulator until Member 4's device endpoints land.

## 1. Your mission

Build the physical side of **CityCycle** ([vision](../vision.md), [decision 0004](../decisions/0004-citycycle-waste-pillar.md)): a **solar-powered smart bin** that tells the city when it is full or hot, and an optional **collection-hub scale** that gives collectors a verified weight so they are paid by weight, not by guess.

This is the "software + hardware + physical science" part of the hackathon (innovation 20 points) and the source of the **Bill of Materials in EGP** and the **Field Deployment Brief** (economic and field feasibility, 20 points).

**Done means:** a prototype bin on the bench measures fill level and temperature, sleeps between readings, survives a network drop by buffering, and its readings appear on the Command Center bin map and in the app; the BOM is filled with checked local prices; and the Field Deployment Brief is written.

You don't build screens or the backend. You own firmware, schematics, enclosure, BOM and the device-side protocol.

## 2. Folder layout

```
hardware/
  firmware/        PlatformIO project for ESP32 (platformio.ini, src/, include/, test/)
  schematics/      wiring diagrams (KiCad or exported PNG/PDF) + pin table
  enclosure/       3D files (STL/STEP) or drawings, mounting notes
  bom/             bom.csv (see section 6)
  simulator/       (optional) script that posts fake readings, so the apps work before any board does
  README.md        how to build, flash, wire, test
```

## 3. The CityCycle smart bin

| Block | Choice (to confirm on the bench) | Why |
| --- | --- | --- |
| Controller | ESP32 dev board (deep sleep, Wi-Fi, BLE) | Cheap, common in Egypt, PlatformIO support |
| Fill level | Ultrasonic (JSN-SR04T, waterproof) or a ToF sensor (VL53L1X) | Distance from lid to waste; ToF is smaller, ultrasonic is cheaper. Try both. |
| Temperature | DS18B20 (waterproof) or a thermistor inside the bin | Heat or fire alert for the waste inside |
| Power | Small solar panel + Li-ion 18650 + charge controller (TP4056 with protection, or a proper solar charger) | Bins have no mains power |
| Connectivity | **GSM** (SIM800L or SIM7600) for street bins; **Wi-Fi** for bins at hubs, schools, malls | Streets have no Wi-Fi; check which 2G/3G/4G the chosen module needs on Egyptian networks |
| Power saving | Deep sleep, wake every **N minutes** (N set by the server, default to decide on the bench), measure, send, sleep | Battery life |
| Updates | OTA over Wi-Fi at hubs (optional) | Fix bugs without climbing the pole |

Firmware behaviour, in order:

1. Wake (timer, or tilt/lid switch if fitted), read fill distance (median of several samples), temperature, battery voltage.
2. Convert distance to `fillPct` using the bin's empty and full distances (calibrated once, stored in flash).
3. Append the reading to a small buffer in flash (RTC memory is not enough across power loss).
4. Try to send the buffer; delete only what the server acknowledged.
5. Apply any settings returned by the server (`intervalMin`, thresholds). Sleep.

Alerts are decided on the server from the readings, but the device sends **immediately** (does not wait for the next interval) when `fillPct` crosses the full threshold or `tempC` crosses the heat threshold. Both thresholds come from the server (**values to verify** on the bench and with the district).

### Collection-hub scale (optional, should-have)

A platform scale with a **load cell + HX711** and an ESP32. After taxing the empty platform, the collector (or the hub keeper) puts a material on the scale and confirms. The weight goes either:

- **over BLE to the collector's phone**, which fills the weight field in collector mode (works with no network), or
- **to the backend** with the hub's device key, as a weighing the app can attach to a pickup.

Why it matters: both sides see the same verified kg, so the price per kg is applied to a number nobody argues about. Calibrate with a known weight at setup; log the calibration factor; show "needs calibration" if it drifts.

## 4. Telemetry protocol

Devices use the same API as every client, with a per-device key instead of a user token. These routes are *proposed* in [`api-contract.md`](../api-contract.md#citycycle--proposed) and are agreed with Member 4 by contract PR first.

```
POST /iot/bins/{binId}/readings
Header: X-Device-Key: <per-device secret>
Body:
{
  "readings": [
    { "seq": 1042, "at": "2026-10-22T09:00:00Z", "fillPct": 72,
      "distanceCm": 31, "tempC": 38.5, "batteryV": 3.91,
      "rssi": -85, "fw": "0.1.0" }
  ]
}
Response 202: { "accepted": [1042], "intervalMin": 30, "fullPct": 80, "heatC": 60 }
```

- **`seq`** is a counter stored in flash; the server de-duplicates on `(binId, seq)`, so retrying is safe.
- **`at`** comes from the device clock (synced from the modem or NTP when available). If the clock is unknown, send `at: null` and the server stamps arrival time and marks the reading `clockUnsynced`.
- **Offline buffering:** keep readings until acknowledged; if the buffer is full, drop the oldest non-alert readings first. Send in batches (one request, many readings).
- **Retry:** on failure keep the buffer, back off (for example 1, 2, 4 minutes, capped), and try again on the next wake. Never loop awake until the battery dies.
- **Auth:** one random key per device, provisioned at flashing, stored hashed on the server; revoke by device. No keys in the repo (`hardware/firmware/include/secrets.h` is git-ignored; commit `secrets.example.h`).
- **Size:** keep the JSON small (GSM data is slow and may be metered).
- Hub scale: `POST /iot/hubs/{hubId}/weighings` with `{ "seq", "at", "material", "kg", "pickupId"? }`, same header and rules.

## 5. Egyptian field conditions

Design for these, and write the results in the Field Deployment Brief.

| Condition | Design response |
| --- | --- |
| **Heat** (street surfaces can reach about 45–50 °C in summer; confirm with your own logger) | Components rated for the temperature (check each datasheet); shaded, ventilated sensor housing; battery kept out of direct sun; charge cut-off at high battery temperature if a sensor is fitted. |
| **Dust and sand** | Enclosure rated **IP54 or better**; sealed cable glands; sensor face that can be wiped; ultrasonic cones kept clear of dirt build-up. |
| **Sun exposure** | Panel tilted and cleaned easily; enclosure colour and UV-resistant material (e.g. ASA or PETG, to verify); no dark sealed box in full sun. |
| **Vandalism and theft** | Hidden tamper screws; the solar panel and electronics inside the bin lid side, not on a pole; no expensive part visible; tamper switch sends an alert (stretch). |
| **Weak GSM** | Buffer and retry (section 4); small payloads; test signal at the real bin location; a Wi-Fi option for hubs. |
| **Wet, rain, washing** | Sealed against splashes at least; drain path inside the enclosure; conformal coating on the board if affordable. |
| **Smell, corrosion** | Coated or stainless fasteners; sensor window away from direct waste splash. |
| **Maintenance** | One person can swap the battery or board in minutes; LED blink codes; a service checklist in the Field Deployment Brief. |

## 6. Bill of materials in EGP

File: `hardware/bom/bom.csv`. One line per part, one file for the bin and one section for the scale. **Do not invent prices.** Leave `unit_price_egp` empty until a local supplier has quoted it, and set `price_date` when you fill it. Always check prices with local Egyptian electronics suppliers (for example the shops in Cairo's electronics districts, or Egyptian online stores for hobby electronics) before publishing the number; the table is a template, not a quote.

```csv
item,part,qty,unit_price_egp,line_total_egp,supplier,supplier_link,price_date,notes
controller,ESP32 dev board,1,,,,,,deep-sleep capable
fill_sensor,JSN-SR04T ultrasonic (or VL53L1X ToF),1,,,,,,compare both
temp_sensor,DS18B20 waterproof,1,,,,,,
solar_panel,,1,,,,,,sized from the battery-life estimate
battery,18650 Li-ion,1,,,,,,use a protected cell
charge_controller,,1,,,,,,with protection
gsm_module,SIM800L or SIM7600,1,,,,,,check network support
sim,data SIM,1,,,,,,monthly cost goes in running_costs
enclosure,IP54+ box + glands,1,,,,,,
misc,wires/connectors/fasteners,1,,,,,,
```

- `line_total_egp = qty × unit_price_egp` (a formula in the spreadsheet; computed total in the brief).
- Add **running costs** per bin per month (data SIM, battery replacement over time) as separate lines, also filled from real quotes.
- The brief reports: cost per bin, cost per hub scale, and which parts are available locally in Egypt vs. imported (and the lead time if imported).

## 7. Testing plan

| Test | How | Pass when |
| --- | --- | --- |
| **Bench** | Sensor above a box with a ruler; vary the distance | `fillPct` within a tolerance you set and record, repeatable across 20 readings |
| **Simulated full / empty** | Fill the test bin with crumpled paper; lid open and closed | Full alert is sent immediately; empty reading returns to near 0 |
| **Heat** | Put the bin sensor and enclosure in a warm place (hairdryer or a sunny car, with a logger) and record temperature and behaviour | No resets, readings valid, heat alert fires at the threshold |
| **Network loss** | Switch off Wi-Fi or remove the SIM for several intervals, then restore | All buffered readings arrive, no duplicates, `seq` continuous |
| **Battery-life estimate** | Measure sleep current and active current with a multimeter (record the method), then estimate: average current = (active current × active time + sleep current × sleep time) / total time; days = battery capacity ÷ average current ÷ 24; add the solar input estimate | The estimate and the measured inputs are written in the README; the formula is checked against a real discharge run if time allows |
| **Dust and water** | Splash and dust test of the sealed enclosure | No ingress |
| **End to end** | Bin → API → Command Center map → app map | The reading shows within one interval |
| **Scale** | Known weights (for example sealed bottles weighed on a kitchen scale) | Error written down; calibration procedure documented |

## 8. Work plan

| # | Milestone | Output |
| --- | --- | --- |
| 1 | PlatformIO project, blink and serial log, secrets example, `hardware-ci` green | `pio run` builds |
| 2 | Sensors: fill (ultrasonic and ToF), temperature, battery voltage | Readings on serial, calibration stored |
| 3 | Deep sleep loop + flash buffer + `seq` | Survives resets |
| 4 | Wi-Fi send to the simulator or the real API, then GSM | `POST /iot/bins/{id}/readings` works end to end |
| 5 | Alerts (immediate send on full / heat), server settings applied | Alert visible in the admin bin map |
| 6 | Schematic, enclosure, solar + battery sizing | Files in `schematics/` and `enclosure/` |
| 7 | BOM with real local prices; battery-life estimate | `bom.csv` filled, numbers in README |
| 8 | Scale: HX711, calibration, BLE (or API) weighing | Weight appears in collector mode |
| 9 | Field Deployment Brief (two pages, with Member 1) | PDF/Markdown for the submission |
| 10 | Demo rig and video shots | Bench demo + backup simulator run |

If the board is not ready on demo day, run the simulator: it sends the same payload, so every screen still works. Say so openly in the demo.

## 9. Hand-offs

- **Member 4 (API & DB):** you ask for the device registry (`bins`, `hubs`, device keys), the readings and weighings endpoints, and thresholds served in the response. You give the exact payload and the sample data.
- **Member 5 (AI):** you give a few days of real or simulated readings; they build fill forecasting and use bin positions for route optimisation.
- **Member 3 (admin web):** you give sample payloads and the alert rules so the bin telemetry map and fill/heat alerts show the right states.
- **Member 1 (mobile):** you give the BLE service and characteristic definition for the scale and the bin locations/IDs for the bin map layer. You write the Field Deployment Brief together.
- **Team:** the BOM, the architecture diagram input for the device part (with Member 4), and the hardware shots for the video.

## 10. Rules

- Stay in `hardware/` (plus your CI workflow and progress-log entry). Contract changes go by PR to `docs/api-contract.md`, tagging members 4, 3, 1.
- No secrets in the repo. Only `secrets.example.h` with placeholders.
- Never invent prices, battery life or accuracy: measure, record the method, and mark anything unconfirmed as **to verify**.
- Safety first: Li-ion batteries need protection circuits and a fused or protected path; no unattended charging tests.
- Feature list, acceptance checks and priorities: [`../features/member-6-hardware.md`](../features/member-6-hardware.md).
