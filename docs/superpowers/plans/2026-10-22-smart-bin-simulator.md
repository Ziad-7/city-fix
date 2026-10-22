# CityCycle PC Smart-Bin Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. The user chose one GPT-6 Luna implementation worker and GPT-6.1 Sol review; do not spawn additional workers or insert approval gates.

**Goal:** Deliver a one-command PC smart-bin demonstration with a browser panel, durable queue, actual HTTP mock delivery, and explicit simulation labeling.

**Architecture:** Python standard-library launcher runs a loopback control panel, separate loopback mock receiver, and one simulator worker. SQLite stores device sequence/outbox/settings and receiver idempotency independently. Transport can later target a provisioned real endpoint without changing sampling/queue logic.

**Tech Stack:** Python 3.12+, SQLite, http.server, urllib, unittest, plain HTML/CSS/JavaScript; no third-party runtime or test dependencies.

**Spec:** [Smart-bin simulator design](../specs/2026-10-22-smart-bin-simulator-design.md). Read it before implementing; it defines precise protocol, ranges, timings, and failure behavior.

## Global Constraints

- Work only in `hardware/simulator/`, `.github/workflows/hardware-ci.yml`, `docs/progress-log.md`, and these design/plan artifacts.
- Python 3.12+ standard-library runtime; one bin, no pip installs needed for operators; Windows/macOS/Linux compatible paths and shutdown. The user authorizes useful tool installation, including external browser verification tooling.
- CityCycle endpoints remain proposed; no existing backend/admin/mobile edits or claims of integration.
- Defaults are demo examples: interval 30 minutes, full 80%, heat 60 °C, batch 50, request/response 64 KiB, HTTP timeout 3 seconds.
- Retry minutes: 1, 2, 4, 8, 16 cap; no unacknowledged row eviction; no device keys in persistence/state/logs. Only the same-origin web `/api/state` intentionally exposes `controlToken`; engine snapshots/logs never do.
- Both listeners bind IPv4 loopback only; real mode requires explicit URL/key and HTTPS except loopback.
- No committing/pushing/deploying unless the primary agent explicitly requests it; the primary already created an isolated worktree.

## Review Focus

- A timeout after receiver commit must retry identical payloads without duplicate rows; pin this with an HTTP integration test at checkpoint C.
- A response accepting another request's sequence must not remove any local rows; pin malformed/foreign/partial/empty ACK tests at checkpoint B.
- Offline samples that become full then return empty must retain the full sample over a restart; pin this at checkpoints A/B.
- Lowering server thresholds must apply on a later sample without silently changing the current device policy from a browser edit; pin this at checkpoints B/D.
- A browser at another origin or a second process with a mismatched data-directory identity must not control/misroute the demo; pin panel request tests at D and identity tests at A.

---

## File map

Create the following focused files; use modest dataclasses/types rather than a framework:

| File under `hardware/simulator/` | Responsibility |
| --- | --- |
| `run.py` | Entry point, argv/env validation, resource startup/shutdown, browser opening |
| `config.py` | Frozen `Config`, URL/bin/key validation, defaults; never serialize key |
| `model.py` | `Clock`, `SystemClock`, `Policy`, `Sensors`, reading/ACK validation, JSON aliases |
| `store.py` | Transactional SQLite `DeviceStore` and `ReceiverStore`, immutable snapshots |
| `engine.py` | Sampling, threshold flags, auto-fill, retry deadlines, serialized tick/delivery |
| `transport.py` | Bounded real HTTP POST, no redirect/proxy, response validation |
| `mock_server.py` | Separate authenticated provisional receiver, policy controls, validation/idempotency |
| `web_server.py` | Known static routes and protected panel API; no transport on request thread |
| `static/index.html`, `static/style.css`, `static/app.js` | Responsive local panel and polling controls |
| `tests/__init__.py`, `tests/helpers.py` | Temporary stores, `FakeClock`, fixture readings, socket server context helpers |
| `tests/test_store.py`, `tests/test_engine.py`, `tests/test_http.py`, `tests/test_config.py` | Critical behavior below, all standard-library unittest |
| `README.md`, `.gitignore` | Commands/demo/handoff/limits; ignore `.data/`, `__pycache__/`, `*.pyc` |

Modify the existing hardware workflow to test this simulator independently of firmware existence. Add one newest-first progress entry after verification. Do not modify CONTRIBUTING or shared contract merely to mention the new simulator.

## Task 1: Deliver the complete local simulator

This is one coherent delivery task with five checkpoints. Work sequentially within this worker; write the focused tests first at each checkpoint, see them fail, implement, then run them. No separate worker calls or checkpoint commits are necessary.

### Checkpoint A: Configuration and durable stores

