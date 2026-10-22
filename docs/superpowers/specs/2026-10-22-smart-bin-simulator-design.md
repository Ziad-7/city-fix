# CityCycle PC smart-bin simulator design

Date: 2026-10-22. Scope: an explicitly simulated PC demonstration for Member 6; no board is required.

## Intent and boundaries

Build one simulated smart bin that can be controlled in a local browser. Demonstrate fill and heat events, durable offline buffering, actual HTTP delivery, retries, server settings, and acknowledgement-based deletion. A Windows user should start the whole demo with one command and no pip installation.

The user accepted this direction and authorized routine implementation choices. This artifact records those choices for the requested GPT-6 Luna implementation and GPT-6.1 Sol review. It does not ask for another approval stage.

Owned changes: `hardware/simulator/`, `.github/workflows/hardware-ci.yml`, `docs/progress-log.md`, and these design/plan artifacts. Existing backend, admin, mobile, shared contract, and firmware stay outside this delivery. The CityCycle section of `docs/api-contract.md` remains **proposed**; implementing a local mock does not establish an agreed backend contract. No scale, OTA, hardware claims, invented cost/accuracy/battery-life figures, or production dashboard integration.

## Approach and tradeoffs

Use Python 3.12+ standard library (`sqlite3`, `http.server`, `urllib`, `threading`, `unittest`) and plain HTML/CSS/JavaScript. This avoids package installation and works on Windows/macOS/Linux. The user explicitly permits installing anything needed for quality; this dependency choice is a practical default, not a restriction on external review tooling. A Node/React dashboard would add installation/build work; a CLI-only script would obscure the demonstration. Neither is needed here.

One launcher starts a control-panel HTTP server at `127.0.0.1:8765`, a separate mock receiver at `127.0.0.1:8766`, and one simulator worker. Device transport always posts actual HTTP to the receiver; it never directly inserts receiver rows. The local panel may read the mock receiver store for its explicitly labeled receiver display. In real mode the mock does not start and the panel shows receiver data as unavailable.

Use one bin, default `BIN-SIM-001`. Device and mock receiver each have a separate SQLite database under `hardware/simulator/.data/`, ignored by a simulator-local `.gitignore`. Retain all unacknowledged rows without automatic eviction: modest demo volume is preferable to an eviction policy that loses alerts. An unwritable/full database fails visibly and rolls back the attempted sample; it must never show a successful record or advance the durable sequence. This is a PC simulator, not a claim about MCU flash capacity.

## Data and durable state

The device database stores identity, next sequence, current sensors, simulated network online/offline flag, previous threshold-active flags, last valid server policy, outbox, and bounded recent acknowledgement/error events. The network flag defaults to online for a fresh directory and persists immediately when toggled, so an offline restart remains offline until explicit restoration; auto-fill is off on every startup. Identity is `(binId, mode, configured target base URL)`; refuse to reopen an existing directory with a different identity and explain how to choose another data directory. This prevents accidentally sending a previous mock queue to a real service. The device key is never stored in SQLite.

Appending a sample, advancing sequence, and persisting current sensors/threshold flags are one transaction. Sequence begins at 1, never reuses an acknowledged value after restart, and is a positive integer up to JavaScript's safe integer maximum (`9007199254740991`). Exhaustion fails visibly. Persist server policy when it changes. Use SQLite transactions, foreign access serialized with a lock, and durable commit settings; do not delete or recreate corrupted databases automatically.

Outbox rows retain exact wire payload plus local `full`/`heat` markers; markers are not added to the proposed wire shape. Select at most 50 rows per batch, with marked rows first then sequence order, so a newly hot reading need not wait behind a long offline backlog. A valid partial acknowledgement deletes only the listed rows from that particular request. Applying acknowledgements, policy, and acknowledgement events is atomic. An HTTP timeout after a receiver commit safely retries the same sequence.

The receiver has unique `(binId, seq)` rows persisted separately. Repeating an identical reading returns its sequence as accepted without adding another row; a conflicting payload for an existing sequence rejects the entire batch with 409. The receiver dashboard shows deduplicated count, latest received reading, timestamps, and full/heat status derived from its policy. Old retransmitted readings must not replace a newer latest reading. `at: null` is accepted and displayed as clock unsynced with receiver arrival time. The UI and logs show bounded recent rows rather than returning an ever-growing history.

## Provisional HTTP behavior

Transport sends `POST {baseURL}/iot/bins/{binId}/readings`, `Content-Type: application/json`, `X-Device-Key: <key>`, and:

```json
{"readings":[{"seq":1,"at":"2026-10-22T09:00:00Z","fillPct":72,"distanceCm":31,"tempC":38.5,"batteryV":3.91,"rssi":-85,"fw":"sim-0.1.0"}]}
```

