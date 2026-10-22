# API contract — apps ⇄ backend

One backend serves three clients with the same endpoints and shapes: the citizen mobile app (`apps/mobile`), the citizen website (`apps/web`) and the admin web app (`apps/admin-web`). There are no client-specific routes.

This is what the citizen mobile app sends and expects. The app already runs on mock data behind these exact shapes; switching to the real backend is a config change (`EXPO_PUBLIC_API_MODE=api`, `EXPO_PUBLIC_API_URL=https://…`). The admin web app will use the same API plus the `/admin/*` routes.

**Source of truth for types:** `apps/mobile/src/domain/types.ts`. The client is `apps/mobile/src/services/api/`.
**Owners:** member 4 (API & DB) owns this file; member 5 owns the AI routes. See [`team/README.md`](team/README.md).
**Changing the contract:** open a PR that edits this file and tag every client owner it affects (members 1, 2, 3). Items marked *proposed* must be agreed before anyone relies on them. Don't change shapes silently.

## Conventions

- JSON, **camelCase** keys (in FastAPI use Pydantic models with `alias_generator=to_camel`, `populate_by_name=True`, and return `by_alias=True`).
- Timestamps: ISO 8601 UTC strings (`2026-10-21T10:12:00Z`). Dates: `YYYY-MM-DD`.
- Auth: `Authorization: Bearer <token>` on everything except `/auth/*` and `/health`.
- The app sends `Accept-Language: ar`; error messages should be short Egyptian Arabic.
- Errors: HTTP status + `{ "detail": "رسالة قصيرة" }`. 400 validation, 401 no/expired token, 403 not your resource / not admin, 404 not found, 409 conflict (e.g. already following), 422 FastAPI validation.
- IDs are human-readable strings: reports `FTC-1042`, incidents `INC-0042`, service requests `SRV-2001`, work orders `WO-318`.
- Lists are newest first.
- CORS: allow the citizen web and admin web origins (`http://localhost:3000`, `http://localhost:3001`, the Vercel domains) with the `Authorization` header. Mobile needs no CORS.

## Enums

| Name | Values |
| --- | --- |
| `IncidentStatus` | `received` · `triaged` · `assigned` · `in_progress` · `resolved` · `closed` (service requests use the same set) |
| `Severity` | `low` · `medium` · `high` · `critical` |
| `CategoryId` | `pothole` · `open_manhole` · `sewage_overflow` · `water_pipe_burst` · `garbage` · `streetlight_out` · `exposed_wire` · `road_obstruction` · `stray_dogs` · `fallen_tree` · `broken_sidewalk` · `other` |
| `ServiceType` | `bulky_waste` · `tree_maintenance` |
| `PaymentMethod` | `cash` · `fawry` · `instapay` · `wallet` |
| `SlotId` | `morning` · `afternoon` |
| `OtpChannel` | `sms` · `whatsapp` |

Category metadata (Arabic label, danger flag, default severity, department, response target in working days, rough repair cost in EGP) is in `apps/mobile/src/domain/categories.ts` — seed the `categories` table from it.

## Shapes

```ts
Place          = { lat: number, lng: number, address: string, landmark?: string }
TimelineEntry  = { status: IncidentStatus, note: string, actor: string, at: string }
PriorityFactor = { key: string, label: string, points: number, max: number }
Priority       = { score: number /* 0-100 */, factors: PriorityFactor[] }

Incident = {
  id, categoryId, title, severity, priority: Priority, status, department,
  estimatedCostEgp: number, linkedReportIds: string[], followers: number,
  location: Place, sensitivePlace?: string, areaUnderserved: boolean,
  workOrderId?: string, eta?: string /* e.g. "خلال ٣ أيام" */,
  timeline: TimelineEntry[], createdAt, updatedAt,
  isFollowing?: boolean   // per caller: true if they reported or follow it
}

Report = {
  id, reporterId, incidentId, categoryId, description, photoUris: string[],
  location: Place, anonymous: boolean, blurFaces: boolean, createdAt, voiceNoteUri?: string
}

NewReportInput = {
  categoryId, description, photoUris: string[], location: Place,
  anonymous: boolean, blurFaces: boolean, voiceNoteUri?: string,
  linkToIncidentId?: string,   // "نفس المشكلة، تابعها" — attach to an existing incident
  severity?: Severity,          // the citizen's confirmed AI suggestion
  governorate?: string, district?: string
}

ServiceRequest = {
  id, citizenId, serviceType,
  details: {
    items: string[], day: string /* YYYY-MM-DD */, slot: SlotId, note?: string,
    payment?: PaymentMethod,  // *proposed:* optional; absent for free district services (tree_maintenance)
    workType?: string,        // *proposed:* tree_maintenance only, e.g. "تقليم" (also sent as items[0])
    photoUris?: string[]      // *proposed:* tree_maintenance only, upload paths (kind "report_photo")
  },
  location: Place, status: IncidentStatus, timeline: TimelineEntry[], createdAt
}
NewServiceRequestInput = { serviceType, details, location }

MapPin = { id, categoryId, title, status, severity, lat, lng }

DuplicateMatch    = { incidentId, title, categoryId, distanceM: number, followers: number, status }
AlreadyReported   = { incidentId, reportId /* the caller's own report */, title, categoryId, distanceM: number }
TriageSuggestion  = {
  options: { categoryId, confidence: number }[],  // top 3, confidence desc, sum <= 1
  severity: Severity, summary: string /* one Arabic line */,
  duplicates: DuplicateMatch[],          // joinable only: never an incident the caller reported or follows
  alreadyReported?: AlreadyReported[]    // nearby incidents the caller reported themselves
}
```