**Files:** `config.py`, `model.py`, `store.py`, `tests/helpers.py`, `tests/test_store.py`, `tests/test_config.py`, local `.gitignore`.

**Interfaces produced:**

- `Clock.monotonic() -> float`, `Clock.utc_now() -> datetime`; `SystemClock` implements them. Fake clock exposes `advance(seconds: float) -> None` for tests.
- Frozen `Policy(interval_min: float = 30, full_pct: float = 80, heat_c: float = 60)` and `Sensors(fill_pct: float = 20, temp_c: float = 25, battery_v: float = 3.9)`.
- `Config.from_env_and_args(argv: list[str], env: Mapping[str, str]) -> Config`; fields: `mode`, `bin_id`, `base_url`, secret `device_key`, `port`, `mock_port`, `data_dir: Path`, `open_browser`. Keys excluded from repr. Use the exact environment names/options in the spec.
- `DeviceStore(path: Path, identity: tuple[str, str, str])`; `load_state() -> dict`, `append(reading_without_seq: dict, sensors: Sensors, flags: tuple[bool, bool]) -> int`, `set_network(online: bool) -> None`, `pending(limit: int = 50) -> list[dict]`, `apply_ack(sent_seqs: list[int], accepted: list[int], policy: Policy) -> None`, `snapshot() -> dict`, `close() -> None`. `pending()` returns wire dictionaries only, priority ordered by stored alert markers. `load_state()` includes sensors, flags, policy, and online flag (default true for a fresh directory), enabling offline restart without delivery or a fake new crossing. Store validates ACKs defensively too.
- `ReceiverStore(path: Path)`; `accept(bin_id: str, readings: list[dict], arrived_at: datetime) -> list[int]` inserts all-or-none with duplicate/conflict semantics; `snapshot(bin_id: str, policy: Policy) -> dict`; `close() -> None`.
- Reading construction/validation helpers live in `model.py`; required wire fields are `seq`, `at`, `fillPct`; optional fields are `distanceCm`, `tempC`, `batteryV`, `rssi`, `fw`. Reject unknown/missing-required fields, validate present optional fields, and preserve omissions. Receiver displays absent optional fields as unavailable and cannot infer heat without temperature. Simulator-generated samples normally include all fields. Derive alert markers from `flags`, without adding wire fields.

- [x] Write store tests: `test_sequence_and_payload_survive_restart`, `test_acknowledged_sequence_is_not_reused`, `test_offline_alert_survives_later_normal_sample_and_restart`, `test_network_flag_defaults_online_and_persists_offline`, `test_append_failure_rolls_back_sequence_and_flags`, `test_identity_mismatch_refused`, `test_partial_ack_and_unknown_sequence_are_atomic`, `test_receiver_idempotency_survives_restart`, `test_receiver_conflict_rolls_back_whole_batch`, `test_latest_does_not_regress_on_old_retry`, and `test_priority_batch_contains_alert_after_50_normal_rows`. Assert exact remaining sequences/payloads, receiver row counts and persisted flags; use temporary directories.
- [x] Write config tests for missing real credentials, external plaintext HTTP, embedded URL credentials/query/fragment, invalid bin IDs/header control characters/ports, valid HTTPS prefix, valid loopback HTTP, script-relative default data path, and key-free repr. No network access is needed.
- [x] Run `python -m unittest discover -s hardware/simulator/tests -p 'test_store.py' -v` and corresponding `test_config.py`; confirm new behavior fails before implementation.
- [x] Implement configuration/model/stores. Sequence allocation, reading insertion, sensor/flag changes share one transaction. Enable SQLite durable commits; serialize access. Return copies from snapshots, bound recent events, never clear a database after an exception.
- [x] Re-run both test modules; every assertion passes with no external dependencies.

### Checkpoint B: Testable engine and transport semantics

**Files:** `engine.py`, `transport.py`, `model.py`, `tests/test_engine.py`, helpers.

**Consumes:** A's clock, sensors, policy, store and reading helpers.

**Interfaces produced:**

- `HttpTransport(base_url: str, bin_id: str, device_key: str)`; `send(readings: list[dict]) -> tuple[list[int], Policy]`. Throw a small sanitized transport exception on failure, including status/error category but no credential or raw body. Fully validate success and ACK subset before returning.
- `Simulator(store: DeviceStore, transport: object, clock: Clock)`; `start() -> None` records initial sample/initial send intent once per process, honoring persisted offline state; `record(sensors: Sensors) -> int`, `set_network(online: bool) -> None`, `set_auto_fill(enabled: bool) -> None`, `request_send() -> None`, `tick() -> None`, `snapshot() -> dict`. `set_network` immediately persists the new flag through DeviceStore before exposing success. Auto-fill always starts off. `tick` runs on exactly one worker; controls may be invoked from web handlers and wake its event. Transport stub only needs `send(readings)`.
- Engine snapshot exposes local sensors, flags, policy, online/auto flags, queue/ACK summaries, sanitized recent events, and seconds to retry. No actual key, token, credential-bearing URL, or SQLite path leaks.

