# Judges' Q&A

Short, honest answers. Evidence for each is in [../evidence.md](../evidence.md).

## What is simulated

**Is the smart bin real?** No. It is simulated: the PC simulator, the Wokwi ESP32 prototypes and the browser page `/smart-bin` in `apps/web` (browser only, it never writes to the API). Seed bins are marked `is_simulated`. No physical bench build exists yet.

**Where do the demo numbers come from?** From seed data. Prices are DEMO values in `backend/app/seed_citycycle.py`, the seed weighings are manual, and 13.5 kg, 51.5 EGP and 0.0135 tonnes are asserted in `backend/tests/test_citycycle.py`. They are not market prices or field results.

**Does the hub scale send data?** The backend route `POST /iot/hubs/{id}/weighings` exists. The Wokwi hub-scale prototype keeps weighings in a local queue and does not send them over HTTP yet.

## What tests verify

**How do you stop duplicate or forged readings?** Readings need a per-device key, and `(binId, seq)` is unique: an identical retry is acknowledged, a conflicting one returns `409`. See `backend/tests/test_bins.py` and `backend/tests/test_citycycle.py::test_admin_bin_patch_rotates_key_and_revokes`.

**Two collectors tap the same job?** The first accept wins and the second gets `409`; weighings are idempotent by client id. `backend/tests/test_citycycle.py::test_first_accept_wins_and_weighing_rules`, `::test_full_flow`.

**Can staff see where a household lives?** Department staff get a redacted view (district only); collectors see an approximate pin. `::test_admin_pickup_patch_is_admin_only_and_staff_views_are_redacted`, `::test_job_distance_cannot_locate_the_exact_home`.

**Does the route optimizer work?** It splits pickups across vehicles under a capacity and returns ordered stops, as a preview with no dispatch saved: `backend/tests/test_route_optimizer.py`. Bins are not stops yet.

**What does the forecast need?** At least 3 clock-synced readings over at least an hour and a recent latest reading; otherwise it says `insufficient_data` or `stale`: `backend/tests/test_bin_forecast.py`.

## To verify, and how

**Sensor accuracy in heat and dust?** Not measured. Bench-test a real unit with a ruler and a logger, then field-test; plan in [../team/hardware-iot.md](../team/hardware-iot.md).

**Does GSM work on Egyptian networks, and how long does the battery last?** Not measured. Test signal at the real bin location and log battery voltage over time; no figure is claimed.

**What does a bin cost?** See `hardware/bom/bom.csv`: we quote a price only when it has a dated supplier source; every other line is to verify. No total is claimed without those quotes.

**Are 80% full and 60 °C right?** They are illustrative defaults in `backend/app/models.py`; agree them with the district.

**CO2 avoided?** Withheld until each material has an emission factor with a cited source.

**Is the AI accurate?** We claim no accuracy. The 33-case synthetic smoke set scores top-1 90.9% and top-3 100% for the keyword baseline and is not a benchmark. Gemini quality on consented Egyptian data is to verify with the live harness in `backend/ai_eval/`.

**Is it deployed? Does OR-Tools run in production?** No verified live URL is recorded. PR #63 adds OR-Tools to production builds; confirm by calling the optimize endpoint after deploying and expecting not `503`.

## Hard questions

**Does money move?** No. The platform records weighings, the amount paid to the household and payouts. No payment provider is integrated.

**Why would a Zabbal use it?** A verified weight, a record of earnings, nearby jobs on a map, and a simple low-literacy interface. Whether that is enough is what a pilot would test.

**Theft and vandalism?** Design measures are in [../team/hardware-iot.md](../team/hardware-iot.md) section 5; the Field Deployment Brief (`docs/field-brief/field-deployment-brief.md`, separate PR) covers them in more detail. Not field-tested.

**What if there is no connection?** The device keeps readings in an outbox and retries (simulator and prototype firmware); the mobile app keeps collector actions and reports in an offline queue and sends them later.
