# CityCycle — Member 1 · Mobile app

Folder `apps/mobile` · branch `feat/mobile-…` · existing spec: [`../mobile/implementation-spec.md`](../mobile/implementation-spec.md). **Every existing feature stays.** Mock data first behind the proposed contract ([CityCycle section](../api-contract.md#citycycle--proposed)), then API mode.

## Features

| # | Feature | Priority |
| --- | --- | --- |
| 1 | **Recyclables pickup.** New CityServe-style flow: choose materials (PET plastic, cardboard/paper, metal/cans, glass, e-waste, cooking oil, organics), estimated kg per material, optional photo, day and time slot, location with landmark. Show the **estimated value in EGP** from the district price list (hidden with "السعر هيتحدد" / "price to be set" when the district has no price). Choose **give for free** or **get paid**. Request appears in طلباتي with a timeline. | Must |
| 2 | **Collector mode.** Role switch for a verified collector (or a separate collector sign-in). Nearby pickup jobs on a map and a list; accept (first wins); navigate (open the maps app); confirm weight per material (manual entry, or from the hub scale over BLE); pay the household in cash and log it, or log the purchase; finish. | Must |
| 3 | **Earnings screen** for collectors: today, week, by material, kg and EGP. | Must |
| 4 | **Offline-first collector actions:** accept, weigh and complete are saved locally with a `clientId` and synced when the network returns (reuse the existing outbox). | Must |
| 5 | **Impact screen** for citizens (kg recycled, by material, CO₂ avoided) and collectors (kg collected, EGP earned). CO₂ factors are **to verify**; hide the CO₂ line until they are sourced. | Must (kg, EGP) · Should (CO₂) |
| 6 | **Smart-bin map layer** on the map: bins with fill level colour, "bin full" report button (creates a garbage incident linked to the bin). | Must |
| 7 | **AI waste photo check:** after the photo, the app suggests material and size; the person confirms or changes. Works without it (fallback). | Should |
| 8 | **Picture-based sorting guide:** one picture per material, a short Arabic label and a voice reading option; designed for low literacy. | Should |
| 9 | **Voice notes reused** for the pickup note (existing recorder and transcription). | Should |
| 10 | BLE connection to the hub scale (service defined with member 6). | Should |
| 11 | Field Deployment Brief: low-bandwidth, offline and low-literacy UI sections (with member 6); video and deck (with everyone). | Must |

## Design rules

Same identity and components as today; new screens added to the design pack ([`docs/design/screens/mobile/`](../design/screens/)) before code. Gender-neutral Egyptian Arabic plus English, Arabic-Indic digits in citizen copy, no religious content. Icons for materials follow the existing icon set rules (add paths to `Icon.tsx`). Big touch targets and icon-first layout in collector mode.

## Acceptance checks

- Pickup with two materials is created, shows an estimated value when prices exist, and appears in طلباتي.
- A collector account sees only open jobs near them, accepts one, and a second collector gets "اتاخد خلاص" / "already taken".
- Airplane mode: weigh and complete a job; on reconnect it syncs once, with no duplicates.
- No citizen phone or name is visible in collector mode; the exact pin shows only after accept.
- The impact numbers equal the sum of the confirmed weighings.
- Existing flows (report, services, map, reopen) still pass their tests.

## Needs from whom

| From | What |
| --- | --- |
| 4 | Pickups, collectors, material prices, earnings, bins endpoints; a demo collector account and seed prices marked as demo |
| 5 | `/ai/waste-classify` |
| 6 | BLE service definition, bin IDs and positions, sample payloads |
| 3 | Collector verification flow (so the demo collector is verified) |
