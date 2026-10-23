# Submission verification record

Prepared 2026-10-23 against source based on `5271aa2` (`main`, including the team's presentation). This records the checks executed during preparation of this submission package. It is not certification of a physical unit or hosted deployment.

## Software proof of concept

The focused backend suite completed with **68 passed** using a test database:

```sh
cd backend
JWT_SECRET=submission-test-secret-at-least-32-bytes OTP_MODE=demo python -m pytest tests/test_citycycle.py tests/test_bins.py tests/test_route_optimizer.py tests/test_bin_forecast.py -q
```

The environment needs the backend development dependencies; use `uv run --extra dev python` in place of `python` when reproducing through `uv`. The run emitted one dependency deprecation warning. Tests include collector workflow rules, authenticated bin telemetry/history, routing and forecast behaviour; they do not contact the hosted database or prove browser/phone acceptance.

## Hardware simulation and design checks

| Executed check | Result |
| --- | --- |
| `python -m unittest discover -s hardware/simulator/tests -q` | 66 passed |
| `python -m unittest discover -s hardware/wokwi/tests -q` | 5 passed |
| `python -m unittest discover -s hardware/tests -q` | 23 passed |
| Smart-bin C++ core, built with `g++ -std=c++17 -Wall -Wextra -Werror` and executed | Passed |
| Hub-scale C++ core, built with the same flags and executed | Passed |
| `python hardware/schematics/build_schematic.py --check` | Passed; generated schematic matches source |

See the [Wokwi README](../../hardware/wokwi/README.md) for native compilation commands and the [prototype runbook](PROTOTYPE-RUNBOOK.md) for an interactive demonstration. These checks cover logic, simulated receipt, persistence and design consistency. They do not establish physical sensor accuracy, power autonomy, GSM connectivity, an interactive Wokwi session or scale-to-backend delivery.

## Submission artifacts

- Existing `CityFix-Pitch-Deck.pptx` and `CityFix-Pitch-Deck.pdf` were found in the team's submitted folder and preserved.
- The final report exporter produced an **11-page technical documentation PDF**, an exactly **two-page A4 field brief**, and a **one-page A3 circuit diagram**. Both field pages, the architecture and the circuit were visually inspected. The exporter checks page counts and required report text on every run.
- The presentation ZIP/PPTX integrity check passed: 26 slides and a 26-page presentation PDF. All 42 package Markdown links resolved. The general docs checker passed 768 relative links.
- After updating the BOM with sourced prices, the 23 hardware-package checks were rerun and passed. The BOM now has 26 priced rows, one custom mount awaiting a quote, and a separately excluded LTE alternative. The sourced component subtotal is 7,243.00 EGP; this is not a complete installed-system cost.
- Budget totals are generated from the accompanying cost data. Sourced prices and unresolved costs must remain distinguishable; prices are not technical validation of component suitability.
- Relative-document links are checked with `node scripts/check-doc-links.mjs`. This validates local link targets, not external web access.

## Hosted and Android acceptance still to verify

The team provided the backend, Command Center and citizen website links listed in [the package index](README.md). Workspace policy blocked requests to those domains, so this run did not verify hosted login, media upload, Gemini, production database state or the complete live collector flow. No live migration or production database write was performed.

The preview EAS environment for the backend-connected APK was configured with `EXPO_PUBLIC_API_MODE=api`, `EXPO_PUBLIC_API_URL=https://city-fix-api-backend.vercel.app` and the existing Maps key. Build submission confirmed those variables were loaded. The operator reported Maps working in the earlier APK; the new APK still needs the phone acceptance checks in the runbook. Gemini requires valid server-side configuration and a successful consented media request; a fallback or working Maps screen does not prove it.

## Video — excluded by request

The team reports that the video has been created and explicitly requested that video work be skipped. No video was created, modified or certified by this task; it is managed separately by the team.
