# Functional proof-of-concept runbook

The deliverable is a software proof of concept plus simulated hardware. A physical unit is not required to demonstrate this version and is not claimed. Never show a local mock ACK as receipt by the real backend.

## A. Lowest-dependency demonstration: smart-bin PC simulator

Requires Python 3.12+, a browser, and no purchased hardware or pip dependencies.

```sh
python hardware/simulator/run.py --no-browser --data-dir /tmp/citycycle-submission-demo
```

On Windows, use `py -3 hardware\simulator\run.py --no-browser --data-dir citycycle-submission-demo`.

Open <http://127.0.0.1:8765>. This is local mock mode:

1. Record a normal reading and choose Send now. Show the receiver-confirmed reading separately from device state.
2. Set fill to at least 80% and temperature to at least 60 °C; record/send and show the full/heat conditions. These are illustrative thresholds.
3. Turn Device network off, record several readings, and show the queued count.
4. Stop and restart with the same data directory; show the queue survived.
5. Restore the network and send; show delivery and no duplicate receiver rows on retries.

This demonstrates the panel, durable queue, alert logic and local receiver. It does not prove solar charging, GSM, physical accuracy, or receipt by a deployed API. See [simulator instructions](../../hardware/simulator/README.md).

## B. Full software flow with a local backend

Requires Python 3.12+, `uv`, Node.js and npm. Use a disposable local database; do not reset a shared or live database.

Terminal 1:

```sh
cd backend
uv sync --extra dev
JWT_SECRET=local-demo-only-secret-at-least-32-bytes OTP_MODE=demo LOCAL_SCHEMA_BOOTSTRAP=true SEED_ON_START=true uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
cd apps/web
npm ci
NEXT_PUBLIC_API_MODE=api NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- --port 3000
```

Terminal 3:

```sh
cd apps/admin-web
npm ci
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run dev -- --port 3001
```

These environment assignments use POSIX shell syntax. On PowerShell set each variable with `$env:NAME = 'value'` before running the command. Use the demo identities and staff sign-in instructions in the [root README](../../README.md); demo OTP settings must not be used for real users.

Show one household requesting two materials, a verified collector accepting the job, recording material weights and cash paid, completing it, and household confirmation. Show the matching admin pickup and history. Amounts are records, not electronic transfers. The demo must be labelled as seeded data.

For actual device-to-backend receipt, register a simulated bin with `POST /admin/bins`, retain its one-time device key privately, and start the PC simulator in real mode with `CITYFIX_SIM_MODE=real`, `CITYFIX_API_BASE_URL=http://127.0.0.1:8000`, `CITYFIX_BIN_ID` and `CITYFIX_DEVICE_KEY`. Follow the [real-mode instructions](../../hardware/simulator/README.md); show the same ID and sequence in the Command Center. A Wokwi scale cannot substitute here: it currently uses a local mock only.

## C. Mobile and hosted deployment acceptance

Install the APK from the build linked in [the package index](README.md). Its preview EAS environment is configured with `EXPO_PUBLIC_API_MODE=api` and `EXPO_PUBLIC_API_URL=https://city-fix-api-backend.vercel.app`. Sign out of a persisted demo session and log in against the backend. A standalone APK does not require a Metro tunnel.

Check these on the test phone before recording a live demonstration:

- Backend health responds; real login/OTP works under the deployment's configured provider or explicitly labelled demo OTP mode.
- Existing account and pickup history load from the intended database.
- Photo upload succeeds. With explicit photo consent and a backend Gemini key, analysis succeeds; otherwise the fallback is identified as a fallback.
- A created pickup appears in the Command Center and follows the collector flow.
- Offline queued work reconnects once without duplicate records.

The Google Maps key is separate from the server-side Gemini key. Never embed a Gemini key in `EXPO_PUBLIC_*` or commit device keys. Live database migrations, secret setup and provider configuration are operator actions; this documentation performs none of them.

## D. Wokwi circuit demonstration

Use the [free-plan Wokwi walkthrough](../../hardware/wokwi/README.md) for the smart-bin and hub-scale source projects. Show distance/temperature changes, persistent queue logic, scale tare and calibration. Label both as simulated circuits. An interactive Wokwi session and public gateway connectivity were not validated in this workspace.
