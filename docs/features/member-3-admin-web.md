# CityCycle — Member 3 · Admin web (Command Center)

Folder `apps/admin-web` · branch `feat/admin-…` · existing brief: [`../team/admin-web.md`](../team/admin-web.md). **The eight existing pages stay.** CityCycle adds pages and sidebar entries in the same look.

## Features

| # | Page / feature | API | Priority |
| --- | --- | --- | --- |
| 1 | **CityCycle dashboard** route `/recycling`: tonnes diverted (total, by material, by district), pickups, average response time, collector earnings total, bins by state. Western digits in data. | `GET /admin/recycling/summary` | Must |
| 2 | **Collectors registry and verification:** list with status, district, materials; verify or suspend with a note. No phone or national ID shown unless the role needs it. | `GET/PATCH /admin/collectors` | Must |
| 3 | **District material price table:** EGP per kg per material, edit by admin, last updated. Left empty until the district enters real prices. | `GET/PUT /admin/material-prices` | Must |
| 4 | **Bin telemetry map:** bins coloured by state, fill %, temperature, battery, last seen; alerts list for full, hot, low battery, offline; bin detail with a readings chart. | `GET /admin/bins`, `GET /admin/bins/{id}/readings` | Must |
| 5 | **Register a bin:** name, position, kind; shows the device key once. | `POST /admin/bins` | Should |
| 6 | **Collection route plan:** ordered stops per vehicle on the map, from the optimizer; staff can accept it as a plan. | `POST /admin/recycling/routes/optimize` | Should |
| 7 | **Dumping hotspots:** clusters on the map with counts and "cleared" status. | `GET /admin/hotspots` | Stretch |
| 8 | **Collector payouts report:** per collector, kg, value at the price list, cash paid to households; export CSV. | `GET /admin/payouts` | Should |
| 9 | Pickups queue (read-only view of CityCycle pickups next to CityServe). | `GET /recycling/pickups` (admin view) | Should |

## Design rules

Same ink sidebar, gold active item, red actions; design the new pages in [`docs/design/screens/admin/`](../design/screens/) first. Same status chip colours (map bin states to existing chip styles; add no new colours). Never show citizen names or phones.

## Acceptance checks

- Verifying a collector here lets that collector see jobs in the app.
- Changing a price changes the estimated value on a new pickup in the app.
- A simulated reading with `fillPct` over the threshold turns the bin red and adds an alert within one refresh.
- Roles: `staff` sees their district; only `admin` edits prices.
- Existing pages and tests still pass.

## Needs from whom

| From | What |
| --- | --- |
| 4 | All `/admin/…` CityCycle endpoints, demo data |
| 5 | Route optimizer, forecast, hotspot data |
| 6 | Payload samples, alert rules and thresholds |
| 1 | Shared domain code, design |
