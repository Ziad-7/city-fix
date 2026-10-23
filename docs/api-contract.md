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
- IDs are human-readable strings: reports `FTC-1042`, incidents `INC-501` (unpadded, as stored; clients must treat ids as opaque strings), service requests `SRV-2001`, work orders `WO-318`.
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
- **Demo mode** (`OTP_MODE=demo`): no SMS is sent and the code is always `123456`. Configured production SMS/WhatsApp uses the Twilio Verify adapter; there is no demo fallback.
- A first successful verify creates the citizen profile.

The production adapter is opt-in through `OTP_MODE=twilio` and the server-only Twilio Verify bindings. Missing/rejected/unavailable provider configuration returns `503`, timeout `504`, provider throttling `429`; an expired/missing verification check counts as invalid and returns `401`. It never falls back to demo mode. Phone-keyed HMAC windows allow five starts and ten checks per ten minutes; raw OTPs are not stored. An approved challenge generation expires within ten minutes and is consumed atomically before issuing a session, so a replay returns `401`. `OTP_MODE=demo` is explicitly local/demo behavior and does not send a code.

### Notifications and push

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/notifications?limit=50&beforeId=<id>` | — | `{ items: Notification[], nextBeforeId: string \| null }` |
| PATCH | `/notifications/{id}` | `{ read: true }` | `Notification` |
| POST | `/notifications/push-tokens` | `{ token, platform: "ios" \| "android" }` | `204` |
| DELETE | `/notifications/push-tokens` | `{ token }` | `204` |

`Notification = { id, kind: "incident_status" | "pickup_status", title, body, data: { incidentId? | pickupId? }, createdAt, readAt }`. IDs are opaque UUID strings. The page is newest first, limit is 1..100, and `beforeId` must identify one of the caller's notifications or returns `404`. A foreign notification read/mark also returns `404`; marking read is idempotent. Bodies are generic and contain no exact location or phone. `data` contains exactly the relevant resource ID, which clients must load through its separately authorized route. A real incident status transition notifies linked reporters/followers once; a real pickup status transition notifies its household and assigned collector profile once, with duplicate profiles collapsed. No-op transitions and rolled-back domain changes emit nothing.

Push tokens must match Expo token syntax and be at most 256 characters. Registration explicitly binds or transfers a token to the caller; deletion is caller-scoped and idempotent. Tokens are never returned. Notification/push rows are persisted even if provider dispatch is disabled. The bounded worker is invoked separately with `PUSH_ENABLED=true`; Expo ticket acceptance is pending delivery, while an `ok` receipt is recorded as delivered (Expo receipt, not proof a person saw it). Transient send failures retry at most three times. Receipt polling starts after 15 minutes; three empty polls spaced 15 minutes apart change a ticket to `unknown`. Uncertain sends are not resent automatically. `EXPO_TOKEN` is an optional server-side Expo access token, not a device token. No scheduler is configured.

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
| POST | `/triage` | `{ description: string, categoryId?, photoUri?, photoConsent?: boolean, location?: { lat, lng } }` | `TriageSuggestion` |

- Use structured model suggestions when configured; on missing credentials, timeout, quota, or invalid output, return the deterministic Arabic/English keyword result. Photo analysis is opt-in through `photoConsent` and disabled by default. Duplicates come from the database (see below).
- Must answer within ~5 s; on model failure return the keyword result rather than an error (manual fallback).

### Photo and voice-note uploads
The backend signs uploads into a private Supabase Storage bucket. Photo analysis requires a separate per-request `photoConsent: true`; omit it unless the user has explicitly agreed to send the photo to the configured AI provider. Analysis remains disabled by default.
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/uploads/sign` | `{ kind: "report_photo" \| "voice_note", contentType }` | `{ uploadUrl, path }` |

`contentType` is `image/jpeg` for photos and one of `audio/mp4`, `audio/mpeg`, `audio/webm`, or `audio/ogg` for voice notes. The `PUT` must use the same `Content-Type` as signed. Clients `PUT` the file to `uploadUrl`, then send `path` in `photoUris` or `voiceNoteUri`. The backend verifies the user-scoped path, uploaded MIME type, and size before accepting a report. Voice notes are limited to 5 MB and 30 seconds, including a server-side duration check before transcription. Reads use short-lived signed URLs. The bucket must remain private. Before AI processing, metadata is removed, images are resized, and detected face/plate regions are blurred. The bundled Haar cascades are best-effort and not yet validated for local photos; photo AI stays disabled until that validation and the client consent UI are complete.

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

