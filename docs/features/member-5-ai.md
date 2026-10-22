# CityCycle — Member 5 · AI & smart features

Folders `backend/app/ai/`, `backend/app/optimizer/`, `backend/app/routers/` (AI routers), `backend/ai-eval/` · branch `feat/ai-…` · existing brief: [`../team/ai-features.md`](../team/ai-features.md). Same guardrails: **suggestions only**, always answer, neutral Egyptian Arabic, privacy, cost limits.

## Features

| # | Feature | Endpoint | Priority |
| --- | --- | --- | --- |
| 1 | **Waste photo classification** (type and size): material top 3 with confidence, size small/medium/large, optional kg range, for pickups and dumping reports. Fallback when the model fails: ask the person to choose. | `POST /ai/waste-classify` | Should |
| 2 | **Bin fill forecasting:** predict when each bin will be full from its readings (start with a simple per-bin rate model; keep it explainable). | `GET /admin/bins/forecast` | Should |
| 3 | **Collection route optimisation:** OR-Tools VRP over bins and accepted pickups, with vehicle count and time windows; returns ordered stops. | `POST /admin/recycling/routes/optimize` | Should |
| 4 | **Dumping hotspot detection:** cluster repeated garbage reports and photos by area and time (DBSCAN or a PostGIS grid). | `GET /admin/hotspots` | Stretch |
| 5 | **Impact estimates:** kg and CO₂ from weighings (deterministic maths, not a model); the CO₂ factors are **to verify** and cited before use. | inside `/me/impact`, admin summary | Should |

## Rules

- **Not AI:** priority score, prices, payments and weighings stay deterministic and human-confirmed.
- The photo model only suggests material and size; a collector's weighing is the truth for kg.
- Forecasts and routes show their inputs; staff can override. A route is a plan, not an order.
- Evaluate: a labelled set of waste photos (**to collect**: Egyptian household waste, mixed light, bags) with accuracy and top-3 accuracy; for forecasting, an error measure on simulated and real readings. Report the numbers; do not claim any before you measure them.
- Data in: bins and readings from member 4's queries; simulated readings from member 6 until real ones exist.

## Acceptance checks

- `/ai/waste-classify` answers within about 5 s, falls back with `source: "fallback"`, and is covered by tests with a fake model.
- The route optimizer never exceeds vehicle capacity or time limit, uses only valid ids, and is deterministic for a fixed input.
- Forecast returns a time or "not enough data", never an error.
- Eval README lists the numbers for the demo.

## Needs from whom

| From | What |
| --- | --- |
| 4 | New `queries.py` functions (bins, readings, open pickups), env vars, storage access for photos |
| 6 | Reading history (simulated or real), bin positions |
| 3, 1, 2 | Where each result is shown |
