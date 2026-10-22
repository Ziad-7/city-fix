# CityCycle — Member 4 · Backend API & database

Folder `backend/` · branch `feat/api-…` · existing brief: [`../team/api-database.md`](../team/api-database.md). **No existing table, endpoint or enum changes.** All CityCycle routes are in the contract's [CityCycle section](../api-contract.md#citycycle--proposed); you own that section and the diagram.

## Data model (new migrations, after the existing ones)

| Table | Key columns |
| --- | --- |
| `materials` | `id` (`MaterialId`), `label_ar`, `label_en`, `co2_factor_kg_per_kg` (nullable, **to verify**) |
| `material_prices` | `district`, `material_id`, `price_egp_per_kg` (nullable), `updated_by`, `updated_at` · pk (`district`, `material_id`) |
| `collectors` | `profile_id → profiles`, `status`, `district`, `materials[]`, `vehicle`, `verified_by`, `verified_at` |
| `recycling_pickups` | `id` (`RCY-…` from a sequence), `citizen_id`, `items jsonb`, `photo_paths text[]`, `location geography`, `address`, `landmark`, `day`, `slot`, `mode`, `status`, `collector_id?`, `created_at` |
| `weighings` | `id`, `pickup_id?`, `hub_id?`, `material_id`, `kg numeric`, `source`, `scale_id?`, `price_egp_per_kg`, `value_egp`, `client_id unique`, `at` |
| `payments` | `id`, `pickup_id`, `collector_id`, `paid_to_household_egp`, `at` (recorded, not processed) |
| `bins` | `id` (`BIN-…`), `name`, `kind`, `location geography`, `district`, `empty_cm`, `full_cm`, `device_key_hash`, `state`, `last_seen_at` |
| `bin_readings` | `bin_id`, `seq`, `at`, `fill_pct`, `distance_cm`, `temp_c`, `battery_v`, `rssi`, `fw` · pk (`bin_id`, `seq`) · index (`bin_id`, `at`) |
| `hotspots` | `id`, `location geography`, `count`, `first_seen`, `last_seen`, `status` |
| `impact_daily` | `date`, `district`, `material_id`, `kg`, `pickups`, `earned_egp` (aggregate, rebuilt from `weighings`) |

Roles: add `collector` to `profiles.role` handling (a collector is also a citizen). Use PostGIS `ST_DWithin` for nearby jobs, as for duplicates.

**Pickup: new entity or a new `ServiceType`?** Recommendation: **a separate entity** (`recycling_pickups`). A pickup has a second actor and its own lifecycle (requested, accepted, weighed, completed), plus materials, weights and money; adding it to `service_requests.details` would stretch a shape three clients already use. `ServiceType` stays unchanged. Status changes still go through the one function that writes `activity_log` (entity type `recycling_pickup`), so timelines work the same. Decision recorded in [0004](../decisions/0004-citycycle-waste-pillar.md).

## Endpoints

All routes in the contract's CityCycle section: pickups, collectors, jobs (accept is atomic, `409` if taken), weighings (idempotent on `client_id`), earnings, material prices, bins, impact, admin summary, payouts. Weighings compute `value_egp` from the price at that moment.

## Device auth for bins and scales

- `X-Device-Key` header on `/iot/…` only; the key is random, shown once at registration, stored hashed, revocable per device.
- A device key cannot call any user endpoint; user tokens cannot post readings.
- De-duplicate on `(bin_id, seq)`; return the thresholds and interval; mark a bin `offline` when no reading arrives for a multiple of the interval (**multiple to decide**); rate-limit per device.
- Raise `full` / `hot` / `low_battery` states from the readings; keep it simple and deterministic.

## Stretch: SMS / USSD gateway

`POST /gateway/sms` webhook from a provider: a short coded message creates a pickup for a feature phone and replies in Egyptian Arabic. Provider and codes are open; skip if time is short.

## Privacy

Collectors never receive citizen phone or name; the exact pin is returned only after accept. Earnings only to the collector and admins. Anonymise exports. Bin telemetry has no personal data. Keep device keys and collector documents out of logs.

## Architecture diagram (hackathon deliverable)

You own the one-page system diagram: apps, API, Supabase/PostGIS, AI, IoT devices and the data flow. Member 6 supplies the device part.

## Acceptance checks

- Seed: demo material list, demo prices clearly labelled as demo, one verified collector, three bins with readings.
- A pickup created by a citizen is accepted by exactly one collector under a race test.
- Posting the same `seq` twice stores one reading.
- A weighing with a repeated `clientId` returns the first result.
- `ruff` and `pytest` green; existing tests unchanged.

## Needs from whom

| From | What |
| --- | --- |
| 6 | Payload, thresholds, device registration flow, sample data |
| 5 | Query functions they need (`queries.py` additions), `ai_suggestions` kinds for waste photos |
| 1, 2, 3 | Contract review on the CityCycle PR |