### AI (CityBrain)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/ai/transcribe` | `{ path }` (an uploaded voice note) | `{ text, language: "ar-EG", confidence }` |

The app calls `/ai/transcribe` after the citizen records a voice note and appends `text` to the description (still editable); it ignores `language`. The authenticated API reads only a caller-owned `voice_note` from private storage. Any provider or storage error leaves the citizen free to type the description; the voice note itself is still sent with the report as `voiceNoteUri`. In API mode, the recording control discloses that the file is uploaded privately and sent to Gemini; the free tier may use submitted content to improve Google products.

`TriageSuggestion` includes `source: "model" | "fallback"` and `emergency: boolean`. When `emergency` is true, clients display emergency contact options before the AI suggestion; client-side keyword detection remains a safety fallback while triage is loading or unavailable.

### Analytics APIs (Member 5)

These endpoints are implemented by the Member 5 AI/optimizer branch. Clients should show an unavailable/retry state when the branch is not deployed or an optional runtime dependency is unavailable.

`GET /admin/bins/forecast?horizonHours=24` is staff-only; `horizonHours` is integer 1..168. It returns `{ generatedAt, horizonHours, items: [{ binId, currentFillPct, predictedFillPct, hoursToFull, sampleCount, method: "linear"|"insufficient_data", reason: "ok"|"insufficient_data"|"stale"|"non_increasing" }] }`. It uses only valid synchronized readings from the preceding seven days, discards future readings, splits trend history after a 20-point collection reset, and requires at least three distinct timestamps spanning one hour. The newest persisted sequence must itself be synchronized, not future dated, and match both the bin's current fill and `lastSeq`; stale or misaligned data yields null predictions. Linear predictions are clamped to 0..100 and use the bin's full threshold; this is telemetry extrapolation, not a Gemini forecast.

`POST /admin/recycling/routes/optimize` is admin-only and previews without assigning or persisting. Body: `{ pickupIds: string[], depot: { lat, lng }, vehicleCount, capacityKg }`; IDs are unique, 1..100, vehicle count 1..10, capacity finite >0 and <=10000, and coordinates use normal ranges. Pickups must be requested, unassigned, accessible and have positive known item weights; missing/inaccessible IDs return 404, changed/assigned pickups 409, invalid weights or coordinates 422. Demand and capacity are scaled to grams; OR-Tools CVRP uses straight-line haversine meters, one deterministic worker and a three-second deadline. Response: `{ algorithm: "ortools", distanceModel: "haversine", routes: [{ vehicleIndex, pickupIds, loadKg, distanceMeters, stops: [{ pickupId, lat, lng }] }], unassignedPickupIds, totalDistanceMeters }`. Every pickup appears once in a route or the unassigned list; empty routes are omitted. Unavailable OR-Tools returns 503 without a hidden fallback. Results contain no addresses, names or phone numbers.

`GET /admin/hotspots?days=30&radiusMeters=500&minCount=3` is staff-only. Bounds are days 1..90, radius 100..2000m, and minimum count 3..20. It clusters only scoped, valid-coordinate garbage incidents created in the trailing window; other categories never contribute. Response: `{ generatedAt, days, radiusMeters, minCount, items: [{ id, lat, lng, count, categoryCounts: [{ categoryId, count }], maxPriorityScore }] }`. Clustering follows haversine DBSCAN semantics, stable incident-ID ordering and minCount including the point itself. IDs are `HS-` plus a hash of sorted scoped incident IDs; centroids are rounded to three decimals. No source incident IDs, reporters, addresses, descriptions, media or phones are exposed, and aggregation happens only after department scoping.

### Smart-bin telemetry and Command Center