Success is exactly `202` with `{"accepted":[1],"intervalMin":30,"fullPct":80,"heatC":60}`. These defaults are **demo examples, not verified district settings**. Distances derive from a labeled simulated 100 cm empty / 5 cm full calibration (`100 - 0.95 * fillPct`), never claimed as measured accuracy. RSSI is fixed at -85 and labeled simulated. Battery is controlled in volts, not an invented state-of-charge percentage.

The local mock accepts only its configured bin/key, checks the key using constant-time comparison, limits request bodies to 64 KiB and batches to 50, and validates the whole batch before insertion. Missing/wrong key returns 401; unknown bin 404; invalid body/reading 400; sequence conflict 409; oversize body 413. Error bodies are small JSON with `detail`; they never echo a key or raw request. Required reading fields match the proposed contract: `seq`, `at`, and `fillPct`; `distanceCm`, `tempC`, `batteryV`, `rssi`, and `fw` are optional. Reject missing required fields, unknown fields, NaN/Infinity, booleans used as numbers, and duplicate sequences in a batch. Validate optional fields only when present; do not silently fabricate absent measurements. Numeric demo ranges: fill 0–100, distance 0–200 cm, temperature -40–125 °C, battery 0–6 V, RSSI integer -127–0. `fw` is a nonempty string at most 40 characters; `at` is null or a timezone-aware ISO timestamp. Sequence follows the safe integer rule above. Receiver UI displays an omitted optional measurement as unavailable, and absent temperature cannot produce a heat alert. The simulator itself normally emits every example field.

Validate a response fully before mutating local rows: `accepted` must contain unique positive integer sequences drawn only from that request; policy must have finite `intervalMin` in `(0, 1440]`, `fullPct` in `[0,100]`, and `heatC` in `[-40,125]`. Missing fields, foreign sequences, invalid JSON, or wrong status are errors; retain the entire batch and prior policy. Empty/partial accepted lists are valid; retain the remainder and avoid a tight drain loop. Device response parsing also has a 64 KiB cap.

All remote errors, including 4xx, preserve the queue and appear visibly; do not silently discard data on auth or contract errors. No redirects are followed, to avoid forwarding device credentials. HTTP timeout is 3 seconds. Disable environment proxy use for this small explicit-target transport so local traffic and keys are not accidentally routed through a proxy. HTTPS uses normal certificate verification.

## Sampling, thresholds, and retry

Inject a clock with `monotonic() -> float` and `utc_now() -> datetime`; tests advance a fake clock with no sleeps. The worker evaluates `tick()` at most once per second or wakes on a control event. Network HTTP work runs on the worker, never while holding the engine state lock or on the browser request thread. Shutdown stops/joins the worker before closing databases.

Record an initial sample and request delivery on startup, honoring the persisted simulated network flag: an offline restart records locally but makes no outbound request until restoration. Subsequent periodic samples use the last valid `intervalMin` (30 minutes before a policy arrives). A manual **Record reading** immediately persists the chosen sensor values; an ordinary sample waits for the next delivery interval or explicit **Send now**. A threshold transitions from inactive to active when `previous < threshold` and `current >= threshold`; equality counts as full/hot. Staying above does not repeatedly trigger immediate delivery; returning below re-arms the edge. Both full and heat may be active together. Persist flags so restarting while hot does not invent a new crossing. A valid new server policy takes effect for subsequent samples; compare their active flags with the persisted previous flags, so lowering a threshold can cause a crossing on the next sample.

On a crossing, wake delivery immediately if online and no retry delay is active. During an active backoff, the alert remains durable and is sent at the already scheduled retry time; display that time. Mark every sample whose full/heat condition is active, ensuring alerts remain identifiable even after the physical values fall. Receiver alerts are derived from readings, not from device-only flags.

On failure, wait 1, 2, 4, 8, then 16 minutes (cap at 16) using monotonic deadlines; a threshold or sampling event must not reset active backoff. Reset retry failures after a valid positive acknowledgement. A valid empty acknowledgement uses at least the first retry delay. A positive partial acknowledgement continues the remaining queue on the next worker tick, not recursive HTTP calls. Periodic sampling continues during retries. Startup and network restoration attempt to drain pending data immediately; restoration resets the retry deadline as an explicit user action. **Send now** also explicitly bypasses a pending delay, but never bypasses the network toggle.

**Network off** blocks all outbound telemetry while continuing samples/queue persistence. The browser remains usable because only the simulated device link changes. Optional auto-fill increments fill by 5 percentage points every 5 seconds, capped at 100, and records a sample at each changed value. It stops increasing at 100; no random values or endless samples at the cap. It is off on startup, and the UI labels it accelerated demo behavior. Periodic sampling is not accelerated by auto-fill. No battery-drain physics are claimed.

## Browser and local safety

