# Core backend: two-person ownership

Agreed split, 2026-10-21. This divides role 4; role 5 (AI and optimizer) stays separate.

| Area | Moataz: citizen API and authentication | Teammate (name pending): database and operations |
| --- | --- | --- |
| Authentication | Citizen OTP, staff login, JWT, shared permission helpers | Apply helpers to staff operations |
| Reports/incidents | Create/read reports; read/follow incidents; map API | Atomic database operations, status updates, assignments, merges |
| Services/media | Citizen bookings, signed upload/read API | Staff scheduling, storage configuration |
| Shared logic | Input and response validation | Priority, duplicates, timeline, IDs, AI query interfaces |
| Infrastructure | Tests and documentation for own endpoints | App assembly, configuration, DB, migrations, seeds, CI, Docker, deployment |

## File ownership

- Moataz: `backend/app/auth.py`, `schemas/auth.py`, citizen schemas; `routers/auth.py`, `reports.py`, `incidents.py` (read/follow only), `map.py`, `service_requests.py` (citizen only), proposed `staff_auth.py`/`uploads.py`; demo harness, citizen contracts, and initial dependency/CI manifests.
- Teammate: `backend/app/main.py`, `config.py`, `db.py`, `logic/`, `routers/admin.py`, admin schemas, `backend/supabase/migrations/`, deployment files and backend CI.
- Both: tests for their respective code, progress-log entries, and contract proposals. Assign a single owner before editing shared schemas; avoid overlapping edits.
- AI member: `backend/app/ai/`, `optimizer/`, AI routers and evaluation; unchanged.

Staff mutations may live in `routers/admin.py` while retaining contract URLs such as `PATCH /incidents/{id}`.

## Integration agreements

1. Only the teammate creates migrations. Moataz requests columns and constraints through a small contract/schema PR.
2. Authentication lives in one module. `current_user`, `require_role`, and `require_department` are shared; authorization must use the stored resource department.
3. Business writes belong to shared logic. Report creation/linking/following and timeline changes must be transactional; clients never independently maintain follower counts.
4. Proposed internal interfaces: `create_report`, `follow_incident`, `find_nearby_incidents`, `change_incident_status`. Agree arguments/results before implementation. Only the auth repository interface exists so far.
5. Auth persistence implements `UserRepository.get_or_create_citizen(normalized_phone)` and `get_by_id(user_id)`. Creation must be atomic, unique by phone, and citizen-only. Return persisted role/department on lookup.
6. Teammate assembles `AuthContext(AuthSettings(...), database_users)` in `app.state.auth_context` and registers the auth router. Demo OTP is opt-in; real delivery is not implemented.
7. Upload and staff/admin contract proposals still need client-owner agreement. This split does not approve those API changes.

## Delivery stages

| Stage | Moataz | Teammate |
| --- | --- | --- |
| 1 | Demo citizen auth, JWT, permission helpers, tests | FastAPI skeleton, DB migrations/seed, auth repository adapter |
| 2 | Report/read/follow endpoints | Report transactions, priority, duplicates, timelines |
| 3 | Services, map, uploads; staff login after contract agreement | Admin operations, work orders, dashboard |
| 4 | Mobile API integration | Deployment, CORS, storage, demo reset |

Together verify: citizen logs in and reports → staff updates status → citizen sees timeline.

## Contribution workflow

Use short `feat/api-…` branches and small PRs. Each PR describes what changed, how to test, links its progress entry, and lists limitations. Review each other's changes before merge. Each owner tests their own code; the teammate maintains shared CI. Do not mark review/CI/latest-main checks complete until actually verified.