Implemented by `backend/app/routers/bins.py`. Device requests use a dedicated provisioned key, not a citizen/staff bearer token. Admin routes require the existing staff JWT and apply department filtering.

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/iot/bins/{binId}/readings` | Header `X-Device-Key`; `{ readings: [{ seq, at, fillPct, distanceCm?, tempC?, batteryV?, rssi?, fw? }] }` → `202 { accepted: number[], intervalMin, fullPct, heatC }` |
| POST | `/admin/bins` | Admin JWT; bin ID/name/location/threshold configuration → bin and one-time `deviceKey` |
| GET | `/admin/bins` | Staff/admin JWT → authorized bin fleet and current status |
| GET | `/admin/bins/{binId}/readings?limit=100&from=…&to=…` | Staff/admin JWT → newest-first telemetry history |
| GET | `/admin/bins/{binId}/latest` | Staff/admin JWT → latest recorded reading |

Sequence IDs are strict integers and unique per bin. `fillPct` is required; temperature, battery, distance, RSSI and firmware are optional measurements. Missing temperature is unavailable, not zero, and cannot trigger a heat alert. Boolean values are rejected for numeric fields. An identical retry is acknowledged; reuse of a sequence with any changed sensor value or device timestamp (including `at: null` versus a timestamp) returns `409`. A null `at` means the device clock was unsynchronized: the backend preserves that original null and separately exposes `recordedAt` (the effective display time), `receivedAt`, `deviceAt`, and `clockUnsynced` (`true`/`false`, or `null` for migrated legacy rows whose original timestamp cannot be recovered). The public website demo (`/smart-bin`) is intentionally browser-local and is not a device credential client; use `hardware/simulator` real mode to send authenticated telemetry. Deployment and migration requirements are in [`backend/README.md`](../backend/README.md#smart-bin-telemetry-and-command-center) and [`hardware/simulator/README.md`](../hardware/simulator/README.md#online-hosting-and-free-tier-limits).

## Business rules the backend owns

- **Duplicates:** an open incident (`status` not `resolved`/`closed`) of the **same category** within **250 m** of the new location. Use PostGIS `ST_DWithin(location, point, 250)` on `geography`. Return nearest first with `distanceM`. Exclude incidents the caller already follows; incidents the caller reported go to `alreadyReported` (with their `reportId`) instead of `duplicates`.
- **Report validation:** a category plus at least one photo **or** a description of 10+ characters.
- **Priority:** deterministic, same formula as `apps/mobile/src/logic/priority.ts` (severity 5/15/28/40; sensitive place +20; reporters `min(20, (n-1)×3)`; age `min(15, round(daysOpen/targetDays×10))`; underserved area +5; cap 100). Recompute when reporters/followers change and daily for age. Return every factor so the UI can explain the score.
- **Timeline:** every status change writes an `activity_log` row; `Incident.timeline` / `ServiceRequest.timeline` are built from it, oldest first.
- **Privacy:** citizens never see other citizens' phone numbers or names; anonymous reports hide the reporter from admins too (keep the id for abuse handling only).


## Command Center (admin web) — implemented in `backend/`

Status of the staff/admin API used by `apps/admin-web`. Everything below is **implemented** unless marked otherwise. Staff tokens (`role: "staff"`) only see and change their own department (403 `"مش مسموح"` otherwise); `budget/*` and `demo/reset` are admin only; a citizen token on `/admin/*` is 403. Invalid enum values in any body are `422 {"detail": "البيانات مش مكتملة"}`.

### Admin shapes

```ts
StaffSession = { userId, name, title, role: 'staff'|'admin', department?: string /* Arabic name, absent for admin */, district, token }
// GET /auth/me returns the same without `token`.
Department = { id, nameAr, external: boolean, externalHotline?: string }
LinkedReport = { id, reporter: 'مواطن'|'بلاغ بدون اسم', description, source: 'app'|'web', photoCount, photoUrls?: string[], createdAt }
// photoUrls: only on GET /admin/incidents/{id} (not the list). Short-lived (15 min) signed read URLs of the
// linked report's photos when private storage is configured, the stored paths in the local demo. Signed only
// after the staff member passed the department-scope check; a path that cannot be signed is left out.

