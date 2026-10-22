# CityCycle smart-bin simulator

This folder contains a PC simulator for smart-bin telemetry. It runs a local browser panel and durable SQLite outbox. By default it uses a local mock receiver; in `real` mode it sends device-authenticated readings to the CityFix API, where staff can inspect bins and history in the Command Center at **الحاويات الذكية**. The browser-only fleet demo is served publicly at `/smart-bin-simulator.html` when the `apps/web` site is deployed to Vercel. It uses sample data in that visitor's browser and never writes to the API.

## Start it

From the repository root, with Python 3.12 or later:

```sh
python hardware/simulator/run.py
```

On Windows:

```powershell
py -3 hardware\simulator\run.py
```

No pip packages are needed. The panel opens at <http://127.0.0.1:8765>. To keep it in the terminal without opening a browser, add `--no-browser`. The mock receiver listens on `127.0.0.1:8766`; the browser panel and receiver use separate local services.

Options include `--port 8785`, `--mock-port 8786`, and `--data-dir C:\CityCycle\demo-data` (or `--data-dir /tmp/citycycle-demo`). The default data directory is `hardware/simulator/.data`, anchored to this script rather than the current working directory. If a port is in use, choose another port. The panel and mock ports must be different.

## Try the controls

Adjust fill, temperature, and battery voltage with either the sliders or numeric fields, then choose **Record reading**. The page shows the device's current conditions separately from the latest reading confirmed by the mock receiver. Choose **Send now** to deliver queued samples. Turn **Device network** off to keep sampling while delivery is paused; queued readings remain on disk and are sent after network is restored. Full and heat conditions trigger at their configured threshold, including equality. The auto-fill switch is an accelerated demo that adds five percentage points every five seconds and stops at 100%.

The mock receiver section lets you change its sample interval and alert thresholds. The device applies those settings when it receives the next valid response. Receiver readings are de-duplicated by bin and sequence. The page marks queued and receiver-confirmed readings separately and displays receiver-derived full/heat flags.

For a restart demonstration, turn the device network off, record a full/heat reading and then a normal reading, stop the process with Ctrl+C, and start it again with the same data directory. It starts offline, keeps the queue and sensor/threshold state, and assigns later readings a larger sequence. Restore the device network to drain the backlog. The receiver count will not increase when identical sequences are retried.

## Configuration

Mock mode is the default. It uses `BIN-SIM-001`, the demo thresholds (30 minutes, 80% full, 60 °C heat), and a fresh random device key each launch. The demo values are examples, not district settings.

Real mode requires the deployed API and a bin provisioned by an admin. In the Command Center API, `POST /admin/bins` creates a bin and returns a one-time `deviceKey`; save it securely because it is not shown again. The registration request uses camelCase fields, for example:

```json
{"id":"BIN-SIM-001","name":"Demo bin","district":"القاهرة","lat":30.0444,"lng":31.2357,"isSimulated":true}
```

Configure the simulator with that returned key and the deployed API base URL. Use HTTPS except when the endpoint is a literal loopback address. Do not put credentials, query parameters, or fragments in the base URL; readings are posted under `/iot/bins/{binId}/readings`.

PowerShell:

```powershell
$env:CITYFIX_SIM_MODE = 'real'
$env:CITYFIX_BIN_ID = 'BIN-SIM-001'
$env:CITYFIX_API_BASE_URL = 'https://api.example.test'
$env:CITYFIX_DEVICE_KEY = 'replace-with-provisioned-key'
py -3 hardware\simulator\run.py --no-browser
```

POSIX shell:

```sh
export CITYFIX_SIM_MODE=real
export CITYFIX_BIN_ID=BIN-SIM-001
export CITYFIX_API_BASE_URL=https://api.example.test
export CITYFIX_DEVICE_KEY=replace-with-provisioned-key
python hardware/simulator/run.py --no-browser
```

Never paste a device key into a committed file or share it in a screenshot. The simulator does not store the device key in SQLite. Real endpoint mode does not start a mock receiver. Accepted readings and current status appear in the authenticated Command Center; the public browser demo remains isolated from production data.

## Data and limits

The device outbox and mock receiver use separate SQLite files under the selected data directory. Select a new `--data-dir` for a clean demo. Existing data is tied to its bin, mode, and target URL; the simulator refuses to reuse it with a different identity. To reset a demo, stop it and choose a new directory. No queued reading is automatically evicted.

The implemented telemetry and staff API shape is documented in [API contract](../../docs/api-contract.md#smart-bin-telemetry-and-command-center) and [backend README](../../backend/README.md#smart-bin-telemetry-and-command-center). The simulator is not firmware and does not validate physical sensors. Mobile-device integration and physical-bin validation remain future work.

## Online hosting and free-tier limits

The public interactive simulator is a static HTML/CSS/JavaScript page with no paid model, server process, or database. It can be hosted with the existing `apps/web` Vercel deployment at `/smart-bin-simulator.html`; its editable demo state stays in the visitor's browser storage. The API ingestion path is separate: deploy the FastAPI backend and a persistent database, then configure the Command Center's `NEXT_PUBLIC_API_URL` and the simulator's real-mode variables. The backend's SQLite default is for development and is not suitable for an ephemeral serverless filesystem. A free host may sleep, impose quotas, or change its free tier; continuous live telemetry and durable hosted history cannot be promised as permanently free. The local demo and static online simulation remain free to run.

## Checks

```sh
python -m unittest discover -s hardware/simulator/tests -v
python -m compileall -q hardware/simulator
```
