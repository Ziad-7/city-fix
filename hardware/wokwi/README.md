# CityCycle Wokwi prototypes

These are two independent ESP32 Arduino browser projects: a simulated smart bin and a simulated collection-hub scale. They are free-plan-friendly source files; no Wokwi login token, paid VS Code simulation, outside service, or existing PC simulator process is required for the **local mock** walkthrough. The `hardware/simulator/` PC panel remains a separate demo. It does not receive Wokwi serial data.

No hosted Wokwi project links are published here. Create each free Wokwi project yourself so the source is genuinely attached to your account. The compiler and diagrams were checked locally; this workspace could not run an interactive Wokwi simulation. See the evidence and limits below before treating the models as hardware validation.

## Make each browser project

Repeat these steps separately for `smart-bin/` and `hub-scale/`:

1. Create a new **ESP32 Arduino** project in Wokwi.
2. Replace its `diagram.json` with the matching folder's diagram.
3. Replace `sketch.ino`, and add `core.h` as a project file.
4. Add `libraries.txt` with the listed libraries and versions. Wokwi should resolve the listed Arduino libraries in its project environment.
5. Start the simulation and open Serial Monitor at **115200 baud**. The diagrams are pin-to-pin source; the pin tables below are the wiring reference.

`platformio.ini` is optional for local builds. It does not add a prerequisite to use the browser project. `tests/native/core_test.cpp` is a host-only test, not a Wokwi tab.

## Smart-bin circuit

The project starts in **LOCAL MOCK — NO HTTP**, with fast demo timing enabled. Serial prints the proposed JSON payload separately from a clearly labeled local receiver decision. A local mock response never means that the payload reached the PC adapter or a backend. HTTP remains disabled until the user selects it and supplies runtime endpoint/key settings.

| Function | ESP32 pin | Diagram part |
| --- | --- | --- |
| HC-SR04 trigger / echo | D5 / D18 | `wokwi-hc-sr04`; starts at 24 cm |
| DS18B20 data | D4 | `wokwi-ds18b20`, 4.7 kΩ pull-up to 3V3 |
| Synthetic battery ADC | D34 | 3V3 potentiometer, mapped in firmware to 3.0–4.2 V |
| OLED SDA / SCL | D21 / D22 | SSD1306, I²C address `0x3C` |
| Network switch | D27 | Slide switch, ON selects the simulated connection |
| Solar/daylight switch | D26 | Slide switch; charging indicator is a software state |
| Sample button | D25 | Active-low with internal pull-up |
| Full / heat / network LEDs | D13 / D14 / D19 | Each LED has a 220 Ω series resistor |
| Charging indicator LED | D23 | 220 Ω series resistor, shown only for solar on and battery below 4.15 V |

The OLED and Serial describe fill, temperature, battery, full/heat flags, network, solar/charging, local/HTTP mode, outbox count, and sample/send/retry state. Serial also prints the simulated RSSI (`-55 dBm` online, `-127 dBm` offline), latest ACK/error, and wake/retry countdown. The OLED is small, so Serial is the more complete status view. Sensor readings are sampled without freezing the loop for the DS18B20 conversion. Five range samples are reduced to their median; 100 cm maps to 0% and 5 cm to 100%. A timeout or invalid distance produces **SENSOR FAULT**, never a fabricated empty bin. An unavailable temperature is omitted from the optional wire fields and is displayed as unavailable.

Default policy is 30 minutes, 80% full, and 60 °C. Equality activates a threshold. A crossing from below queues an immediate send; remaining above does not repeat that edge, and a valid below-threshold sample re-arms it. The demo's fast timing visibly scales 30 minutes to 30 seconds without changing the wire or stored policy. `timing real` uses real minutes. Low synthetic battery below 3.4 V doubles the sampling interval; below 3.1 V, HTTP/mock delivery pauses and pending rows remain queued until the potentiometer is raised. These thresholds and voltages are illustrative only.

