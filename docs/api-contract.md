# API contract — mobile app ⇄ backend

This is what the citizen mobile app (`apps/mobile`) sends and expects. The app already runs on mock data behind these exact shapes; switching to the real backend is a config change (`EXPO_PUBLIC_API_MODE=api`, `EXPO_PUBLIC_API_URL=https://…`). The admin web app will use the same API plus the `/admin/*` routes.

**Source of truth for types:** `apps/mobile/src/domain/types.ts`. The client is `apps/mobile/src/services/api/`.
**Changing the contract:** open a PR that edits this file and tag the mobile owner. Don't change shapes silently.

## Conventions

- JSON, **camelCase** keys (in FastAPI use Pydantic models with `alias_generator=to_camel`, `populate_by_name=True`, and return `by_alias=True`).
- Timestamps: ISO 8601 UTC strings (`2026-10-21T10:12:00Z`). Dates: `YYYY-MM-DD`.
- Auth: `Authorization: Bearer <token>` on everything except `/auth/*` and `/health`.
- The app sends `Accept-Language: ar`; error messages should be short Egyptian Arabic.
- Errors: HTTP status + `{ "detail": "رسالة قصيرة" }`. 400 validation, 401 no/expired token, 403 not your resource / not admin, 404 not found, 409 conflict (e.g. already following), 422 FastAPI validation.
- IDs are human-readable strings: reports `FTC-1042`, incidents `INC-0042`, service requests `SRV-2001`, work orders `WO-318`.
- Lists are newest first.

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
  timeline: TimelineEntry[], createdAt, updatedAt
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
  details: { items: string[], day: string /* YYYY-MM-DD */, slot: SlotId, payment: PaymentMethod, note?: string },
  location: Place, status: IncidentStatus, timeline: TimelineEntry[], createdAt
}
NewServiceRequestInput = { serviceType, details, location }

MapPin = { id, categoryId, title, status, severity, lat, lng }

DuplicateMatch    = { incidentId, title, categoryId, distanceM: number, followers: number, status }
TriageSuggestion  = {
  options: { categoryId, confidence: number }[],  // top 3, confidence desc, sum <= 1
  severity: Severity, summary: string /* one Arabic line */, duplicates: DuplicateMatch[]
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
| GET | `/map/incidents` | — | `MapPin[]` | Optional query: `status`, `categoryId`, `bbox=minLng,minLat,maxLng,maxLat`. |

### Service requests (CityServe)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/service-requests` | `NewServiceRequestInput` | `ServiceRequest` |
| GET | `/service-requests` | — | `ServiceRequest[]` (the caller's) |
| GET | `/service-requests/{id}` | — | `ServiceRequest` |

### Triage (CityBrain)
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/triage` | `{ description: string, categoryId?, photoUri?, location?: { lat, lng } }` | `TriageSuggestion` |

- Until the AI agent is ready, return a deterministic keyword classifier (port `apps/mobile/src/logic/triage-mock.ts`). Duplicates come from the database (see below).
- Must answer within ~5 s; on model failure return the keyword result rather than an error (manual fallback).

### Photo uploads (proposed — needs agreement)
The app currently sends local photo URIs. Proposal:
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/uploads/sign` | `{ kind: "report_photo" \| "voice_note", contentType: "image/jpeg" }` | `{ uploadUrl, path }` |

The app `PUT`s the file to `uploadUrl` (a Supabase Storage signed upload URL), then sends `path` in `photoUris`. Reads use short-lived signed URLs returned by the API. Faces and plates are blurred before a photo is shown to anyone but the reporter and admins (stretch: run the blur on upload).

### Admin (Command Center — web)
From the plan (§7). Admin role required.
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/admin/dashboard` | Counts: open, overdue, resolved this week, average resolution time |
| PATCH | `/incidents/{id}` | `{ status?, severity?, categoryId?, department?, note? }` — writes a timeline entry with the note shown to citizens |
| POST | `/admin/work-orders` | `{ incidentId? , serviceRequestId?, department, assignee }` |
| PATCH | `/admin/work-orders/{id}` | `{ status?, assignee?, note? }` |
| POST | `/admin/budget/optimize` | `{ budgetEgp, incidentIds? }` → `{ selected: [...], skipped: [...], totalCost, remaining, coveredPriority }` (owner: optimizer) |

## Business rules the backend owns

- **Duplicates:** an open incident (`status` not `resolved`/`closed`) of the **same category** within **250 m** of the new location. Use PostGIS `ST_DWithin(location, point, 250)` on `geography`. Return nearest first with `distanceM`.
- **Priority:** deterministic, same formula as `apps/mobile/src/logic/priority.ts` (severity 5/15/28/40; sensitive place +20; reporters `min(20, (n-1)×3)`; age `min(15, round(daysOpen/targetDays×10))`; underserved area +5; cap 100). Recompute when reporters/followers change and daily for age. Return every factor so the UI can explain the score.
- **Timeline:** every status change writes an `activity_log` row; `Incident.timeline` / `ServiceRequest.timeline` are built from it, oldest first.
- **Privacy:** citizens never see other citizens' phone numbers or names; anonymous reports hide the reporter from admins too (keep the id for abuse handling only).