- [x] Add `test_edges_at_equality_rearm_and_no_repeat` with fill 79→80→81→79→80 and temperature 59→60; fake transport call counts prove only rising edges request immediate send. Include both flags active together.
- [x] Add `test_retry_deadlines_are_60_120_240_480_960_seconds`, `test_crossing_during_backoff_retained_until_due`, `test_periodic_samples_continue_offline`, `test_offline_restart_sends_nothing_until_restore`, `test_network_restore_and_manual_send_wake_delivery`, and `test_offline_send_now_does_not_send`. Advance fake monotonic time, no sleeping. Confirm failure counters reset only after positive valid ACK, restored network state persists, and auto-fill is off after restart.
- [x] Add `test_partial_ack_retains_remainder`, `test_foreign_duplicate_boolean_or_malformed_ack_keeps_all_rows_and_old_policy`, `test_empty_ack_waits_without_spin`, and `test_restart_preserves_alert_flags_and_policy`. Prove send takes a stable batch so concurrent new rows cannot be incorrectly deleted.
- [x] Add `test_changed_server_policy_changes_next_sample_threshold_and_interval`: receive 1-minute/50%/45 °C settings; next 55%/46 °C sample crosses both previously inactive flags, new periodic deadline uses 60 seconds. A mock-policy edit by itself is tested later and cannot mutate device state.
- [x] Add auto-fill tests proving +5 every 5 seconds, cap 100, no repeated rows at cap, and explicit clock-unsynced `at: null` remains valid through storage/transport.
- [x] Run `python -m unittest discover -s hardware/simulator/tests -p 'test_engine.py' -v`; confirm failures, then implement the minimal scheduler and HTTP adapter. Never perform IO while holding engine state locks. Batching drains at most once per tick, with remaining batches eligible next tick; backoff cannot turn into a tight loop.
- [x] Re-run store/config/engine tests together. Assert deterministic calls/deadlines, not implementation-private SQL or thread timing.

### Checkpoint C: Separate persistent HTTP mock

**Files:** `mock_server.py`, `transport.py`, `tests/test_http.py`, helpers.

**Consumes:** A's ReceiverStore/validation and B's real HttpTransport.

**Interfaces produced:** `MockReceiver(store: ReceiverStore, bin_id: str, device_key: str, clock: Clock)` with `set_policy(policy: Policy) -> None`, `snapshot() -> dict`, and `make_mock_server(receiver: MockReceiver, port: int) -> HTTPServer`. Port 0 is supported by test factories; launcher defaults remain fixed. `server_address` supplies actual test ports. Mock state/config access is thread safe.

- [x] Add actual-socket tests for `test_transport_posts_contract_and_auth`, `test_missing_or_wrong_key_401`, `test_wrong_bin_404`, validation ranges/nonfinite/bool/duplicates/missing-required-or-unknown-fields, `test_required_fields_only_accepted_without_invented_optional_measurements_or_heat`, invalid JSON/body size, and `test_conflicting_duplicate_409_without_partial_insert`. Verify exact 202 shape and null timestamps/arrival stamps.
- [x] Add `test_lost_response_after_commit_retry_is_deduplicated`: test handler commits then closes connection on the first request; first transport call fails and leaves device rows, retry returns ACKs, receiver count is unchanged. Test server policy response is honored through actual HttpTransport.
- [x] Add malformed/oversized ACK and redirect HTTP test handlers. Redirect must fail without contacting its target or forwarding the key. Assert normalized errors contain neither test key nor raw body.
- [x] Run `python -m unittest discover -s hardware/simulator/tests -p 'test_http.py' -v`; confirm failures, implement mock handlers, and re-run to PASS. Always close/join test servers in `finally` or context managers and set finite socket deadlines.

For this managed environment, actual socket tests require `exec_command` with `sandbox_permissions="with_additional_permissions"` and `additional_permissions={"network":{"enabled":true}}`. This grants local sockets; do not skip or mock out integration tests to work around the sandbox. CI/local Windows can run the same command normally.

### Checkpoint D: Local panel and one-command lifecycle

**Files:** `run.py`, `web_server.py`, `static/index.html`, `static/style.css`, `static/app.js`, HTTP/config tests.

**Consumes:** Config, store/engine, MockReceiver and mock server factory.