| Serial command | Effect |
| --- | --- |
| `help`, `status`, `sample`, `send` | Show commands/status, sample, or request an immediate send |
| `network on`, `network off`, `network auto` | Override the physical switch, or return to switch control |
| `solar on`, `solar off`, `solar auto` | Override the simulated daylight switch, or return to switch control |
| `mode mock`, `mode http` | Choose local deterministic mock or optional real HTTP |
| `mock policy <minutes> <fullPct> <heatC>` | Set the mock receiver's policy; device policy changes only after a valid response |
| `mock partial`, `mock fail-next`, `mock bad-ack` | Exercise partial ACK, lost response after receiver commit, and unknown ACK handling |
| `timing fast`, `timing real` | Change only the visible schedule scaling |
| `endpoint <baseURL>`, `key <disposable-key>` | Runtime-only HTTP configuration; key is never printed or saved in NVS |
| `tls verify`, `tls insecure-demo` | Require an installed public CA root, or explicitly show **TLS UNVERIFIED DEMO** for a disposable tunnel/key |

An `endpoint` is a base URL; firmware appends `/iot/bins/bin-sim-001/readings`. HTTP sends batches of at most eight readings with `X-Device-Key`. Only an exact `202` body containing the four expected keys and a valid accepted subset can commit outbox deletion and policy together. The reply parser caps the decoded body at 1,024 bytes and reads it with a three-second body deadline; oversized, truncated, or timed-out replies retain the outbox. HTTPS uses CA verification only when a public root certificate is supplied in an added `root_ca.h` file:

```cpp
#pragma once
#define CITYCYCLE_ROOT_CA R"CITYCYCLE_CA(
-----BEGIN CERTIFICATE-----
paste the public CA certificate PEM here
-----END CERTIFICATE-----
)CITYCYCLE_CA"
```

That placeholder is intentionally not a usable certificate. Never put a private key there. `tls insecure-demo` is permitted only for a throwaway tunnel and disposable device key; the status remains visibly **TLS UNVERIFIED DEMO**. Do not use it for real backend provisioning. Redirects are disabled. Network off or critical battery blocks HTTP, preserves immutable queue rows and sequence numbers, and remains recoverable from the controls.

## Collection-hub scale circuit

The scale is a separate ESP32 project. It provides only Serial and a local mock receiver; scale HTTP/backend receipt is deliberately deferred because the proposed weighings route has no agreed response contract. A simulated mock ACK is explicitly **not backend delivery**. The Wokwi HX711 represents a 50 kg cell; the initial conversion is 420 raw units/kg. The operator must tare an unloaded platform, then calibrate with a known simulated reference weight before confirming weighings. Calibration is stored as simulated configuration; it does not establish accuracy.

| Function | ESP32 pin | Diagram part |
| --- | --- | --- |
| HX711 DT / SCK | D32 / D33 | Wokwi HX711 50 kg model |
| OLED SDA / SCL | D21 / D22 | SSD1306, I²C address `0x3C` |
| Tare / confirm buttons | D25 / D26 | Active-low, debounced; tare only on an unloaded platform |
| Network switch / status LED | D27 / D19 | Network gates mock delivery; LED indicates connection state |

Serial commands: `help`, `status`, `tare`, `calibrate <known-kg>`, `material <MaterialId>`, `pickup <id>`, `pickup clear`, `network on|off|auto`, `confirm`, `send`, `mock fail-next`. Supported materials are exactly `pet_plastic`, `paper_cardboard`, `metal_cans`, `glass`, `e_waste`, `cooking_oil`, and `organics`; matching is case-sensitive. The material defaults to `pet_plastic`; `pickupId` is omitted unless set. Confirmation is operator-controlled and a held/bouncing button produces one immutable queued weighing. Unavailable, negative, nonfinite, unstable, or uncalibrated values are rejected. The queue persists in Preferences/NVS up to 32 rows; it does not auto-send individual samples. Offline confirmed rows and sequence numbers are retained. Local mock ACK rows are persisted separately so a simulated response loss can be retried idempotently.

