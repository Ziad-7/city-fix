# Mobile citizen app review (2026-10-21)

Reviewer: independent code and design review of `apps/mobile` on branch `feat/mobile-citizen-app` (HEAD `91f211b`), against `docs/mobile/implementation-spec.md`, `docs/api-contract.md`, `docs/design/brand-book.md`, `docs/design/tokens.json` and the HTML mockups in `docs/design/screens/`.

## Summary verdict

**Not ready to merge yet. Fix the six major findings (R1–R6) first. A draft PR is fine now.**

The app is in good shape. All checks pass. Every spec route exists and every end-to-end behaviour works on mock data in the web preview. RTL mirroring is correct throughout the web build. The layouts follow the mockups closely, colours are token-exact and every text pair passes 4.5:1. The domain logic (priority, duplicates, triage, timeline, filters) is clean and unit-tested.

Before a PR, fix these:

- **For the demo (R1–R4):**
  - **R1:** the navigation stack after you submit a report is wrong. Pressing back from the tracking screen returns to the category picker (verified).
  - **R2:** the duplicate panel offers the citizen's **own** report. With the seed data, the only pothole near the default location is the demo user's FTC-1042, so the "نفس المشكلة، تابعها" demo joins the user to their own report.
  - **R3:** sign-in and the bulky-waste form have no keyboard handling, and the report form has none on Android. On a phone the keyboard will cover the buttons and fields.
  - **R4:** the spec's critical "خطر" priority badge is never shown anywhere.
- **For the Day 3–4 backend switch (R5, R6):**
  - **R5:** the API client calls `res.json()` on the `204` that `/auth/otp` returns, so sign-in fails at the first call.
  - **R6:** the bearer token is held only in memory. After an app restart the persisted session is "signed in" with no token, every call gets a 401, and nothing recovers from it.

Severity counts: **0 blocker · 6 major · 22 minor · 9 nit**, plus **4 web-only** items (1 minor, 3 nit).

### Check results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | pass (exit 0, no output) |
| `npx expo lint` | pass (exit 0, no warnings) |
| `npx jest` | pass: 14 suites, 61 tests, about 1 s |
| `npx expo export --platform web --output-dir dist-review` | pass. The export was served with an SPA fallback on :8099, then the folder was deleted and the server stopped |
| Browser console during the full Playwright walk-through | no errors or warnings |

Known issues reported by the implementers, re-verified:

| Reported issue | Status |
| --- | --- |
| ToggleRow/Switch broken on web | Confirmed. The track and thumb render detached and the thumb is teal. Web-only (W1). |
| `Alert.alert` no-op on web for the sign-in "English"/"خط أكبر" links | Confirmed: no dialog fired. Web-only (W2). |
| Shared `newReportSchema` contradicts "photo OR ≥10 chars" | Confirmed. B1's local `reportFormSchema` handles it correctly, but the shared schema is still wrong (R24). |
| Home "followed" state is screen-local | Confirmed (R26). |
| ETA tile duplicates "متوقع" | **Not reproduced.** The FTC-1042 tile reads "متوقع يخلص / بكرة" and new reports read "خلال ٣ أيام". The regex strip in `requests/[id].tsx` handles it. |
| `Placeholder` unused | Confirmed dead code (R31). |

## Findings

Sorted by severity. File paths are relative to `apps/mobile/src/` unless they start with `docs/` or `apps/`. Every finding was verified by reading the code, and by a screenshot where one is cited.

### Major