**Interfaces produced:** `make_web_server(simulator: Simulator, receiver: MockReceiver | None, port: int, control_token: str) -> HTTPServer`. Exact local routes: `GET /`, `/style.css`, `/app.js`, `/api/state`; `POST /api/sample` body `{fillPct,tempC,batteryV}`, `/api/network` `{online}`, `/api/auto` `{enabled}`, `/api/send` `{}`, `/api/mock-config` `{intervalMin,fullPct,heatC}`. POST responses are small state/action confirmations; errors use `{detail}`. State includes a per-launch `controlToken`; requests send `X-Control-Token`, never a URL token. This token is not included in engine snapshots/events. Only same-origin GET can read it under browser policy.

- [x] Extend HTTP tests: foreign Host, foreign/missing Origin for browser mutation, absent/wrong control token, non-JSON or oversized body, invalid field ranges, unknown routes and static traversal are rejected with no mutation. No permissive CORS. Test `test_mock_policy_edit_waits_for_device_response`, and real mode rejects mock-config with a clear unavailable response.
- [x] Extend startup/config tests: occupied ports close any already started server; invalid env exits usefully without echoing secrets; test launcher from a different working directory via subprocess with `--no-browser` and temporary data directory. Do not bind a public interface even through env/argv.
- [x] Run focused tests, observe failures, then implement the routes/launcher. Start mock only in mock mode. Generate runtime secrets with `secrets`, do not print them. Start worker after resources succeed; Ctrl+C/failure stops worker then servers/stores. Print URL, mode, bin, and local data location for the operator.
- [x] Build the polished panel described in the spec with a visual bin fill, large sliders plus numeric controls, network switch, start/pause auto simulation, condition cards/history, distinct queued versus receiver-confirmed state, ACK log, retry status, current settings, and mock server settings. Use native font/token colors, intentional spacing and no external assets or libraries. An unstyled form or JSON page is insufficient. Poll non-overlapping once per second; encode values via textContent and use status text with colors.
- [x] Run the full unittest suite. Then start `python hardware/simulator/run.py --no-browser --data-dir <temporary-directory>` using approved local socket access and verify GET state/static assets, Record, offline queue, restore/drain, and threshold alerts. Primary performs the Chromium visual/console/keyboard smoke after implementation; supply it the command/URL and any operator steps.

### Checkpoint E: Windows handoff, CI, and reviewable delivery

**Files:** `hardware/simulator/README.md`, `.github/workflows/hardware-ci.yml`, `docs/progress-log.md`, test corrections only when justified by failures.

- [x] Write README with the root one-command Python and Windows `py -3` startup, minimum Python version, no dependencies, panel URL, controls, restart/offline demo script, configuration/env examples (PowerShell and POSIX), local state/reset-by-new-directory, port conflict help, and real endpoint migration limits. Link existing hardware brief and proposed contract. Clearly list pending physical hardware and real admin/mobile integration.
- [x] Add a simulator job matrix for `ubuntu-latest` and `windows-latest`, Python `3.12`, with `python -m unittest discover -s hardware/simulator/tests -v` and no pip dependency installation. Preserve future firmware detection/conditional PlatformIO build in a separate job. Existing hardware path triggers and read-only permissions remain valid.
- [x] Run `python -m unittest discover -s hardware/simulator/tests -v`, `python -m compileall -q hardware/simulator`, `node scripts/check-doc-links.mjs`, `git diff --check`, and `actionlint .github/workflows/hardware-ci.yml` if installed. Do not claim Windows CI passed before it runs; record local platform truthfully.
- [x] Add one progress entry linking simulator README and design/plan, with what changed, exact test commands/results, and outstanding real backend/Command Center/mobile/physical verification. Do not claim firmware or end-to-end app integration exists.
- [x] Self-review the changed-file list, ensure no `.data`/SQLite/key/generated cache files are tracked, and hand off a concise summary plus test evidence and browser start command to the primary Sol reviewer. Update completed checkboxes in this plan; do not commit/push.

## Handoff acceptance script

From repo root, launch with a fresh temporary data directory. Open the printed URL. Record fill 79/temp 59, send now, and verify acknowledged receiver data. Switch device network off, record 80/60 then 20/25, and verify pending readings and local/receiver distinction. Stop/restart the same directory, restore network, and verify all queued sequences drain without receiver duplicates. Change mock policy to interval 1/full 50/heat 45; send to obtain it, then record 55/46 and see immediate delivery/receiver alerts. Check browser console and narrow viewport. In real mode with placeholder local test endpoint, confirm no mock receiver is shown; an unconfigured real endpoint must fail before startup with an actionable message.

The implementation and review are already authorized. This plan is the execution handoff, not an additional user approval request.


## Follow-on integration delivered in PR #43

After this local simulator plan was completed, the project added backend telemetry ingestion, staff-scoped Command Center views, and a separate static browser demo. The follow-on is recorded in the progress log and implemented in `backend/`, `apps/admin-web/`, and `apps/web/`; those changes do not alter this plan's original PC simulator checkpoints.
