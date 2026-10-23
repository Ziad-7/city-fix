# Technical deck outline

Twelve slides. Each has one message and the evidence to show. Status words follow [../evidence.md](../evidence.md).

| # | Slide | One-line message | Evidence in repo |
| --- | --- | --- | --- |
| 1 | Problem | Waste has value in Egypt, but the people who recover it have no verified weight and no record of pay | [vision.md](../vision.md) (theme facts, labelled as theme facts) |
| 2 | Users and benefit | Households, collectors and districts each get something measurable | [vision.md](../vision.md#who-benefits) |
| 3 | The loop | Request, accept, weigh, confirm, impact, and a bin that calls for collection | Root `README.md` ("The CityCycle story") |
| 4 | Architecture | One backend, three clients, devices with a per-device key, AI that only suggests | [architecture.md](../architecture.md), `docs/diagrams/system-architecture.svg` |
| 5 | Collector payment flow | First accept wins, weighings are idempotent, the household confirms; amounts are recorded, no money moves | [architecture.md](../architecture.md) (collector payment flow), `backend/tests/test_citycycle.py` |
| 6 | Smart bin telemetry | Device key, sequence numbers, de-duplication, full and heat flags; simulated, not a field unit | [team/hardware-iot.md](../team/hardware-iot.md) section 4, [Wokwi README](../../hardware/wokwi/README.md), [simulator README](../../hardware/simulator/README.md), `backend/tests/test_bins.py` |
| 7 | Optimization and forecasting | OR-Tools capacity-constrained routing preview and a linear fill forecast; bins are not yet route stops | `backend/app/logic/route_optimizer.py`, `backend/tests/test_route_optimizer.py`, `backend/app/logic/bin_forecast.py`, `backend/tests/test_bin_forecast.py` |
| 8 | AI with guardrails | Suggestions only, deterministic fallback, photo analysis off by default; the 33-case smoke set is not an accuracy benchmark | [ai-status.md](../ai-status.md), `backend/ai_eval/README.md` |
| 9 | Engineering quality | One CI workflow per folder; backend suite 430 passed, 9 skipped on 2026-10-23 (re-run before presenting) | [CONTRIBUTING.md](../../CONTRIBUTING.md) (CI), [evidence.md](../evidence.md) (reproduce) |
| 10 | BOM in EGP and field conditions | Local parts, heat, dust, weak GSM and theft; prices only from dated quotes | `hardware/bom/bom.csv`, `docs/field-deployment-brief.md` (both added in a parallel PR), [team/hardware-iot.md](../team/hardware-iot.md) section 5 |
| 11 | Impact metrics | What the platform will measure; today only demo seed values (13.5 kg, 51.5 EGP, 0.0135 tonnes); CO2 withheld until factors have a source | [vision.md](../vision.md) (impact table), `backend/tests/test_citycycle.py::test_admin_summary_pickups_payouts` |
| 12 | Next steps and to verify | Pilot a real bin, collect quotes, agree thresholds with a district, deploy | [evidence.md](../evidence.md) (claims and runbook) |
