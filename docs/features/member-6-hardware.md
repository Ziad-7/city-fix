# CityCycle — Member 6 · Hardware & IoT

Full brief: **[`../team/hardware-iot.md`](../team/hardware-iot.md)**. Folder `hardware/` · branch `feat/hw-…`.

## Features

| # | Feature | Priority |
| --- | --- | --- |
| 1 | **Smart bin firmware** (ESP32, PlatformIO): fill level (ultrasonic or ToF), temperature, battery, deep sleep every N minutes, flash buffer, retry. | Must |
| 2 | **Telemetry** to `POST /iot/bins/{id}/readings` with a per-device key; immediate send on full or heat. | Must |
| 3 | **Simulator** that posts the same payload, so apps and dashboard work before the board does. | Must |
| 4 | **BOM in EGP** (`hardware/bom/bom.csv`) with local suppliers; prices only from real quotes. | Must |
| 5 | **Field Deployment Brief** hardware sections (heat, dust, sun, GSM, vandalism, maintenance), with member 1. | Must |
| 6 | Solar panel, Li-ion and charge controller sizing; battery-life estimate with the method written down. | Should |
| 7 | **Collection-hub scale** (load cell + HX711), BLE weight to the collector's phone or API weighing. | Should |
| 8 | Schematic and enclosure (IP54+). | Should |
| 9 | OTA updates, tamper alert. | Stretch |

## Acceptance checks

- A bench bin sends a reading, it shows on the Command Center bin map, and a simulated full bin raises an alert.
- Network drop test: no lost or duplicated readings.
- `pio run` builds in `hardware-ci`.
- BOM has no invented price; every filled price has a supplier and a date.

## Needs from whom

| From | What |
| --- | --- |
| 4 | Device registry, readings and weighings endpoints, thresholds in the response |
| 3 | Alert rules as shown in the dashboard |
| 5 | What data shape forecasting wants |
| 1 | BLE service definition agreed for the scale |