## Endpoints

### Health
| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | `{ "status": "ok", "version": "…" }` |

### Auth (phone + one-time code)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/otp` | `{ phone: "01012345678", channel: OtpChannel }` | `204` |
| POST | `/auth/verify` | `{ phone, code: "123456" }` | `{ userId, phone, name?, token }` |

- Phone format: Egyptian mobile, `01[0125]` + 8 digits. Store it as `+201…`.
- **Demo mode** (`OTP_MODE=demo`): no SMS is sent and the code is always `123456`. Real SMS/WhatsApp delivery is a stretch goal.
- A first successful verify creates the citizen profile.

### Reports and incidents (citizen)
| Method | Path | Body | Response | Notes |
| --- | --- | --- | --- | --- |
| POST | `/reports` | `NewReportInput` | `{ report: Report, incident: Incident }` | Creates a report. If `linkToIncidentId` is set, links to that incident (and makes the reporter a follower); otherwise creates a new incident. Computes priority. Writes the first timeline entry (`received`). |
| GET | `/reports` | — | `Report[]` | The caller's own reports. |
| GET | `/reports/{id}` | — | `Report` | 404 if missing, 403 if not the caller's (admins can read all). |
| GET | `/incidents` | — | `Incident[]` | Citizens: all incidents, public fields only (no reporter identities). |
| GET | `/incidents/{id}` | — | `Incident` | |
| POST | `/incidents/{id}/follow` | — | `Incident` | "أنا كمان". Idempotent per user; increments `followers` once. |
| POST | `/incidents/{id}/reopen` | `{ note }` | `Incident` | *Proposed.* "لسه المشكلة موجودة": only a reporter or follower, only on `resolved`; status back to `received`, timeline entry with the note. |
| GET | `/map/incidents` | — | `MapPin[]` | Optional query: `status`, `categoryId`, `bbox=minLng,minLat,maxLng,maxLat`. |