The polished, responsive panel is titled **CityCycle smart-bin simulator** with a permanent **SIMULATED DATA · local mock / real endpoint** mode label and a clear statement that the existing Command Center/mobile apps are not connected. Show one visual bin with a changing fill level, large fill/temperature/battery sliders with exact numeric inputs, a clear network switch, start/pause auto simulation, record/send actions, threshold settings last received, queue count, acknowledged count, retry deadline, recent sequence log, and latest mock telemetry/alert cards with history. Use a clear visual hierarchy and intentional spacing; a bare JSON endpoint or unstyled form does not satisfy the UI requirement. Local current condition and receiver-confirmed condition are separate displays, so an offline full bin cannot look delivered.

Mock mode additionally offers server policy controls for `intervalMin`, `fullPct`, and `heatC`; editing them changes the mock's next response, not the device policy directly. Explain that the device applies policy after its next valid response. In real mode these controls and receiver display are unavailable. Never accept a target URL, key, arbitrary file path, or shell instruction through browser endpoints.

Use local static assets, native fonts, labeled keyboard-accessible inputs/buttons, text with alert colors, and CityFix token values for red `#C8102E`, paper `#F8F6F2`, ink `#161616`, gold `#D4A20B` (dark text), and surfaces `#FFFFFF`. Poll state once per second without overlapping requests; use `textContent` for data/errors. Indicate errors/status without stealing focus, and avoid announcements on every poll.

Both servers bind IPv4 loopback only. Validate Host against the actual `127.0.0.1:<port>` / `localhost:<port>` allowlist. Panel POSTs require JSON, an exact same-origin Origin, and a per-launch random control token obtained by same-origin state read; no permissive CORS. `GET /api/state` intentionally returns `controlToken` to its same-origin browser client; engine snapshots and all logs/errors never contain it. Do not put the control token in a URL. Receiver requires the device key instead of browser controls. Restrict static routes to the three known files; serve neither database nor arbitrary filesystem paths. Bound request reads with size limits/socket timeouts; malformed requests produce JSON errors without killing the worker. Device keys and credential-bearing URLs never appear in any state response, application errors, request logs, or committed files. Neither secret is persisted or committed.

## Launch and eventual handoff

From repository root: `python hardware/simulator/run.py`; Windows: `py -3 hardware/simulator/run.py`. Print/open `http://127.0.0.1:8765`; `--no-browser` supports CI. Support `--port`, `--mock-port`, and `--data-dir` with validation and useful occupied-port errors; default paths are anchored to the script, not current directory. Ctrl+C cleanly closes both servers and durable stores.

Environment configuration: `CITYFIX_SIM_MODE=mock|real` (default mock), `CITYFIX_BIN_ID` (default `BIN-SIM-001`, safe `[A-Za-z0-9_-]{1,64}`), `CITYFIX_API_BASE_URL`, `CITYFIX_DEVICE_KEY`. Real mode requires explicit base URL and key. Reject URL credentials, query, fragment, unsupported schemes, and non-loopback plaintext HTTP; allow HTTPS or HTTP to literal `127.0.0.1` / `localhost` / `[::1]`. Reject header control characters in the key. Mock mode generates an ephemeral random key shared only by its device transport and receiver; it is not a production provisioning system. Restarting mock mode reuses data but generates a fresh shared key.

Document PowerShell environment assignments and shell equivalents using placeholder keys; explain that real CityCycle endpoints need Member 4's contract approval and provisioning. No real backend URL/key is assumed or tested in this delivery. Explain database location, restart persistence, selecting a new data directory, restoring network, port changes, and honest demonstration limits.

## Acceptance and verification

1. A clean Python 3.12+ checkout launches without installing dependencies; panel and mock run on separate loopback ports, and transport reaches the mock over HTTP.
2. Record offline values including threshold crossings, restart using the same data directory, restore network: every retained sequence is acknowledged exactly once in receiver storage, with later samples using larger sequences.
3. Simulate a lost response after receiver commit and repeat the batch: no duplicate receiver row. Partial ACK, malformed ACK, unknown ACK sequence, and empty ACK never delete unacknowledged readings.
4. Fake-clock tests prove 79→80 and 59→60 edges, no repeat while above, below/re-cross, persisted flags, changed server settings, bounded backoff, periodic samples during outage, and immediate restoration/crossing behavior.
5. Mock auth/validation/conflict failures mutate neither receiver nor outbox. Snapshot/log checks find no key; cross-origin/foreign Host/static traversal attempts fail. Real mode rejects insecure external HTTP and missing credentials.
6. A real Chromium smoke checks controls, offline queue then delivery, full/heat receiver alerts, mock policy response application, responsive keyboard-accessible layout, no browser console errors, and the permanent simulation label. This is local simulator end to end, not Command Center/mobile end to end.
7. Standard-library tests pass through hardware CI on Linux and Windows with Python 3.12; preserve the existing conditional PlatformIO job for future firmware. Documentation links remain valid; progress log states scope, tests, and real-backend/physical work still open.
