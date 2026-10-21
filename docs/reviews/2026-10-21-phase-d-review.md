# Mobile Phase D review (2026-10-21)

Reviewer: review-and-fix pass of `apps/mobile` on branch `feat/mobile-phase-d` (HEAD `7d8e344`, changes left uncommitted), diffed against `main`. Phase D was built in three parallel tracks and merged by hand:

- **D1:** voice notes, map pin picker, emergency flag.
- **D2:** uploads, offline outbox, SecureStore token, on-demand detail, pull-to-refresh.
- **D3:** notifications, larger text, tree booking, garbage schedule, reopen.

The review focused on the seams between the tracks. It checked against `docs/api-contract.md`, `docs/design/brand-book.md` (gender-neutral Egyptian Arabic, flag palette, Arabic-Indic digits, no religious content) and Expo Go / web constraints.

## Verdict

**Ready to merge after this pass.** Each track was solid on its own, and the tests the tracks shipped all passed. The bugs sat where the tracks meet:

- the offline queue running alongside list refreshes and sign-out
- voice notes going through the submit pipeline
- reopen generating a notification
- the slow GPS fix racing the new pin picker

All of these are fixed, with regression tests where a unit test can reach them. Nothing in Phase D crashes in Expo Go:

- expo-notifications uses local notifications only (no push token calls, which are the only APIs that throw in Expo Go on Android).
- expo-audio, react-native-maps and SecureStore are kept off web through `.native`/`.web` files or a platform branch.

Severity counts: **0 blocker · 6 major · 9 minor · 4 nit**. Everything is fixed except the items marked *open*.

### Check results (after fixes)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass, no warnings |
| `npm test` | pass: 30 suites, 172 tests (was 27 / 158; 3 new suites, 14 new tests) |
| `npx expo export --platform web` | builds |
| Playwright (Chromium, 390 px, signed-in demo user) | `/`, `/notifications`, `/requests`, `/requests/FTC-1042`, `/report/new`, `/services/tree`, `/services/garbage-schedule` and `/profile` (the last two with "خط أكبر" on) all render. No page errors, no console errors, no horizontal overflow. |

I ran the new seam tests against the unfixed code to confirm they catch the bugs: 6 of the 9 fail there.

## Findings