The proposed future shape is `{seq,at:null,material,kg,pickupId?}` for `/iot/hubs/{hubId}/weighings`. This prototype does not send that payload over HTTP and does not claim that a backend or a phone received it.

## Optional PC receiver for the bin

The local mock is sufficient for all circuit-only scenarios. To observe an actual HTTP request on the PC, start the standalone adapter in a separate terminal. It is bound to loopback port **8776** only and uses the existing mock receiver/storage helpers without starting the PC panel or worker.

Linux/macOS:

```sh
export CITYFIX_DEVICE_KEY="<fresh-disposable-key>"
export CITYFIX_BIN_ID="bin-sim-001"
python3 hardware/wokwi/receiver.py
```

Windows PowerShell:

```powershell
$env:CITYFIX_DEVICE_KEY = "<fresh-disposable-key>"
$env:CITYFIX_BIN_ID = "bin-sim-001"
py -3 hardware/wokwi/receiver.py
```

The adapter stores deduplicated readings in `hardware/wokwi/.data/receiver.sqlite3` by default; set `CITYFIX_RECEIVER_DATA` to use another directory. Optional `CITYFIX_RECEIVER_PORT` changes the loopback port. It prints unique reading count, latest sequence/fill/temperature and full/heat conditions without printing the key. Missing optional temperature remains unavailable. Replayed identical sequence/payload pairs ACK idempotently without increasing the stored count; conflicting reuse returns 409.

Wokwi's browser virtual network cannot contact the user's `127.0.0.1` directly. External receipt is an optional, unverified path: expose only port 8776 with a user-installed HTTPS tunnel and configure the tunnel's upstream Host as `127.0.0.1:8776` so the adapter's strict Host check remains in force. One commonly used cloudflared form is:

```sh
cloudflared tunnel --url http://127.0.0.1:8776 --http-host-header 127.0.0.1:8776
```

Check `cloudflared tunnel --help` for the installed release before use; no tunnel URL is supplied here. Copy the URL printed by your own tunnel into the Wokwi Serial Monitor with `endpoint https://<your-current-tunnel-host>`, then select `mode http`, set a fresh runtime key, and only if no CA can be configured use `tls insecure-demo` for this disposable test. Stop the tunnel after testing. The tunnel was not started or verified in this workspace, and availability through Wokwi's public gateway is not claimed. Do not expose the PC panel on port 8765 or any control, file, shell, or status route.

## Local checks and evidence

```sh
g++ -std=c++17 -Wall -Wextra -Werror -Ihardware/wokwi/smart-bin \
  hardware/wokwi/smart-bin/tests/native/core_test.cpp -o /tmp/smart-bin-core-test
/tmp/smart-bin-core-test
g++ -std=c++17 -Wall -Wextra -Werror -Ihardware/wokwi/hub-scale \
  hardware/wokwi/hub-scale/tests/native/core_test.cpp -o /tmp/hub-scale-core-test
/tmp/hub-scale-core-test
python3 -m unittest discover -s hardware/wokwi/tests -v
```

With PlatformIO installed and registry access available, `platformio run -d hardware/wokwi/smart-bin` and `platformio run -d hardware/wokwi/hub-scale` build the sketches. These local ESP32 builds do not prove that Wokwi component simulations, NVS behavior across stop/recreate, or public Wi-Fi gateway access work interactively.

No physical bin/scale, waterproof JSN-SR04T, battery/charger, solar energy, GSM, payment, Bluetooth, OTA, Android/iOS, or backend behavior has been validated. In real hardware the simulated HC-SR04 is replaced by a waterproof distance sensor; the HC-SR04 echo is 5 V and **must be divided or level-shifted** (for example 1 kΩ high-side and 2 kΩ low-side) before an ESP32 input. Real Li-ion measurement needs a designed divider, protected battery/charger and power path. The synthetic potentiometer is powered by 3.3 V; never connect a 4.2 V battery directly to an ESP32 ADC. Wokwi's synthetic controls are not a charging or power model.