| ID | Severity | Area | File:line | Problem | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| R1 | major | Navigation | `app/report/new.tsx:114`, `app/report/success.tsx:24,59,61` | The flow tabs → category → new is `replace`d by success, which is `replace`d by detail. That leaves `report/category` in the stack. **Verified:** after submit → "تابع البلاغ", the header back button lands on `/report/category` (screenshot 18). "الرئيسية" and Android back on success `replace('/')`, which swaps success for a second `(tabs)` instance on top of category, so a back gesture from Home also returns to the category picker. | In `success.tsx`, use `router.dismissAll()` and then `router.push(\`/requests/${id}\`)` for "تابع البلاغ". Use `router.dismissAll()` alone for "الرئيسية" and for the BackHandler. `dismissAll` and `dismissTo` exist in the installed expo-router (`build/global-state/router.d.ts:58,63`). Alternatively, `router.dismissTo('/')` and then push. Add the same guard to `services/bulky-waste.tsx:56`, so back from the booking detail goes to the catalog or Home, not to a stale form. |
| R2 | major | Logic / demo | `logic/duplicates.ts:7-25`, `services/mock/triage-service.ts:11` | Duplicate detection does not exclude incidents the citizen already reported or follows. The seed links FTC-1042 (the demo user's report) to INC-501, which is 55 m from the default location. Reporting a pothole therefore shows "ممكن تكون اتبلّغت عنها قبل كده … بلّغ عنها ٧ مواطنين" for the user's own report (screenshot 13). After one new report, the next one offers to join the user's own FTC-1043, and success says "اتضمّيت للبلاغ الموجود، رقمه #FTC-1043" (screenshot 20). Followers are incremented for self-joins. | Give `findDuplicates` an `excludeIncidentIds` argument, or filter in the triage service with the user's reported and followed incident ids (`db.reports` by `reporterId` plus `db.following[userId]`). Thread `userId` through `TriageService.analyze` in mock mode; the backend does this server-side per the contract. In `new.tsx`, if the nearest match is the user's own incident, show "إنت مبلّغ عنها بالفعل" with a link to `/requests/{reportId}` instead of the join panel. |
| R3 | major | Device / keyboard | `app/sign-in.tsx:83`, `app/services/bulky-waste.tsx:64`, `app/report/new.tsx:132` | Sign-in and bulky-waste have no `KeyboardAvoidingView`. The footer button sits outside the ScrollView, so on iOS the keyboard covers "ابعتلي الكود"/"دخول"/"احجز الميعاد". `phone-pad` and `number-pad` have no return key on iOS, and the code field is `autoFocus` (line 172), so the user must find empty space to tap to dismiss the keyboard. Bulky's address and landmark inputs are at the bottom of the form and get covered. The report form's KAV has `behavior={undefined}` on Android. With SDK 58's mandatory edge-to-edge, Android no longer resizes the window for the IME, so the description, address and landmark fields and the footer can be hidden. Verify on an Android phone. | Put the KAV in the shared `Screen` (an `avoidKeyboard` prop) with `behavior="padding"` on both platforms, per Expo's keyboard-handling guide for edge-to-edge, or adopt `react-native-keyboard-controller`'s `KeyboardAwareScrollView` if it is in the SDK. Use it on sign-in, report/new and bulky-waste. On the code step, auto-submit when 6 digits are entered. |
| R4 | major | Spec / brand | `components/ui/StatusChip.tsx:6,30` (never used with `'critical'`); `components/map-screen/PinSheet.tsx:45`; `components/home/HomeParts.tsx` NearbyCard; `app/requests/[id].tsx:138` | The spec domain section requires "a separate `critical` priority badge (urgent)". The brand book says critical items "always carry a word or warning icon". `StatusChip status="critical"` exists but is rendered nowhere. Critical incidents (INC-502 open manhole, INC-507 exposed wire) show only "اتحوّل"/"وصل" on the map sheet, the Home nearby cards and the detail summary (screenshots 41, 42). | Render `<StatusChip status="critical" />` (label "خطر", `urgent-soft`/`urgent-deep`) next to the status chip whenever `incident.severity === 'critical'` or `priorityLevel(score) === 'critical'`. Do this in PinSheet, NearbyCard, RequestCard/UpdateRow (pass severity through `RequestItem`) and the request-detail summary. On native map pins, add an alert glyph for critical pins so the pin is not colour-only. |
| R5 | major | Contract / API client | `services/api/http.ts:31-32` | `http()` always calls `res.json()`. The contract returns `204` with no body for `POST /auth/otp`, so `requestCode` throws a SyntaxError and sign-in shows "معرفناش نبعت الكود" in API mode. Any other empty response hits the same failure. | If `res.status === 204` or `content-length` is 0, return `undefined as T`. Otherwise parse JSON. Add a jest test with a mocked `fetch` covering 204, 200 JSON and a 4xx with `{detail}`. |
| R6 | major | Contract / auth | `services/api/http.ts:1-5`, `services/api/index.ts:35-40`, `store/useSession.ts` (partialize), `domain/types.ts` `Session` | The token from `/auth/verify` is kept in a module variable only. `Session` has no `token`, and `useSession` persists `userId`/`phone` but not the token. After an app restart in API mode the user is "signed in" (protected routes pass), but every request goes out without `Authorization` and gets 401s. Nothing handles a 401: lists show error states forever and the user has to find "خروج". | Add `token` to `Session`, persist it in `useSession` (ideally with `expo-secure-store` if it is available in Expo Go, otherwise AsyncStorage), and call `setApiToken` on hydration (in `useSessionHydrated` or the root layout before `refreshAll`). In `http()`, on 401 call `signOutAll()`, or emit an event the root layout handles, so the app returns to `/sign-in`. |

### Minor

| ID | Severity | Area | File:line | Problem | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| R7 | minor | Logic | `services/mock/triage-service.ts:11`; `app/report/new.tsx` (`categoryId` vs `triage.duplicates`) | Duplicates are searched for `suggestion.options[0].categoryId`, not the category that will be submitted. If the citizen overrides the AI against strong keywords, so that the manual pick and the AI top option differ, the panel can link a report of category X to an incident of category Y. | Pass the effective `categoryId` (`manualCategory ?? paramCategory ?? top`) to `analyze` for the duplicate search, or compute duplicates in the screen with `services.incidents.findDuplicates(categoryId, place)` whenever `categoryId` or `place` changes. Hide the panel when `duplicate.categoryId !== categoryId`. |
| R8 | minor | State bug | `app/report/new.tsx:129,148` (and the `setErrors((e) => ({...e, x: undefined}))` calls) | `errorCount = Object.keys(errors).length` counts keys whose value is `undefined`. After the user fixes the description, the footer still says "راجع الحقول اللي متعلّمة بالأحمر." (screenshots 11–13). | `const errorCount = Object.values(errors).filter(Boolean).length`, or delete the key instead of setting it to `undefined`. |
| R9 | minor | Copy / logic | `logic/priority.ts:56-63` | `priorityReason` appends "خطورة عالية" regardless of level, which gives contradictory lines like "أولوية عادية — خطورة عالية" (score 28, screenshot 16). | Only add reason parts when the level is medium or higher. For low or regular, show the label alone or "أولوية عادية: لسه جديد". Add a test. |
| R10 | minor | Mock logic | `services/mock/incident-service.ts:44-53` | Linking a report (`linkToIncidentId`) always does `followers + 1`, even when the user already follows the incident via "أنا كمان" or already reported it. The contract says linking "makes the reporter a follower" and follow is idempotent. | Increment `followers` only if `!db.following[userId]?.includes(id)`. Always append to `linkedReportIds`. Add a test: follow, then link, gives +1 not +2. |
| R11 | minor | Contract / errors | `services/api/http.ts:31`; `app/report/new.tsx` submit catch; `app/services/bulky-waste.tsx:58` | `ApiError` messages are "HTTP 4xx". The contract's `{ "detail": "رسالة قصيرة" }` is never read, and screens show `e.message` to citizens, so they would see "HTTP 500". | Parse `detail` when present: `throw new ApiError(res.status, body?.detail ?? 'حصلت مشكلة، جرّب تاني')`. Map 5xx and network errors to a friendly Arabic line. |
| R12 | minor | RTL (device) | `components/ui/SelectField.tsx:28` | The governorate/district bottom sheet is a `Modal`. `CategoryPicker` deliberately sets `direction: 'rtl'` on its modal root (`components/report/AiSuggestion.tsx` styles.backdrop) because modal content may not inherit the root layout direction in Expo Go. SelectField does not, so on device the check mark and text alignment can render LTR on sign-in and profile. It looks correct on web (screenshot 48). | Add `direction: 'rtl'` to `styles.backdrop`. Also use `borderTopStartRadius`/`borderTopEndRadius`, and add a bottom safe-area inset to the sheet. |
| R13 | minor | Visual | `components/Hotlines.tsx:15` (`plain` tone), `UtilityHotlines` | The utility hotline buttons (١٢٥ مياه / ١٢١ كهربا / ١٧٥ صرف) are `surface` tiles inside a `surface` card, so they have no visible boundary and do not look tappable (screenshot 08). The mockup shows tinted pills. | Give `plain` a `paper` or `redSoft` background with `red-deep` text (as in Category.html), or a 1px `line` border. |
| R14 | minor | Duplication / consistency | `components/report/medal.ts:23-45` vs `components/profile/medal.ts:11-24` | There are two medal implementations with different progress maths. With 3 reports, success shows "٣ / ١٠" and a 30% bar, while the profile shows "فاضل ٧" with an empty (0%) bar (screenshots 20, 47). | Keep one module (`domain/medals.ts`) and use it from both screens. Choose one progress definition (suggested: `n / nextGoal`). Merge the two test files. |
| R15 | minor | Duplication / visual | `components/home/HomeParts.tsx:~120-143` (`UpdateRow`, `styles.thumb`) vs `components/requests/RequestCard.tsx`, `RequestThumb.tsx` | Home "آخر التحديثات" re-implements the request card. It ignores the report photo (always an icon), and service requests get a grey thumb on Home but a red-soft thumb in طلباتي (screenshot 06 vs 22). The spec says طلباتي should use the Home card style, so they should be the same component. | Use `RequestCard` in Home and delete `UpdateRow`. Move the hard-coded `#C9D1D4` into tokens. |
| R16 | minor | Copy / i18n | `app/(tabs)/index.tsx:140` "لسه ماعملتش أي طلب"; `app/(tabs)/requests.tsx:42` "لسه معندكش طلبات"; `app/report/new.tsx:188` "اكتب إيه اللي شايفه"; `components/report/AiSuggestion.tsx:123` "لسه ماحددتش النوع"; `components/report/ReportParts.tsx` LocationCard "لسه ماكتبتش العنوان"; `app/report/success.tsx:100,107` "قرّبت من لقب" and "وصلت لأعلى لقب"; `components/report/text.ts:21` "كن أول واحد"; `components/home/HomeParts.tsx:118` "بتتابع المشكلة دي"; `components/map-screen/PinSheet.tsx:68` "بتتابعه"; `services/mock/timeline.ts:38` "العربية في الطريق ليك" | These are masculine second-person forms that are not in the mockups. The brand book says to "address the citizen … gender-neutrally ('بلاغك', 'طلبك')". "كن" is also MSA, not Egyptian. Imperatives and "ليك" that appear in the mockups are accepted. | Rewrite with possessives or impersonal forms: "لسه مفيش طلبات"، "لسه مفيش طلبات هنا"، "اكتب المشكلة بالعامية، زي: …"، "النوع لسه مش متحدد"، "العنوان لسه مش مكتوب"، "فاضل بلاغ على لقب"، "ده أعلى لقب"، "أول واحد يقول أنا كمان"، "متابَع"، "العربية في الطريق". |
| R17 | minor | Logic / data quality | `components/report/location.ts:48`, `domain/locations.ts:61-64` | In fallback mode (GPS denied or timed out) the address field is **pre-filled** with a specific street ("شارع عباس العقاد، مدينة نصر") while the banner says "اكتب العنوان الصح تحت". Users can submit a wrong street without touching it (screenshot 10). | In fallback, set the address to `''` (keep the Nasr City coordinates) so the zod `min(3)` check forces the citizen to type an address. Alternatively use the district name ("مدينة نصر أول") rather than a street. |
| R18 | minor | Persistence race | `services/mock/db.ts:8-19` | `loadDb` caches only after `await AsyncStorage.getItem`. On first launch `refreshAll` fires `listMyReports`, `listIncidents` and `listMine` concurrently, so three seeds are built and saved and `cache` is overwritten. Lists can come from different seed objects (timestamps differ by milliseconds), and a later write mutates only the last one. | Memoise the promise: `let loading: Promise<MockDb> \| null`, then `return (loading ??= (async () => {...})())`. Reset it in `resetMockDb`. |
| R19 | minor | Accessibility | `components/ui/Chip.tsx:71` (minHeight 40), `components/ui/Button.tsx:69` (`sm` 40), `components/map-screen/PinSheet.tsx` close (36 + hitSlop 6) | Filter chips (requests, map, services) and small buttons ("أنا كمان", "حاول تاني") are 40 px tall with no `hitSlop`, below the brand book's 44 px minimum. | Raise `minHeight` to 44, or add `hitSlop={{ top: 4, bottom: 4 }}` to Chip and Button `sm`. |
| R20 | minor | Accessibility | `components/ui/TextField.tsx` (TextInput), `components/ui/SelectField.tsx` options | `TextInput` has no `accessibilityLabel`, so screen readers announce an unlabeled edit field. The visual label is a sibling Text. SelectField options lack `accessibilityState={{ selected }}`. | Pass `accessibilityLabel={label ?? placeholder}` and `accessibilityHint={error ?? helper}` to the TextInput. Set the selected state on options. |
| R21 | minor | Device / map | `components/map/IncidentMap.native.tsx:33` | `Marker title={p.title}` opens the native callout bubble on tap in addition to PinSheet. Markers have no `accessibilityLabel`. Custom SVG children with the default `tracksViewChanges` re-render every frame on Android, which is slow with many pins. | Drop `title` and add `accessibilityLabel={\`${title}، ${STATUS_LABEL_AR[status]}\`}`. Set `tracksViewChanges={false}` after the first render (a common pattern is a state flag that flips in `onLayout`, or re-keying when `selected` changes, as is already done). |
| R22 | minor | Device / fonts | `components/ui/StatusChip.tsx:44` | `fontWeight: '600'` on top of the `IBMPlexSansArabic_500Medium` family. On Android a weight on a single-file custom family triggers synthetic bold or a system-font fallback. The other components use the 600 family instead. | Remove `fontWeight` and set `fontFamily: fonts.sans600`. |
| R23 | minor | Async states | `app/requests/[id].tsx:~45-60` (loading/not-found), `:85-95` (`simulate`) | When the lists failed to load (`status === 'error'`), the detail screen shows "مش لاقيين الطلب ده" instead of an error with retry (spec behaviour 6). `simulate()` has `try/finally` with no `catch`: an unhandled rejection in API mode, where `simulateProgress` rejects, or if the mock throws. | Add an error branch with `StateMessage tone="error"` and `onAction={refreshAll}`. Add a `catch` to `simulate` that shows a caption. |
| R24 | minor | Domain schema | `domain/schemas.ts` `newReportSchema` | The shared schema still requires a photo **and** a 5-character description, which contradicts the product rule (photo **or** ≥10 characters). B1 works around it locally in `components/report/validation.ts`, but the backend team ports schemas from `domain/`. | Move the `superRefine` rule into `newReportSchema` and make `components/report/validation.ts` a thin wrapper. Update the contract notes. |
| R25 | minor | Docs | `apps/mobile/README.md` "Known stubs" and "Mock vs API mode" | It says "All screens except `sign-in` are placeholders ("قيد التنفيذ") until Phase B" (false). It lists `Placeholder`. It calls `/auth/*`, `/triage` and `/incidents/{id}/follow` "assumed" though `docs/api-contract.md` now defines them. It does not list the real stubs (voice note, notifications bell, English, خط أكبر, tree and garbage-schedule services, offline queue). | Rewrite "Known stubs" from the actual "قريبًا" items and point to `docs/api-contract.md`. Remove the Placeholder mention. |
| R26 | minor | State | `app/(tabs)/index.tsx:41`, `app/(tabs)/map.tsx:27` | The "followed" state (known issue) is screen-local in both Home and Map, so it resets on remount and the two screens disagree. The mock already stores `db.following[userId]`. | Add `followingIds: string[]` to `useReports`, loaded in `refresh` (add `listFollowing(userId)` to `IncidentService` in mock mode; in API mode return a per-user `isFollowing` flag on `Incident` or a `GET /incidents/following` endpoint, which needs a contract change). |
| R27 | minor | Brand / safety | `app/(tabs)/index.tsx` TILES (`/report/new?category=streetlight_out`) | The Home "إنارة الشوارع" tile opens the report form directly and skips the category screen's emergency box. The brand book says "Any screen where a citizen picks a problem shows the emergency numbers … first". The form's own category picker also has no hotlines. | Route the tile through `/report/category`, or show a compact `EmergencyRow` at the top of `CategoryPicker` and of `report/new` when it is entered directly. |
| R28 | minor | Copy honesty | `app/report/new.tsx` footer ("النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع"); `components/requests/timeline.ts` FUTURE_REPORT.resolved ("وتقدر تفتح البلاغ تاني") | The spec requires the offline line, but there is no offline queue: in API mode a failed submit just shows an error. Reopening a report does not exist either. The brand book says promises must be concrete. | Keep the copy but list both in README "Known stubs" for the backend phase, or implement a minimal queue (persist the `NewReportInput` on network failure and retry in `refreshAll`). |

### Nit

| ID | Severity | Area | File:line | Problem | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| R29 | nit | Visual | `components/ui/StatusChip.tsx:42` (`alignSelf: 'flex-start'`) | Inside row cards (`alignItems: 'center'`) the chip pins to the top instead of centring, unlike the mockup (screenshots 06, 22). | Remove `alignSelf` from the chip and let callers set it, for example in the detail summary column. |
| R30 | nit | RTL | `components/icon-shapes.ts:70` | `play` is in `DIRECTIONAL_ICONS`. Media controls do not mirror in RTL (platform conventions), and Report.html's play button points right. | Remove `'play'` from the set. |
| R31 | nit | Dead code | `components/ui/Placeholder.tsx` and `components/ui/index.ts:11`; `IncidentService.listMapPins/getReport/getIncident`, `ServiceRequestService.get`, `IncidentService.findDuplicates` (no screen calls them) | Unused exports. The API `findDuplicates` downloads all incidents to filter on the client. | Delete Placeholder. Either use `listMapPins` for the map (contract `GET /map/incidents`) or drop it. Keep `get*` only if the detail screen will fetch on a cache miss (recommended for deep links). |
| R32 | nit | Tokens | `components/ui/Button.tsx` (gold pressed `#BC8F09`), `components/home/HomeParts.tsx` and `components/requests/RequestThumb.tsx` (`#C9D1D4`), `components/report/ReportParts.tsx` (`#F1EEE8`, `#DCF1E1`, `#D4A20B`), `components/map/IncidentMap.native.tsx`, `app/report/success.tsx` (`#FFFFFF`) | Hard-coded colours outside `theme/tokens.ts`. | Add `goldPressed`, `mapGround` and similar tokens, or reuse existing ones (`statusResolvedBg`, `gold`, `surface`). |
| R33 | nit | Contract / mock ids | `services/mock/incident-service.ts:59` | New incident ids are `INC-511`. The contract format is `INC-0042` (zero-padded to 4). | `INC-${pad(db.counters.incident++)}`. |
| R34 | nit | Seed | `services/mock/seed.ts` SRV-2001 `day: iso(now + 24*HOUR).slice(0,10)` | Uses the UTC date and can land on Friday or Saturday, which contradicts "Sunday–Thursday". | Use `nextWorkingDays(1, new Date(now))[0]`. |
| R35 | nit | Visual fidelity | `app/sign-in.tsx` OTP channel ChoiceChips; `app/report/new.tsx` submit Button | The mockup shows radio dots on the SMS/WhatsApp choice, checkboxes on the bulky items and a leading arrow on "ابعت البلاغ". The app omits them. | Add an optional `radio` indicator to `ChoiceChip`, and `icon="arrow-back"` to the submit button (it mirrors to point left). |
| R36 | nit | Copy | `app/report/success.tsx:46,107`; `app/requests/[id].tsx` share text | "ده بلاغك رقم N في {district}" counts reports from all districts. Share texts mix "FixTheCity" and "فيكس ذا سيتي". | Say "ده بلاغك رقم N" without the district, or filter by district. Use "فيكس ذا سيتي" in Arabic shares. |
| R37 | nit | Lifecycle | `app/(tabs)/profile.tsx:42` | `setTimeout(() => setSaved(false), 2000)` is never cleared. | Store the timer in a ref and clear it on unmount or the next save. |

### Web-only (preview build; not expected on device)

| ID | Severity | Area | File:line | Problem | Suggested fix |
| --- | --- | --- | --- | --- | --- |
| W1 | minor (web) | Controls | `components/ui/ToggleRow.tsx` (`Switch`) | On react-native-web under `dir=rtl` the Switch track and thumb render apart and the thumb is teal (screenshots 01b, 13, 16, 45). Native Switch is fine, but the web preview is used for design checks. | Render a small custom `Pressable` switch on web (`Platform.OS === 'web'`): track `line`/`red`, white thumb, positioned with `start`. Alternatively wrap the Switch in a `direction: 'ltr'` View on web only. |
| W2 | nit (web) | Feedback | `app/sign-in.tsx:72,101,103` | `Alert.alert` does nothing on web, so the "English" and "خط أكبر" links appear dead. Verified: no dialog fired. Profile already falls back to `window.confirm`. | Reuse the inline gold notice pattern (as in `HomeHeader`) instead of `Alert` on every platform. |
| W3 | nit (web) | Layout | `app/(tabs)/map.tsx` `styles.empty` | The empty-filter pill is absolutely positioned at top 16 and overlaps the web list's banner text (screenshot 44). On native it floats over the map as intended. | On web, render the empty message inside the list instead of as an overlay. |
| W4 | nit (web) | Accessibility | `components/map/IncidentMap.web.tsx` rows | Pin rows are `Pressable` with no `accessibilityRole` or label. | Add `accessibilityRole="button"` and a label with the title and status. |

### Verify on a real phone (risks I could not confirm on web)

1. **RTL in Expo Go comes only from the root `direction: 'rtl'` style** (`app/_layout.tsx:84`). Expo Go ignores the `expo-localization` `forcesRTL` plugin. React Native documents the `direction` prop as `@platform ios` (`node_modules/react-native/Libraries/StyleSheet/StyleSheetTypes.js:645`), although Fabric's Yoga should apply it on Android too. First thing on an Android phone: confirm that the tab bar order, row mirroring and text alignment match the web screenshots.
2. **Horizontal chip rows** (`(tabs)/requests.tsx`, `components/map-screen/TopBar.tsx`). With `I18nManager.isRTL === false`, a horizontal ScrollView may start scrolled to the visual left. That would show the end of the map's 13 category chips and hide "كل الأنواع". If so, call `scrollToEnd({ animated: false })` on content-size change, or wrap the rows instead of scrolling.
3. **Image picker:** `takePhoto` and `pickFromGallery` handle cancel, denial and failure without throwing. The local `file://` cache URIs are persisted in the mock DB and may disappear after OS cache cleanup, which shows a blank thumb. This is acceptable for the demo.
4. **Fonts:** the splash is held until `useFonts` resolves or errors. This is fine.

## Spec coverage

| Spec item | Status | Notes |
| --- | --- | --- |
| Route `sign-in` (+20, OTP via SMS/WhatsApp mock, governorate/district, privacy note, data-saver toggle) | done | Screenshots 01–03. Sign-in "English" and "خط أكبر" links are web-dead (W2). |
| Route `(tabs)/index` Home | done | Greeting is in Ruqaa with صباح/مساء الفل. Tiles, nearby with "أنا كمان", latest updates and emergency row are all present. |
| Route `report/category` | done | Emergency box, 12 categories with "خطر" tags, voice entry, utility hotlines and gas line. R13 is visual. |
| Route `report/new` | done | Photo slots, AI card, voice stub "قريبًا", location card with fallback, landmark, privacy toggles, duplicate panel and offline line. Issues: R2, R3, R7, R8, R17. |
| Route `report/success` | done | "تسلم إيدك!", next steps, medal. R1 (navigation), R14. |
| Route `requests/[id]` | done | Summary, info tiles, priority strip, timeline, WhatsApp toggle, share, followers, dev simulate. R23. |
| Route `services/index` + `services/bulky-waste` | done | Catalog with "قريبًا" items; booking form with zod validation. |
| Route `(tabs)/requests` | done | Merged list with filters, loading, empty and error states. |
| Route `(tabs)/map` | done (native unverified) | Status pins, status and category filters, legend, pin sheet. Web shows a list. |
| Route `(tabs)/profile` | done | Name, phone (masked), area, toggles, stats with medal, language "قريبًا", emergency numbers, sign-out with confirm. |
| Tab bar: الرئيسية · الخريطة · [gold FAB] · طلباتي · حسابي | done | |
| Root: fonts + splash + providers + redirect when no session | done | `Stack.Protected` guards. Sign-out returns to `/sign-in` (verified). |
| B1. Valid Egyptian mobile; invalid rejected inline; code step shows الكود التجريبي; area saved; Home | done | Screenshot 02 shows the inline error. |
| B2. Home → Report → category → photo (camera or gallery, graceful denial) → AI top-3 editable → description + voice stub → GPS or fallback + manual address + landmark → duplicate panel within 250 m → join increments followers → submit → Success → top of طلباتي with وصل | partial | All steps work (screenshots 07–22). The duplicate panel includes the user's own incidents (R2) and can mismatch category (R7). Back navigation after success is wrong (R1). |
| B3. Detail timeline + dev-only simulate progress | done | `__DEV__` button (hidden in the production web export, as intended). |
| B4. CityServe catalog → bulky booking (items, day + slot, 4 payments, fee "[حسب لائحة الحي]") → appears in طلباتي | done | Screenshots 34–39. |
| B5. Map seed incidents around Nasr City, status-coloured pins, filter chips by status | done (web list; native code reviewed) | Critical pins are colour-only (R4). |
| B6. Forms validate with zod; every async screen has loading, empty, error | partial | zod is used on sign-in, report and bulky. The detail screen has no error state (R23). Services is static. |
| B7. Offline-friendly copy on report footer | done (copy only) | No queue behind it (R28). |
| Domain: statuses with Arabic labels and chip colours; separate `critical` badge | partial | Labels and colours are correct. The critical badge is never rendered (R4). |
| Copy: Egyptian Arabic, gender-neutral, no religious phrases or symbols | partial | No religious content or emoji found (grep). Several masculine forms remain (R16). |
| Arabic-Indic digits for citizen numbers; IDs and phones Latin and isolated | done | `isolateLtr` is used for `#FTC-…`, `#SRV-…` and phones. Relative times, distances, dates and scores are Arabic-Indic. |
| Ruqaa only for slogans and greetings | done | Sign-in slogan, Home greeting, "تسلم إيدك!", medal titles. |
| Hotlines as `tel:` (122/123/180/129/125/121/175) | done | `Linking.openURL` with a catch. |
| Stubs labelled "قريبًا" and listed in README | partial | They are labelled in the UI, but the README list is stale (R25). |
| Definition of done: tsc / lint / jest / web export pass; no TODOs | done | `grep TODO` finds nothing. |

## Contract mismatches (`src/services/api/*`, `src/domain/types.ts` vs `docs/api-contract.md`)

1. **`POST /auth/otp` returns 204** but `http()` always parses JSON, so it throws (R5).
2. **`POST /auth/verify` → `{ userId, phone, name?, token }`**: the `Session` type has no `token`. The token is kept in memory only, never persisted or restored, and nothing handles a 401 (R6).
3. **Error shape `{ detail }`** is ignored. `ApiError.message` is "HTTP nnn", and that string reaches the UI (R11).
4. **`GET /reports/{id}`, `GET /incidents/{id}`, `GET /service-requests/{id}`**: the interface types return `T | null`, but the client throws `ApiError(404)`. The screens never call these, and detail views read only the cached lists, so a deep link to an item that is not in the cache shows "مش لاقيين" instead of fetching it (R31).
5. **`GET /map/incidents` (MapPin[])** is implemented as `listMapPins` but unused. The map consumes full `Incident[]` from `GET /incidents`. This works, but the backend's lighter pin endpoint and its `status`/`categoryId`/`bbox` filters go unused.
6. **Duplicates:** the contract says duplicates come from `POST /triage` (DB-backed). The API client's extra `findDuplicates` downloads `GET /incidents` and filters on the client. It is unused by screens, so remove it. The contract also does not say that triage duplicates should exclude the caller's own or followed incidents. Add that, because the app needs it (R2).
7. **`POST /incidents/{id}/follow`:** the contract says it is idempotent per user, while the Conventions section cites `409` "already following". The app treats any non-2xx as failure and would show "معرفناش نسجّل متابعتك" on a 409. Pick one in the contract (recommended: 200 with the unchanged `Incident`). There is also no way for the client to learn which incidents it already follows (R26). Propose `Incident.isFollowing?: boolean` for the authenticated caller.
8. **`NewReportInput.photoUris` / `POST /triage.photoUri`:** the app sends local `file://` URIs. The contract's `/uploads/sign` flow (marked "proposed") is not implemented. The backend cannot read these URIs, so this must land before API mode.
9. **Linking semantics (mock):** linking a report to an incident the user already follows increments `followers` again (R10). The contract says linking makes the reporter a follower idempotently.
10. **ID format (mock):** new incidents are `INC-511`, not the contract's zero-padded `INC-0042` (R33).
11. **Matching as specified:** enum values (`IncidentStatus`, `Severity`, `CategoryId` ×12, `ServiceType`, `PaymentMethod`, `SlotId`, `OtpChannel`); `Place`, `TimelineEntry`, `PriorityFactor`, `Priority`, `Incident`, `Report`, `NewReportInput`, `ServiceRequest`, `NewServiceRequestInput`, `MapPin`, `DuplicateMatch`, `TriageSuggestion`; camelCase keys; endpoint paths and methods; `Accept-Language: ar`; `Authorization: Bearer`; the priority formula in `logic/priority.ts`.

## Screenshots

Screenshots were taken from the web export at 390×844 with deviceScaleFactor 2. Mockups were rendered for comparison. All files are under `/tmp/claude-0/-home-claude/ea209f5e-0b2e-58b1-a3f6-d7cf9a3fe6ba/scratchpad/screens-review/` (mockups under `…/scratchpad/mock/`).

| File | Note |
| --- | --- |
| `01-signin-phone.png` | Matches Login.html. The slogan is in Ruqaa. The radio dots on the SMS/WhatsApp chips are missing (R35). |
| `01b-signin-phone-bottom.png` | Data-saver Switch is broken on web (W1). |
| `02-signin-invalid.png` | Inline phone error; Latin example isolated. |
| `03-signin-code.png` | Code step with the gold "الكود التجريبي" note. |
| `04-home-top.png` / `05-home-mid.png` / `06-home-bottom.png` | Matches Main.html. Status chips are top-aligned (R29). The service thumb is grey here but red-soft in طلباتي (R15). |
| `07-category-top.png` / `08-category-bottom.png` | Matches Category.html. Utility hotline tiles are invisible on the white card (R13). |
| `09-report-empty.png` | Category row before the AI runs; voice "قريبًا"; static map. |
| `10-report-validation.png` | Inline errors. The fallback address is pre-filled (R17). |
| `11-report-ai.png` | AI card with top-3 and bars filling from the right. The stale "راجع الحقول" banner stays after the fix (R8). |
| `12-report-mid.png` / `13-report-bottom-duplicate.png` | The duplicate panel points at the user's **own** FTC-1042 incident (R2). Switches are broken on web (W1). |
| `14-success-top.png` / `15-success-bottom.png` | Matches Success.html. Medal progress shows 2/3. |
| `16-detail-new-report-top.png` / `17-detail-new-report-bottom.png` | New report is وصل with a 5-step timeline. Priority reads "أولوية عادية — خطورة عالية" (R9). |
| `18-after-back-from-detail.png` | **Back from detail lands on the category picker** (R1). URL `/report/category`. |
| `19-report2-bottom.png` | Second report: the duplicate is now the user's own FTC-1043 (R2). |
| `20-success-joined.png` | "اتضمّيت للبلاغ الموجود، رقمه #FTC-1043", the user's own report (R2). |
| `21-home-after-success.png` | Home after "الرئيسية". |
| `22-requests.png` / `23-requests-services.png` / `24-requests-fixed-empty.png` | The new reports are at the top with وصل. Filter-empty state shown. |
| `25/26/27-track-FTC-1042-*.png` | Matches Track.html. The ETA tile reads "بكرة" (no duplicated "متوقع"). There is no "خطر" badge for critical items (R4). |
| `28/29-track-SRV-2001-*.png` | Service detail with booking details and the service timeline. |
| `30-track-not-found.png` | Not-found state. |
| `31-services.png` / `32-services-tree-soon.png` / `33-services-empty.png` | Catalog, "قريبًا" notice, empty search. |
| `34-bulky-top.png` / `35-bulky-errors-top.png` / `36-bulky-errors-bottom.png` / `37-bulky-filled.png` | Booking form (Sunday–Thursday days), validation errors, filled state. |
| `38-bulky-booked-detail.png` / `39-requests-after-booking.png` | SRV-2002 is created and listed first. |
| `40-map.png` / `41-map-pin-selected.png` / `42-map-pin-expanded.png` | Web list stand-in. Pin sheet and expanded details. A critical manhole shows no "خطر" (R4). |
| `43-map-filter-resolved.png` / `44-map-filter-empty.png` | Status and category filters. The empty pill overlaps the banner on web (W3). |
| `45/46/47-profile-*.png` | Profile. Medal progress is inconsistent with success (R14). Switches broken on web (W1). |
| `48-profile-select-sheet.png` | District sheet; RTL is correct on web (see R12 for device). |
| `49-report-no-category.png` / `50-report-category-picker.png` | Report without a category; category picker sheet. |
| `51-after-signout.png` | Sign-out returns to sign-in. |