### Service requests (CityServe)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/service-requests` | `NewServiceRequestInput` | `ServiceRequest` |
| GET | `/service-requests` | — | `ServiceRequest[]` (the caller's) |
| GET | `/service-requests/{id}` | — | `ServiceRequest` |

- *Proposed:* `tree_maintenance` bookings are free: `details.payment` is omitted, `details.workType` says what is needed and `details.photoUris` may carry one uploaded photo. `bulky_waste` still requires `payment`.
- The app treats `404` and `403` on any `GET …/{id}` as "not found" (it shows "مش لاقيين الطلب ده"), other errors as a load failure with a retry.

### Garbage collection schedule — proposed
| Method | Path | Response |
| --- | --- | --- |
| GET | `/services/garbage-schedule?district=…` | `{ district, days: ("sun"\|"mon"\|"tue"\|"wed"\|"thu"\|"fri"\|"sat")[], window: "٨ م – ١١ م", note? }` (the app uses static demo data until this exists, and falls back to it on any error) |

### Triage (CityBrain)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/triage` | `{ description: string, categoryId?, photoUri?, location?: { lat, lng } }` | `TriageSuggestion` |

- Until the AI agent is ready, return a deterministic keyword classifier (port `apps/mobile/src/logic/triage-mock.ts`). Duplicates come from the database (see below).
- Must answer within ~5 s; on model failure return the keyword result rather than an error (manual fallback).

### Photo and voice-note uploads (proposed — needs agreement)
The mobile app implements this flow in API mode (mock mode keeps local URIs).
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/uploads/sign` | `{ kind: "report_photo" \| "voice_note", contentType }` | `{ uploadUrl, path }` |

`contentType` is `image/jpeg` for photos (the app resizes them to a 1600 px long side, JPEG quality 0.7) and the recorder's audio type for voice notes (`audio/mp4` for `.m4a`; also `audio/mpeg`, `audio/wav`, `audio/webm`, `audio/3gpp`, `audio/x-caf`). The `PUT` must use the same `Content-Type` as signed. The mobile app and the website both `PUT` the file to `uploadUrl` (the URL must accept a browser `PUT` with CORS) (a Supabase Storage signed upload URL), then send `path` in `photoUris`, in `voiceNoteUri`, or (*proposed*) in a tree booking's `details.photoUris`. Values in those fields that are not local URIs are treated as already uploaded, so an offline-queued report that was half prepared is not uploaded twice. A failed `PUT` is retried later by the app's offline queue; a `4xx` from `/uploads/sign` or `/reports` drops the queued report with the server's `detail`. Reads use short-lived signed URLs returned by the API. Faces and plates are blurred before a photo is shown to anyone but the reporter and admins (stretch: run the blur on upload).

### Staff auth (Command Center) — proposed
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/staff-login` | `{ email, password }` | `{ userId, name, role: "staff" \| "admin", departmentId?, district, token }` |

Staff tokens carry the role; `staff` only updates incidents of their department, `admin` sees everything and runs the budget.

### Admin (Command Center — web)
From the plan (§7). Admin role required.
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/dashboard` | Counts: open, overdue, resolved this week, average resolution time |
| PATCH | `/incidents/{id}` | `{ status?, severity?, categoryId?, department?, note? }` — writes a timeline entry with the note shown to citizens |
| POST | `/admin/work-orders` | `{ incidentId? , serviceRequestId?, department, assignee }` |
| PATCH | `/admin/work-orders/{id}` | `{ status?, assignee?, note? }` |
| POST | `/admin/budget/optimize` | `{ budgetEgp, incidentIds? }` → `{ selected: [...], skipped: [...], totalCost, remaining, coveredPriority }` (owner: member 5, AI & smart features) |
| GET | `/admin/work-orders` | Query `status`, `departmentId` — *proposed* |
| GET | `/admin/service-requests` | Query `status`, `serviceType`, `day` — *proposed* |
| PATCH | `/admin/service-requests/{id}` | `{ status?, scheduledDay?, slot?, assignee?, note? }` — writes a timeline entry — *proposed* |
| POST | `/admin/incidents/{id}/merge` | `{ intoIncidentId }` — staff-confirmed merge of duplicates; moves reports and followers — *proposed* |
| GET | `/admin/incidents/{id}/similar` | Ranked similar open incidents (AI help on top of the 250 m rule) — *proposed, member 5* |
| GET | `/admin/insights` | `{ summary, hotspots[], risingCategories[], overdueDepartments[] }` weekly Arabic summary — *proposed, member 5* |

`GET /incidents` and `GET /incidents/{id}` with a staff token also return `linkedReports` (anonymised: `reporter: "مواطن" | "بلاغ بدون اسم"`) and the stored triage suggestion — *proposed*.

### AI (CityBrain) — proposed, owner member 5
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/ai/transcribe` | `{ path }` (an uploaded voice note) | `{ text, language: "ar-EG", confidence }` |

The app calls `/ai/transcribe` right after uploading a recording and appends `text` to the description (still editable); it ignores `language`. Any error just leaves the description for the citizen to type. The voice note itself is sent with the report as `voiceNoteUri` even when transcription failed.

Proposed additions to `TriageSuggestion`: `source: "model" | "fallback"` and `emergency?: boolean` (true when the text mentions gas, fire, injury or collapse; clients then show the emergency numbers first).

## Business rules the backend owns

- **Duplicates:** an open incident (`status` not `resolved`/`closed`) of the **same category** within **250 m** of the new location. Use PostGIS `ST_DWithin(location, point, 250)` on `geography`. Return nearest first with `distanceM`. Exclude incidents the caller already follows; incidents the caller reported go to `alreadyReported` (with their `reportId`) instead of `duplicates`.
- **Report validation:** a category plus at least one photo **or** a description of 10+ characters.
- **Priority:** deterministic, same formula as `apps/mobile/src/logic/priority.ts` (severity 5/15/28/40; sensitive place +20; reporters `min(20, (n-1)×3)`; age `min(15, round(daysOpen/targetDays×10))`; underserved area +5; cap 100). Recompute when reporters/followers change and daily for age. Return every factor so the UI can explain the score.
- **Timeline:** every status change writes an `activity_log` row; `Incident.timeline` / `ServiceRequest.timeline` are built from it, oldest first.
- **Privacy:** citizens never see other citizens' phone numbers or names; anonymous reports hide the reporter from admins too (keep the id for abuse handling only).

## CityCycle — proposed

Waste and recycling pillar ([vision](vision.md), [decision 0004](decisions/0004-citycycle-waste-pillar.md)). **Everything in this section is *proposed*:** agree it by contract PR before building on it. It only **adds** to the contract above; nothing above changes (`ServiceType` stays `bulky_waste | tree_maintenance`). Owner: member 4 (API & DB); AI routes member 5; device (IoT) routes member 6. Feature plan: [`features/`](features/README.md).

### New enums

| Name | Values |
| --- | --- |
| `MaterialId` | `pet_plastic` · `paper_cardboard` · `metal_cans` · `glass` · `e_waste` · `cooking_oil` · `organics` |
| `PickupStatus` | `requested` · `accepted` · `weighed` · `completed` · `cancelled` |
| `PickupMode` | `free` (give for free) · `paid` (get paid) |
| `CollectorStatus` | `pending` · `verified` · `suspended` |
| `BinState` | `ok` · `full` · `hot` · `low_battery` · `offline` |
| `WeighingSource` | `manual` · `scale_ble` · `scale_api` |
| role | adds `collector` to the existing roles (`citizen` · `staff` · `admin`) |

### New shapes

```ts
MaterialPrice = { materialId, district: string, priceEgpPerKg: number | null /* null until set */, updatedAt }

RecyclingPickup = {
  id /* "RCY-3001" */, citizenId,
  items: { materialId, estimatedKg: number }[],
  photoUris: string[],
  location: Place, day: string /* YYYY-MM-DD */, slot: SlotId,
  mode: PickupMode,
  estimatedValueEgp?: number,      // from the district price list; absent if no price is set
  status: PickupStatus, collectorId?: string, collectorName?: string,
  weighings: Weighing[], totalKg?: number, totalValueEgp?: number,
  paidToHouseholdEgp?: number,     // cash the collector says they paid (mode "paid"), set by /complete
  collectorFinishedAt?: string,    // set by /complete
  confirmedAt?: string,            // set by the household's /confirm
  note?: string,
  timeline: TimelineEntry[], createdAt
}
NewRecyclingPickupInput = { items, photoUris?, location, day, slot, mode, note? }

Weighing = {
  id, pickupId, materialId, kg: number, source: WeighingSource, scaleId?: string,
  priceEgpPerKg: number | null,    // price at the time of weighing
  valueEgp: number | null, clientId: string /* idempotency key from the app */, at
}

Collector = {
  id, name, district, status: CollectorStatus, materials: MaterialId[],
  vehicle?: string, joinedAt
}   // phone and national ID are never sent to other users

CollectorJob = {   // a pickup as seen by a verified collector (no citizen phone or exact name)
  id, items, location: Place /* address, landmark and an APPROXIMATE lat/lng (the server rounds to about 100 m); the exact pin arrives only with accept */,
  day, slot, mode, estimatedKg: number, estimatedValueEgp?: number, distanceM?: number
}

Earnings = {
  period: { from: string, to: string },
  totalKg: number, valueEgp: number, paidToHouseholdsEgp: number,
  byMaterial: { materialId, kg, valueEgp }[], jobs: number
}

Bin = {
  id /* "BIN-014" */, name?: string, location: Place, kind: "street" | "hub",
  fillPct?: number, tempC?: number, batteryV?: number,
  state: BinState, lastSeenAt?: string
}
BinReading = { seq: number, at: string | null, fillPct: number, distanceCm?: number, tempC?: number, batteryV?: number, rssi?: number, fw?: string }

Impact = {
  totalKg: number, byMaterial: { materialId, kg }[], pickups: number,
  earnedEgp?: number,               // collectors only
  co2AvoidedKg?: number             // emission factors to verify before this is shown
}

WasteClassification = {
  materials: { materialId, confidence: number }[],   // top 3
  size: "small" | "medium" | "large", estimatedKgRange?: [number, number],
  source: "model" | "fallback"                         // a suggestion; the person confirms
}
```

### Citizen: recyclables pickup and impact

| Method | Path | Body | Response | Notes |
| --- | --- | --- | --- | --- |
| GET | `/recycling/materials` | query `district` | `MaterialPrice[]` | One row per material; `priceEgpPerKg` is `null` where the district has not set a price. |
| POST | `/recycling/pickups` | `NewRecyclingPickupInput` | `RecyclingPickup` | Creates a pickup (`requested`). Computes `estimatedValueEgp` from the price list. |
| GET | `/recycling/pickups` | — | `RecyclingPickup[]` | The caller's own pickups. |
| GET | `/recycling/pickups/{id}` | — | `RecyclingPickup` | 404 if missing, 403 if not the caller's. |
| POST | `/recycling/pickups/{id}/cancel` | `{ note? }` | `RecyclingPickup` | Only while `requested`. |
| POST | `/recycling/pickups/{id}/confirm` | — | `RecyclingPickup` | The household confirms the weighing in the app (the pickup then becomes `completed`). |
| GET | `/me/impact` | query `as` = `citizen` \| `collector` (default `citizen`) | `Impact` | The caller's own impact in that role. One account can be both, so the app names the role: the citizen screen sends `as=citizen`. |

Photos and voice notes use the existing `/uploads/sign` flow (`kind: "report_photo"`).

### Collectors

| Method | Path | Body | Response | Notes |
| --- | --- | --- | --- | --- |
| POST | `/collectors/apply` | `{ name, district, materials, vehicle? }` | `Collector` (`pending`) | A signed-in user applies; staff verify in the Command Center. Role `collector` is granted on verification. |
| GET | `/collectors/me` | — | `Collector` | |
| GET | `/collector/pickups` | — | `RecyclingPickup[]` | **Added by the app.** The pickups this collector accepted (any status), newest first, with the exact pin. Drives "شغلي" / "My jobs". |
| GET | `/collector/jobs` | query `lat`, `lng`, `radiusM`, `materialId?` | `CollectorJob[]` | Verified collectors only (`403` otherwise); open (`requested`) pickups near the point, nearest first. Never includes the caller's own household pickups. |
| POST | `/collector/jobs/{id}/accept` | — | `RecyclingPickup` | First accept wins; `409` if already taken or cancelled. Reveals the exact pin to the collector. |
| POST | `/collector/jobs/{id}/weighings` | `{ materialId, kg, source, scaleId?, clientId }` | `Weighing` | Idempotent on `clientId` (offline-first sync): a repeat returns the same `Weighing` with `200`. Only the collector who accepted the pickup, and only while it is `accepted` or `weighed` (`403`/`409` otherwise). Sets the pickup to `weighed`. `kg` is 0.5 to 500. |
| POST | `/collector/jobs/{id}/complete` | `{ paidToHouseholdEgp?: number }` | `RecyclingPickup` | Records what was paid in cash (for `mode: "paid"`) and `collectorFinishedAt`. Needs at least one weighing (`409` otherwise). The household then confirms; the pickup stays `weighed` until `/recycling/pickups/{id}/confirm`. |
| GET | `/collector/earnings` | query `from`, `to` | `Earnings` | |

### Smart bins and hubs

| Method | Path | Body | Response | Notes |
| --- | --- | --- | --- | --- |
| GET | `/bins` | query `bbox?` (the app sends none yet; return the caller's district) | `Bin[]` | Public fields for the map layer: location, state, fill level. |
| POST | `/bins/{id}/report-full` | `{ note?, photoUri? }` | `204` | A citizen reports a full bin; creates a FixFirst `garbage` incident linked to the bin. |
| POST | `/iot/bins/{id}/readings` | `{ readings: BinReading[] }` | `202 { accepted: number[], intervalMin, fullPct, heatC }` | **Device auth:** `X-Device-Key` header, no user token. Idempotent on `(binId, seq)`. Owner member 6 (payload) + member 4 (endpoint). |
| POST | `/iot/hubs/{id}/weighings` | `{ seq, at, material, kg, pickupId? }` | `202` | Hub scale; same device auth and rules. |

Device keys are per device, stored hashed, revocable; they never grant access to any user endpoint. Detail: [`team/hardware-iot.md`](team/hardware-iot.md).

### Admin (Command Center) — CityCycle

Admin or staff role required; collectors never see these.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/recycling/summary` | Query `from`, `to`, `district`: tonnes diverted (total, by material, by district), pickups, average response time |
| GET | `/admin/collectors` | Query `status`, `district`; `PATCH /admin/collectors/{id}` `{ status, note? }` verifies or suspends |
| GET | `/admin/material-prices` | Query `district` |
| PUT | `/admin/material-prices` | `{ district, prices: { materialId, priceEgpPerKg }[] }`; admin only; prices are set by the district, not by this repo |
| GET | `/admin/bins` | With latest readings; `POST /admin/bins` registers a bin and returns its device key **once**; `PATCH /admin/bins/{id}` edits or revokes the key |
| GET | `/admin/bins/{id}/readings` | Query `from`, `to` |
| GET | `/admin/bins/forecast` | Fill forecast per bin — owner member 5 |
| POST | `/admin/recycling/routes/optimize` | `{ date, collectors?, binIds? }` → ordered stops per vehicle — owner member 5 |
| GET | `/admin/hotspots` | Dumping hotspots with counts and status — owner member 5 (detection), member 4 (storage) |
| GET | `/admin/payouts` | Query `from`, `to`, `collectorId?`: kg, value at the price list and cash paid to households per collector |

### AI (CityBrain) — CityCycle, owner member 5

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/ai/waste-classify` | `{ path }` (an uploaded photo) | `WasteClassification` |

Suggestion only: the citizen or collector confirms the materials and the size. On timeout or error return a fallback result with `source: "fallback"`, never an error to the person.

### SMS / USSD reporting gateway — proposed, stretch

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/gateway/sms` | Provider webhook: a short coded message (for example a district code + material + "pickup") creates a pickup for a feature phone. Provider and codes to decide; replies in Egyptian Arabic. |

### Rules for CityCycle

- **Prices:** `priceEgpPerKg` comes only from the district price table; never hard-coded in an app. If it is `null`, apps show "السعر هيتحدد" / "price to be set" and no value.
- **Weighings are the source of truth** for kg and EGP. A manual weight and a scale weight use the same endpoint; the `source` is recorded.
- **Offline:** collector writes carry a client-generated `clientId`; the server de-duplicates.
- **Privacy:** a collector sees the materials, the address and landmark (street level, no building number) and an approximate pin of an open job, never the citizen's phone or name; the exact pin appears only after accept. A citizen sees the collector's first name, district and verified badge (collectors are always verified). Earnings are visible to the collector and to admins only. Bin telemetry holds no personal data.
- **Money** is recorded, not processed: the platform logs cash paid and the value at the price list. No payment-provider integration in the MVP.
- Timeline entries for pickups use the same `TimelineEntry` shape and `activity_log` table (entity type `recycling_pickup`).

### What the mobile app does with this (2026-10-22)

The app implements every endpoint above against the mock, and calls the real routes with `EXPO_PUBLIC_API_MODE=api`. Behaviour the backend must match:

- **Collector offline queue.** Accept, weigh and complete are saved on the phone when the network or server fails (`ApiError` 5xx or no connection) and sent later **in order**. A `4xx` answer (for example `409` "already taken") drops that action and all later queued actions for the same pickup, and tells the collector. So accept, weighings and complete must return plain `4xx` for business-rule refusals, and `5xx`/timeouts only for real trouble.
- **`clientId`** is made by the app (`c-<time>-<seq>-<random>`) and re-sent unchanged on every retry.
- **Pin privacy.** `GET /collector/jobs` rows have the address, landmark, a distance and an approximate (server-rounded, about 100 m) `lat`/`lng` for the map only. Dropping the building number from `address` is the backend's duty; the mock does not do it. The exact `lat`/`lng` of the household arrives with `POST …/accept` and `GET /collector/pickups`. Neither shows the citizen's name or phone. The household sees the collector's first name and a verified badge (the app shows no district).
- **Prices.** The app never keeps a price. `null` price means "السعر هيتحدد". The mock ships DEMO prices; remove none of this logic when real prices arrive.
- **Waste classify.** The app shows the result as a suggestion; any failure just hides the suggestion.
- **CO₂.** `co2AvoidedKg` is shown only when the backend sends it.
- **Report a full bin.** The app calls `POST /bins/{id}/report-full` and then refreshes the report list, so the new garbage incident must be returned by `GET /incidents` and `GET /reports` for that citizen.
- Request ids starting with `RCY-` open the pickup screen; keep that prefix.