AdminIncident = Incident & {
  linkedReports: LinkedReport[],
  triage?: TriageSuggestion & { source: 'model'|'fallback', confirmed: boolean },
  dueAt: string,            // createdAt + category targetDays (calendar days)
  overdue: boolean,         // open && now > dueAt
  external: boolean, externalHotline?: string,
  inBudgetPlan: boolean,    // selected in the last saved budget plan
  lastReviewedBy?: string, lastReviewedAt?: string
}

WorkOrderTask = { label: string, done: boolean }
WorkOrderUpdate = { status: WorkOrderStatus, note: string, actor: string, at: string }
WorkOrderStatus = 'open'|'assigned'|'in_progress'|'done'
WorkOrder = {
  id, incidentId?, serviceRequestId?, title, address, department, external: boolean, externalHotline?,
  team?, teamSize?, supervisor?, status: WorkOrderStatus, dueAt, overdue: boolean, estimatedCostEgp: number,
  priorityScore?, followers?, tasks: WorkOrderTask[], updates: WorkOrderUpdate[], createdAt, updatedAt, resolvedAt?
}
AdminServiceRequest = ServiceRequest & { department: string, paid: boolean, assignee?: string, workOrderId?: string }

DashboardStats = {
  open, openDelta, overdue, resolvedThisWeek, resolvedDelta, avgResolutionDays, avgResolutionDeltaDays,
  byCategory: { categoryId, count }[],               // open only, desc
  byStatus: { status, count }[],                     // the 4 open statuses (current) + resolved within the range
  overdueList: { incidentId, title, department, address, priorityScore, dueAt, hoursLate, external, externalHotline? }[],
  overdueTotal, departments: { department, external, externalHotline?, open, overdue, avgResolutionDays, loadPct }[],
  activity: { actor, text, entityId?, status?, at }[], nav: { incidentsOpen, serviceRequestsOpen }
}
BudgetItem = { incidentId, title, categoryId, costEgp, priorityScore, followers, reason }
BudgetPlan = { budgetEgp, selected: BudgetItem[], skipped: BudgetItem[], totalCost, remaining, coveredPriority, totalPriority, citizensServed, citizensTotal }
Insights = { summary, hotspots: { address, count }[], risingCategories: { categoryId, delta }[], overdueDepartments: string[] }
```

Optional keys are omitted, never `null`. Dashboard semantics: `open` is always the current open count (never range-filtered); `range` (`today|7d|30d`, default `7d`) windows `resolvedThisWeek`, `openDelta` (created in window minus resolved in window), `avgResolutionDays` (mean days created to resolved, 1 decimal) and the `*Delta` values (current window minus the previous equal window). `overdue`/`overdueTotal` count open incidents past `dueAt`; `overdueList` also includes those due within 12 h (`hoursLate` is negative then), priority desc, max 5. Staff dashboards count only their department.

### Endpoints (all implemented)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/staff-login` | `{email,password}` to `StaffSession`; 401 `"البريد أو كلمة السر غلط"` |
| GET | `/auth/me` | `StaffSession` without token |
| GET | `/admin/departments`, `/admin/teams` | `Department[]`; `{ name, department, size }[]` |
| GET | `/admin/dashboard?range=` | `DashboardStats` |
| GET | `/admin/incidents?status=&categoryId=&department=&critical=&overdue=&q=` | `AdminIncident[]`, priority desc. No `status` filter returns open + resolved + closed. `department` takes an id or the Arabic name; `q` searches title, address, id |
| GET | `/admin/incidents/{id}` | `AdminIncident` |
| PATCH | `/incidents/{id}` | `{status?, severity?, categoryId?, department?, note?}`. `note` required on a real status change (400 `"اكتب رسالة للمواطنين"`); a note alone appends a timeline entry with the current status. Severity/category change recomputes priority; a category change also moves the department unless `department` is given. `/admin/incidents/{id}` PATCH is an alias. `GET /incidents/{id}` (citizen) shares the path |
| POST | `/admin/incidents/{id}/triage/confirm` | `{categoryId?, severity?}`; records reviewer, marks triage confirmed, moves only `received` to `triaged` (note `"اتأكّد التصنيف: <label>"`) |
| GET | `/admin/incidents/{id}/similar` | `DuplicateMatch[]` (open, same category, 250 m, not itself, nearest first) |
| POST | `/admin/incidents/{id}/merge` | `{intoIncidentId}`; moves reports and followers, closes the source with a note, returns the target |
| GET | `/admin/work-orders?status=&department=`, `/admin/work-orders/{id}` | `WorkOrder[]` newest first |
| POST | `/admin/work-orders` | `{incidentId?, serviceRequestId?, department (id or Arabic name), team?, teamSize?, supervisor?, dueAt?, tasks?: string[]}`; at least one target; 409 if it already has a work order. Tasks default from the category; moves the incident to `assigned` only from `received`/`triaged` |
| PATCH | `/admin/work-orders/{id}` | `{status?, team?, teamSize?, supervisor?, dueAt?, tasks?: WorkOrderTask[], note?}`; `in_progress`/`done` need a note (400) and move the linked incident/request to `in_progress`/`resolved` |
| GET | `/admin/service-requests?status=&serviceType=&day=&payment=` | `AdminServiceRequest[]`, day asc then slot; `assignee` is admin-only (not in citizen `details`) |
| PATCH | `/admin/service-requests/{id}` | `{status?, day?, slot?, assignee?, note?}`; note required on status change |
| POST | `/admin/budget/optimize` | admin; `{budgetEgp > 0, incidentIds?}`; 0/1 knapsack, exact over 100 EGP units (costs rounded up), ties by followers; empty `incidentIds` means all open; saved as the current plan |
| POST | `/admin/budget/commit` | admin; `{incidentIds}` creates `WorkOrder[]` (same creation path as `POST /admin/work-orders`) |
| GET | `/admin/insights` | `Insights` (deterministic, computed from data) |
| POST | `/admin/demo/reset` | admin; re-seeds |

