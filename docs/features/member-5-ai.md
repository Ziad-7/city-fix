# Member 5 — AI, optimization, and analytics

Member 5 preserves the existing consent-gated AI routes and adds deterministic operations previews. The analytics work is implemented in this branch on top of Member 4. Forecasts, route optimization, and hotspots are human-reviewed suggestions; they do not write operational data or call Gemini.

| Endpoint | Access | Behavior |
| --- | --- | --- |
| `POST /ai/waste-classify` | Authenticated citizen with consent and enabled photo analysis | Existing model suggestion with private-media ownership and image redaction; deterministic fallback remains available. |
| `POST /ai/transcribe` | Authenticated owner of the voice-note asset | Existing bounded, validated Egyptian Arabic transcription. |
| `GET /admin/bins/forecast?horizonHours=24` | Staff, department scoped | Least-squares fill trend over synchronized, recent telemetry; collection resets split the trend and an unaligned latest sequence refuses extrapolation. |
| `POST /admin/recycling/routes/optimize` | Admin | OR-Tools CVRP preview for requested, unassigned pickups; haversine distance estimates, capacity constraints, and an explicit unassigned list. |
| `GET /admin/hotspots?days=30&radiusMeters=500&minCount=3` | Staff, department scoped | Haversine DBSCAN semantics over garbage incidents only; output omits source IDs and sensitive incident details. |

OR-Tools is an optional runtime extra (`routing`) and part of backend development requirements so CI exercises solver behavior. Deployments without the package receive `503`; there is no heuristic fallback. Install local development dependencies with `pip install -r requirements-dev.txt` from `backend/`. Production deployments that need route previews install `pip install ".[routing]"`. These APIs require no schema migration or project SQL because they read existing bins, readings, incidents, and recycling pickups.

The hotspot query is bounded to the requested time window and category, then DBSCAN compares candidate pairs in O(n²) time. It does not silently truncate. Measure scoped candidate size and the query plan before high-volume use; add a suitable composite index if that measured workload needs one.

Deferred from the broader Member 5 roadmap: time-window routing, bin-route optimization, and CO₂ impact-factor verification. No new impact estimate is claimed. Gemini baseline/candidate evaluation remains blocked until existing credentials and permitted, consented fixtures are available; no prompt change or quality claim is made. Local eval commands, normalization rules, and manifest examples are documented in [`../../backend/ai_eval/README.md`](../../backend/ai_eval/README.md).
