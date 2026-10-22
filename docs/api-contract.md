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

### Smart-bin telemetry and Command Center

Implemented by `backend/app/routers/bins.py`. Device requests use a dedicated provisioned key, not a citizen/staff bearer token. Admin routes require the existing staff JWT and apply department filtering.

| Method | Path | Body / response |
| --- | --- | --- |
| POST | `/iot/bins/{binId}/readings` | Header `X-Device-Key`; `{ readings: [{ seq, at, fillPct, distanceCm?, tempC, batteryV, rssi?, fw? }] }` → `202 { accepted: number[], intervalMin, fullPct, heatC }` |
| POST | `/admin/bins` | Admin JWT; bin ID/name/location/threshold configuration → bin and one-time `deviceKey` |
| GET | `/admin/bins` | Staff/admin JWT → authorized bin fleet and current status |
| GET | `/admin/bins/{binId}/readings?limit=100&from=…&to=…` | Staff/admin JWT → newest-first telemetry history |
| GET | `/admin/bins/{binId}/latest` | Staff/admin JWT → latest recorded reading |

Sequence IDs are unique per bin. An identical retry is acknowledged; reused sequences with different reading values return `409`. `at` is nullable for clock-unsynced devices and falls back to server receive time. The public website simulator is intentionally browser-local and is not a device credential client; use `hardware/simulator` real mode to send authenticated telemetry. Deployment and migration requirements are in [`backend/README.md`](../backend/README.md#smart-bin-telemetry-and-command-center) and [`hardware/simulator/README.md`](../hardware/simulator/README.md#online-hosting-and-free-tier-limits).

## Business rules the backend owns

- **Duplicates:** an open incident (`status` not `resolved`/`closed`) of the **same category** within **250 m** of the new location. Use PostGIS `ST_DWithin(location, point, 250)` on `geography`. Return nearest first with `distanceM`. Exclude incidents the caller already follows; incidents the caller reported go to `alreadyReported` (with their `reportId`) instead of `duplicates`.
- **Report validation:** a category plus at least one photo **or** a description of 10+ characters.
- **Priority:** deterministic, same formula as `apps/mobile/src/logic/priority.ts` (severity 5/15/28/40; sensitive place +20; reporters `min(20, (n-1)×3)`; age `min(15, round(daysOpen/targetDays×10))`; underserved area +5; cap 100). Recompute when reporters/followers change and daily for age. Return every factor so the UI can explain the score.
- **Timeline:** every status change writes an `activity_log` row; `Incident.timeline` / `ServiceRequest.timeline` are built from it, oldest first.
- **Privacy:** citizens never see other citizens' phone numbers or names; anonymous reports hide the reporter from admins too (keep the id for abuse handling only).
