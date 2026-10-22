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


## Command Center (admin web) — implemented in `backend/`

Status of the staff/admin API used by `apps/admin-web`. Everything below is **implemented** unless marked otherwise. Staff tokens (`role: "staff"`) only see and change their own department (403 `"مش مسموح"` otherwise); `budget/*` and `demo/reset` are admin only; a citizen token on `/admin/*` is 403. Invalid enum values in any body are `422 {"detail": "البيانات مش مكتملة"}`.

### Admin shapes

```ts
StaffSession = { userId, name, title, role: 'staff'|'admin', department?: string /* Arabic name, absent for admin */, district, token }
// GET /auth/me returns the same without `token`.
Department = { id, nameAr, external: boolean, externalHotline?: string }
LinkedReport = { id, reporter: 'مواطن'|'بلاغ بدون اسم', description, source: 'app'|'web', photoCount, createdAt }

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
| POST | `/admin/budget/optimize` | admin; `{budgetEgp > 0, incidentIds?}`; exact 0/1 knapsack, cost in units of 100 EGP (rounded up), ties by followers; empty `incidentIds` means all open; saved as the current plan |
| POST | `/admin/budget/commit` | admin; `{incidentIds}` creates `WorkOrder[]` (same creation path as `POST /admin/work-orders`) |
| GET | `/admin/insights` | `Insights` (deterministic, computed from data) |
| POST | `/admin/demo/reset` | admin; re-seeds |

### Citizen endpoints (implemented)

`POST/GET /reports`, `GET /reports/{id}` (403 for another citizen's, admins read all), `GET /incidents`, `GET /incidents/{id}` (staff tokens also get the AdminIncident fields), `POST /incidents/{id}/follow` (idempotent), `POST /incidents/{id}/reopen` (reporter/follower, only from `resolved`, else 403/409), `GET /map/incidents` (`status`, `categoryId`, `bbox`), `POST/GET /service-requests`, `GET /service-requests/{id}`, `POST /triage`, `POST /uploads/sign`. Not implemented yet: `/ai/transcribe`, `/services/garbage-schedule`.

### Deviations from the text above

- `POST /auth/otp` answers `204` with an empty body.
- `GET /map/incidents` needs a Bearer token like every other non-auth route.
- Duplicates use haversine in Python (no PostGIS locally); same 250 m rule.
- `POST /triage` also returns `source: "fallback"` (and `emergency: true` on gas/fire/injury/collapse words) and always includes `alreadyReported` (empty array when none).
- A new incident also stores a keyword triage suggestion (`source: "fallback"`, `confirmed: false`) so the admin AI card has data.
- `POST /uploads/sign` is a local stub: `uploadUrl` points to `/uploads/local/{path}` on the API, which accepts a `PUT` and discards it.
- `StaffSession.department` is the Arabic department name; the JWT carries the department id.
- Timeline `actor` for staff changes is the staff member's display name.