| ID | Severity | File | Issue | Resolution |
| --- | --- | --- | --- | --- |
| P1 | major | `store/useReports.ts`, `app/(tabs)/requests.tsx` | **Refresh vs. outbox race (D2 × D2).** On sign-in, `refreshAll()` and the outbox flush start together, and pull-to-refresh ran `Promise.all([flush, refresh])`. If the list GET left before the queued POST landed, `refresh()` replaced `reports` with the older server list. The report that had just been sent disappeared from طلباتي and from Home until the next refresh. | `ingestSubmitted` records the report as *unconfirmed*. `refresh()` merges unconfirmed reports (and their incident and follow) until a fetched list contains them. `reset()` clears them. Pull-to-refresh now flushes first, then refreshes. Test: `phase-d-seams` "a refresh that started before the POST…". |
| P2 | major | `store/outboxFlush.ts` | **Queue sent with the wrong account.** A flush that was in progress kept going after sign-out or sign-in as another user. In API mode the remaining items of user A would be POSTed with user B's token, and the delivered report was ingested into B's lists. | The loop re-checks the session user before each item. Delivered reports are only ingested when the session user is still the item's owner. Test: "stops when the user signs out mid-flush…". |
| P3 | major | `store/outboxFlush.ts`, `components/requests/QueuedCard.tsx` | **"ابعت دلوقتي" falsely failed.** While any flush was running (NetInfo, AppState, retry timer), `flushOutbox({ only })` returned `{ sent: 0 }` at once. The card then said "لسه مقدرناش نبعته" even though the item was being sent. A forced flush (connectivity back) arriving behind a backoff-respecting one was also dropped. | One in-flight promise replaces the boolean. General flushes join it. `only` calls, and forced calls behind a non-forced flush, wait for it and then run again for whatever is still queued. Test: "'ابعت دلوقتي' during a running flush…" plus "concurrent triggers send once". |
| P4 | major | `app/report/new.tsx`, `store/actions.ts` | **Voice note lost (D1 × D2).** The form sent `voiceNoteUri: voicePath`, and `voicePath` is only set after upload *and* transcription. A report sent while "بنكتب كلامك..." was showing went out without its voice note. So did any report whose voice upload failed (offline at record time, or a server hiccup), and an offline-queued report never got it back. D1's upload also used `audio/m4a` while D2's pipeline signs `audio/mp4` for the same file. | The form keeps the local clip URI and sends `voicePath ?? voiceLocal`. A local URI is uploaded by `sendReport`/the outbox (`needsUpload`). A storage path is not uploaded again, so there is no double upload once the path is known. `uploadAndTranscribeVoiceNote` gets an `onUploaded` callback, so the path is known as soon as the upload finishes (before transcription), and it uses `voiceContentType()` like the pipeline. Remaining edge (accepted): sending in the second or so between stop and upload completion uploads the clip twice. Tests: "voice note upload" (2). |
| P5 | major | `store/useNotifications.ts`, `store/actions.ts`, `components/requests/ReopenCard.tsx` | **Reopen notified the citizen about their own tap (D3 × D3).** Reopening flips the incident from `resolved` to `received`. The status diff then raised "بلاغك … اتفتح تاني" plus an OS banner, on top of the inline confirmation. | `expectOwnChange(ids, status)` makes the next sync record that change as the baseline without notifying. The new `reopenReport()` action wraps `reopenIncident` with it and always releases it. Later status changes (staff, simulate) notify as usual. Tests: reopen (2). The other suspects (first load, sign-in of another user, outbox ingest) were already fine: unseen ids only set the baseline, and `signOutAll` resets `known`. There is a test for outbox ingest. |
| P6 | major | `components/report/location.ts` | **Late GPS fix threw the pin back (D1 × existing).** The first `getCurrentPositionAsync` can take up to 10 s. If the citizen moved the pin first, the late fix overwrote the moved pin and its geocoded address. "استخدم موقعي" also didn't cancel a pin geocode still in flight, which could then overwrite the GPS address. | A fix only applies if the pin has not moved since the request started (it reuses `moveTicket`). `locate()` bumps the ticket. The timeout timer is now cleared (it used to linger 10 s). *No unit test:* the hook needs a renderer that the project doesn't have. |
| P7 | minor | `services/api/index.ts` | **On-demand detail in API mode:** `GET /reports/{id}` returns 404 when missing and 403 when it belongs to someone else (contract). `http()` throws on both, so a deep link or notification tap to a missing id showed "مقدرناش نحمّل الطلب / جرّب تاني" instead of "مش لاقيين الطلب ده". | `getReport`, `getIncident` and `serviceRequests.get` map 404/403 to `null`. Test: `api-by-id.test.ts`. |
| P8 | minor | `store/secureSessionStorage.ts` | zustand persists the whole session on every change, so each `setNotice`/pref change re-wrote the Keystore. Writes were not ordered: a delete on sign-out could race an earlier set. If the delete failed, the next start put a stale token into a signed-out session. | Writes are serialized, SecureStore is only touched when the token changes, and a stored token is only restored for a session that has a `userId`. Test: `secure-storage.test.ts` (3). |
| P9 | minor | `app/services/tree.tsx` | **Tree photo through uploads (D2 × D3):** it uploaded the raw picker image (no 1600 px resize). A retry after a failed booking uploaded it again, and a double tap could book twice. | Uses `compressImage` + `PHOTO_CONTENT_TYPE` like report photos, remembers the uploaded path for retries, and ignores taps while busy. |
| P10 | minor | `components/report/VoiceNote.native.tsx` | A double tap on the mic could prepare two recordings. Leaving the screen mid-recording left the audio session in recording mode (on iOS, playback stays on the earpiece). | `starting`/recording refs guard `start()`. Unmount stops the recorder (best effort) and resets the audio mode. |
| P11 | minor | `notifications/os.ts` | A notification tap that *launched* the app from killed state was lost: only the listener was used. | Also reads `getLastNotificationResponse()` once (then clears it) and opens it after the navigator mounts. |
| P12 | minor | copy: `domain/notifications.ts`, `app/report/success.tsx`, `app/services/tree.tsx`, `components/Hotlines.tsx`, `components/report/VoiceNote.native.tsx`, `services/mock/timeline.ts` | Masculine second-person forms (brand book: address gender-neutrally; imperatives are accepted): "شكرًا إنك بلّغت", "شكرًا إنك استخدمت الخدمة", "من غير ما تعمل حاجة", "الميعاد اللي تختاره", "بعد ما تتصل", "عدّل زي ما تحب", and the pre-existing "شكرًا إنك بتصلّح مدينتك" and timeline "شكرًا إنك بلّغت". | "شكرًا على بلاغك", "شكرًا لاستخدام الخدمة", "من غير أي خطوة تانية", "الميعاد المختار", "بعد المكالمة", "عدّل فيه براحتك", "شكرًا على مشاركتك في تصليح مدينتك". No إنت/إنتي anywhere. No religious content. Citizen digits are Arabic-Indic (ids and phone numbers stay LTR as before). |
| P13 | minor | `docs/api-contract.md` | The app relies on things the contract did not say: optional `payment` and `details.workType`/`details.photoUris` for tree bookings, voice-note content types, upload paths in `voiceNoteUri`, `fri` in the garbage schedule days, how 404/403 by-id and `/ai/transcribe` failures are handled. The uploads section still said "the app currently sends local photo URIs". | Added, all marked *proposed* where new: `ServiceRequest.details` fields, a free-booking rule, upload content types and retry/drop semantics, the transcribe flow, `fri`. |
| P14 | minor | `apps/mobile/README.md` | "Known stubs" still listed voice notes, the bell, larger text, tree booking, the offline queue, uploads and on-demand detail as stubs. The maps-key note only mentioned the map tab. | Rewritten as "Real since Phase D" / "Still stubbed" (English, OTP, keyword triage, canned transcription, no push, static garbage data, proposed endpoints, local-URI caveat). The maps key is now also needed by the report and tree forms. Folder map and API endpoint list updated. |
| P15 | minor | `app/(tabs)/profile.tsx` | On web, turning "إشعارات التطبيق" on showed "الإذن مش متاح…" because the web stub always returns "not granted". | No OS permission request on web (in-app centre only). |
| N1 | nit | `notifications/os.ts`, `components/report/LocationPicker.web.tsx` | Raw `#C8102E` / `#FFFFFF` instead of tokens. | `colors.red` / `colors.surface`. (The `rgba(22,22,22,0.72)` scrim in the tree screen copies the existing PhotoSlots pattern; left as is.) |
| N2 | nit | `app/requests/[id].tsx` | `ReopenCard` keeps its "done" state per mount. | Keyed by incident id. |
| N3 | nit | `services/mock/incident-service.ts` | *Open (mock only).* `getReport(id)` returns any user's report, so a deep link to someone else's FTC id in mock mode adds it to "my reports". The API is protected by the contract's 403. | Left. |
| N4 | nit | `components/report/AiSuggestion.tsx` | *Open.* The emergency alert depends on a triage answer. If triage errors, emergency words in the text show no hotlines (the category screen's EmergencyBox still does). | Left. Could run `detectEmergency` locally as a fallback. |

## Seams checked with no issue

- **Voice upload double-up:** D1 uploads in the action. D2's `prepareReportInput` skips anything that is not a local URI, so a storage path is never uploaded twice, in mock or API mode.
- **Queued reports with voice notes:** the outbox keeps the prepared input after a failed POST, so files are not uploaded again. With P4 a never-uploaded clip is queued as a local URI and uploaded on flush.
- **Notifications:**
  - No notification on first load or on sign-in of another user: `signOutAll` resets `known`, and unseen ids only set the baseline.
  - Waits for hydration of the persisted store.
  - Listeners (store subscriptions, tap listener, NetInfo, AppState, retry timer) are all removed on sign-out.
- **Large text:** new screens use `AppText`. The tab bar, bell badge and weekday pills are `fixedSize` and wrap. Checked at ×1.15 on web.
- **`requests/[id]`:** D2's on-demand loading and D3's `ReopenCard` coexist. Reopen only shows for a resolved incident and updates the store, so the status chip and timeline update in place.
- **Accessibility:** every new pressable has a role and an Arabic label: voice buttons, map, pin, bell with unread count, notification rows, mark-all, reopen, queued "ابعت دلوقتي", tree photo buttons, the remove-photo ✕, the garbage "بلّغ" button.

## Not verified here

On-device behaviour:

- recording and playback
- the native map picker
- OS notification banners and taps (warm and cold)
- the Android notification channel
- SecureStore migration on a real Keystore

These need an Expo Go / APK pass. API mode is still untested against a real backend.
