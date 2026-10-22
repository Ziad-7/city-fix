# CityCycle — Member 2 · Citizen website

Folder `apps/web` · branch `feat/web-…` · existing brief: [`../team/citizen-web-portal.md`](../team/citizen-web-portal.md). **Every existing page stays.** Mirror the mobile features; do not invent different behaviour.

## Features

| # | Feature | Priority |
| --- | --- | --- |
| 1 | **Recyclables pickup** page: same materials, estimated kg, photo, slot, free or paid, estimated EGP from the price list. Same words as the app. | Must |
| 2 | **Impact page** for the signed-in citizen: kg recycled, by material, CO₂ (only when the factors are verified). | Must |
| 3 | **Bin map**: bins layer on the existing map page, with fill-level colours and a "bin full" report. | Must |
| 4 | **Picture sorting guide** page, printable, works without sign-in. | Should |
| 5 | AI waste photo suggestion on the pickup form (confirm or change). | Should |
| 6 | Collector mode on the web is **not** built; collectors use the app. A signed-in collector sees a link to the app. | Decision |

## Shared code rules

- Copy new shared domain files from `apps/mobile/src` unchanged (materials, pickup types, schemas, value calculation, impact helpers), with the same CI diff check; add the paths to `apps/web/scripts/check-shared.sh` and to `web-ci.yml` triggers.
- Mock mode first (localStorage), then API mode, using the same service interfaces as the app.
- Same design pack, Tailwind theme and icons; no new colours.

## Acceptance checks

- A pickup requested on the phone appears on the website for the same account, and the other way round.
- The bin map shows the same bins and states as the app.
- Keyboard and RTL checks pass; no existing Playwright spec breaks.

## Needs from whom

| From | What |
| --- | --- |
| 1 | Shared domain code, mock seed, design screens for the new pages |
| 4 | Endpoints in the contract, CORS (already), demo account |
| 5 | `/ai/waste-classify` |
