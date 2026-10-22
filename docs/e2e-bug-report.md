# End-to-end workflow bug report

Run: backend (SQLite, demo OTP, no Supabase or Gemini keys) on :8010, `apps/web` in `api` mode on :3000, `apps/admin-web` on :3001, driven with curl and Playwright (Chromium).

Flow covered: citizen sign-in (OTP 123456), signed photo upload, report with category + location + landmark, tracking timeline; admin staff-login, queue, incident detail, work order (assign team), status change with note, resolve; citizen sees the new timeline entries; citizen reopen. Backend `pytest`: 301 passed.

## Bugs

| # | Symptom | Root cause | Status |
| --- | --- | --- | --- |
| 1 | Admin incident detail page crashes ("Cannot read properties of undefined (reading 'lat')") whenever a nearby same-category incident exists, so the admin cannot change status on those incidents | `getSimilarIncidents` typed `GET /admin/incidents/{id}/similar` as `AdminIncident[]`, but the backend (and `docs/api-contract.md`) returns `DuplicateMatch[]`; the component did `haversineM(incident.location, inc.location)` on a match with no `location` | Fixed in `apps/admin-web/src/services/incidents.ts` (matches are resolved to full incidents; unreadable ones are dropped), with unit tests |
| 2 | Report photo is uploaded (`PUT /uploads/local/...` answers 204) but the file is discarded; the citizen tracking page and the admin detail show a placeholder instead of the photo | Local upload stub drops the body; admin detail only exposes `photoCount`, no photo URLs | Open: `backend/app/storage.py` / photo serialisation / admin incident-detail component belong to other workers |
| 3 | `GET /recycling/pickups` answers 404 in api mode (citizen web `/requests` and the recycling pages call it); CityCycle pickup path cannot be tested end to end | Backend on this branch has no recycling routes | Open: W3 (recycling backend). The requests page still renders |
| 4 | Incident ids are `INC-535` (no zero padding) while the contract examples say `INC-0042` | Id generator uses plain integers | Open, cosmetic |

## Not verified

- Voice input (speech-to-text and voice note upload): needs a microphone and `/ai/transcribe`; not exercised.
- Gemini photo triage: no key, keyword fallback only.
- Mobile app (`apps/mobile`): out of scope here.
- Map tiles and web fonts fail to load in the sandbox (no outbound access), unrelated to the app.