### Citizen endpoints (implemented)

`POST/GET /reports`, `GET /reports/{id}` (403 for another citizen's, admins read all), `GET /incidents`, `GET /incidents/{id}` (staff tokens also get the AdminIncident fields), `POST /incidents/{id}/follow` (idempotent), `POST /incidents/{id}/reopen` (reporter/follower, only from `resolved`, else 403/409), `GET /map/incidents` (`status`, `categoryId`, `bbox`), `POST/GET /service-requests`, `GET /service-requests/{id}`, `POST /triage`, `POST /ai/transcribe`, `POST /uploads/sign`. Not implemented yet: `/services/garbage-schedule`.

### Deviations from the text above

- `POST /auth/otp` answers `204` with an empty body.
- `GET /map/incidents` needs a Bearer token like every other non-auth route.
- Duplicates use haversine in Python (no PostGIS locally); same 250 m rule.
- `POST /triage` also returns `source: "fallback"` (and `emergency: true` on gas/fire/injury/collapse words) and always includes `alreadyReported` (empty array when none).
- A new incident also stores a keyword triage suggestion (`source: "fallback"`, `confirmed: false`) so the admin AI card has data.
- `POST /uploads/sign` is a local stub: `uploadUrl` points to `/uploads/local/{path}` on the API, which accepts a `PUT` and discards it.
- `StaffSession.department` is the Arabic department name; the JWT carries the department id.
- Timeline `actor` for staff changes is the staff member's display name.
- **Auth boundary (backend):** the JWT carries only the user id; the role and department scope are reloaded from the database on every request, so a demoted, re-assigned or removed staff member loses access immediately (staff without a department get `403`). Outside `OTP_MODE=demo`, `POST /auth/otp` and `/auth/verify` answer `503`. Staff login is limited to 5 attempts per e-mail per minute (`429`, `Retry-After`).
- `POST /admin/demo/reset` answers `404` unless the server runs with `DEMO_RESET_ENABLED=true`.
- Citizen validation: a report linking to an incident (`linkToIncidentId`) must match its category, be open and be within 250 m (`409` otherwise); service `day` must be a real date, and `bulky_waste` needs a future Sunday–Thursday (Cairo time), else `422`; `GET /map/incidents` rejects bad or out-of-range `bbox` with `400` and unknown `status`/`categoryId` with `422`.
- `POST /uploads/sign` can be backed by a private storage (`app.state.media_storage`): report photo/voice paths must then have been uploaded by the caller (`403`), reads are signed, and the reporter id of an anonymous report is hidden from everyone but its author.

## CityCycle — proposed

> **Backend status (2026-10):** the analytics routes `GET /admin/bins/forecast`, `POST /admin/recycling/routes/optimize`, and `GET /admin/hotspots` are implemented on the Member 5 branch. `POST /gateway/sms` remains deferred. Tests: `backend/tests/test_citycycle.py`, `test_waste_classify.py`. Exact behaviours the backend added are in *Backend behaviour* below.

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
| GET | `/admin/recycling/summary` | Query `from`, `to` (date or ISO datetime), `district`. Returns `{ totalKg, tonnes, byMaterial: {materialId, kg}[], byDistrict: {district, kg}[], pickups, byStatus: {status: n}, avgResponseMinutes \| null }`. Kg are from weighings; `pickups` counts requests created in the range. |
| GET | `/admin/recycling/pickups` | Query `status`, `district`, `from`, `to`, `limit` (default 100): `RecyclingPickup[]` newest first, each with `district`. Staff-readable, but for non-admin staff the household is redacted: `location` is only `{ address: <district> }` (no pin, no landmark), `citizenId` is `""`, and `photoUris`/`note` are empty. Admins get the exact pin; `GET /admin/recycling/pickups/{id}` adds `citizenName` for admins only (never the phone). |
| PATCH | `/admin/recycling/pickups/{id}` | `{ status?, collectorId?, note? }` dispatch: `status: "cancelled"` (only while `requested`/`accepted`), `status: "accepted"` + `collectorId` (assign a *verified* collector to a `requested` pickup; `409` otherwise), or a note only. Other statuses return `409`. Returns the pickup (+ `district`). **Admin only** (`403` for department staff). |
| GET | `/admin/collectors` | Query `status`, `district`: `Collector[]` plus `userId`, `phone` and `note` (staff only). `PATCH /admin/collectors/{id}` `{ status, note? }` verifies or suspends and returns the `Collector` |
| GET | `/admin/material-prices` | Query `district` (staff read-only): `MaterialPrice[]`, one per material, `null` where unset |
| PUT | `/admin/material-prices` | `{ district, prices: { materialId, priceEgpPerKg \| null }[] }`; admin only (`403` for staff); a `null` clears a price; returns the full `MaterialPrice[]` for the district. Prices are set by the district, not by this repo |
| GET | `/admin/bins` | With latest readings; `POST /admin/bins` registers a bin and returns its device key **once**; `PATCH /admin/bins/{id}` (admin) `{ name?, isActive?, fullPct?, heatC?, intervalMin?, rotateKey? }`: `isActive: false` revokes device auth, `rotateKey: true` returns a new `deviceKey` **once** (`{ bin, deviceKey? }`) |
| GET | `/admin/bins/{id}/readings` | Query `from`, `to` |
| GET | `/admin/bins/forecast` | Fill forecast per bin — owner member 5 |
| POST | `/admin/recycling/routes/optimize` | `{ date, collectors?, binIds? }` → ordered stops per vehicle — owner member 5 |
| GET | `/admin/hotspots` | Dumping hotspots with counts and status — owner member 5 (detection), member 4 (storage) |
| GET | `/admin/payouts` | Query `from`, `to`, `collectorId?`: `{ collectorId, collectorName, kg, valueEgp, paidToHouseholdsEgp, jobs }[]` (recorded, not processed) |

### AI (CityBrain) — CityCycle, owner member 5

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/ai/waste-classify` | `{ path, photoConsent?, description? }` (an uploaded photo) | `WasteClassification` |

Suggestion only: the citizen or collector confirms the materials and the size. On timeout or error return a fallback result with `source: "fallback"`, never an error to the person.

*Backend behaviour:* Gemini (`source: "model"`) is used only when `GEMINI_API_KEY` is set, `GEMINI_PHOTO_ANALYSIS_ENABLED=true`, **and** the request carries `photoConsent: true` (same privacy gate as `/triage`: the photo is read from the caller's private storage and redacted before the model sees it). Otherwise the deterministic fallback answers: with no usable `description` hint it returns `materials: []`, `size: "medium"`, `estimatedKgRange: [3, 10]`; with a hint it keyword-matches materials. Clients that want model results must show the disclosure and send `photoConsent: true`.

### SMS / USSD reporting gateway — proposed, stretch

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/gateway/sms` | Provider webhook: a short coded message (for example a district code + material + "pickup") creates a pickup for a feature phone. Provider and codes to decide; replies in Egyptian Arabic. |

### Backend behaviour (CityCycle)

- **One permission rule for CityCycle admin routes:** reads are staff (`staff` or `admin`), every write is admin only (`PATCH /admin/recycling/pickups/{id}`, `PATCH /admin/collectors/{id}`, `PUT /admin/material-prices`, bin `PATCH`). Department staff never see a household's exact location or name.
- **Idempotency.** `POST /reports` and `POST /recycling/pickups` accept an optional `Idempotency-Key` header (up to 100 characters). A repeat with the same key by the same user returns the original resource (same body, `200`) instead of creating a second one; keys are scoped per user and per endpoint, and a longer key is `422`.
- **Suspension releases jobs.** `PATCH /admin/collectors/{id}` to anything but `verified` returns that collector's `accepted` pickups (no weighing yet) to `requested` with a timeline note; `weighed` but unfinished ones stay with the collector and get a timeline flag for staff. Admin cancel and a collector's weighing are mutually atomic: a cancel with an existing weighing is `409`.
- **Collector role is derived** from `collectors.status == 'verified'` (not from `profiles.role`). There is no `collector` value on `profiles.role`: a user is a collector when a `collectors` row exists for them, and may use `/collector/*` only while its `status` is `verified` (`403` otherwise, `404` on `GET /collectors/me` before applying). One account can be citizen and collector. A second `POST /collectors/apply` returns `409`.
- **District prices.** A pickup is priced against the price-list district matching the caller's profile district (exact, then containment, default `مدينة نصر أول`). `GET /recycling/materials?district=` uses the same matching. The seeded prices are DEMO values; set real ones with `PUT /admin/material-prices`.
- **Status codes.** Weighing: `201` new, `200` repeat of the same `clientId`; `403` not the accepting collector, `409` pickup not `accepted`/`weighed` or already finished, `422` kg outside 0.5 to 500. Accept: `409` taken or cancelled (a retry by the same collector returns `200`), `403` for the caller's own household pickup. Complete: `409` without a weighing (a repeat returns `200`). Confirm: `409` until the collector has completed (a repeat returns `200`). Cancel: `409` once accepted. Pickup `day` must be today or later (Cairo), else `422`.
- **Pin privacy** is enforced as described above (address without building number, coordinates rounded to 3 decimals ~100 m, `distanceM` computed to that rounded point so repeated queries cannot reveal the exact home; the household's free-text `note` and `landmark` are not in `GET /collector/jobs` and appear only after accept). Collector views of a pickup send `citizenId: ""` and no `photoUris`.
- **Timeline** (`activity_log`, entity `recycling_pickup`): `requested`, `accepted`, `weighed` (first weighing, and again on complete), `completed`, `cancelled`.
- **Impact** counts weighings of pickups that are `weighed` or `completed`; `co2AvoidedKg` is never sent. `GET /collector/earnings` defaults to the last 30 days.
- **Bins.** `GET /bins` returns active bins (any authenticated user) with optional `bbox=minLng,minLat,maxLng,maxLat` and `district`; `kind` is `hub` when the id starts with `HUB`; `location.address` is the bin name; `state` maps `normal`->`ok`, `heat`->`hot`. `POST /bins/{id}/report-full` returns `204`: a `garbage` report at the bin's pin, joining the bin's open incident when one exists (a person who already reported it is a no-op); `404` unknown bin. `POST /iot/hubs/{id}/weighings` (ids starting with `HUB` only, `404` otherwise) takes `{ seq, at?, material, kg, pickupId? }`, device auth, idempotent on `(hubId, seq)` (`409` on different data) and answers `202 { accepted: seq }`.
- **Uploads fail loudly.** With no media storage configured, `POST /uploads/sign` answers `503` (and `PUT /uploads/local/*` `404`) unless the local stub is allowed: `ALLOW_LOCAL_UPLOAD_STUB` unset means allowed only on SQLite (local dev/tests); set it to `true` to keep the discarding stub on a deployed demo, `false` to forbid it everywhere.

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
