# Citizen website review (2026-10-21)

Reviewer: independent code and design review of `apps/web` on `main` (HEAD `b1c97aa`, after PR #11 and the PR #12 re-sync). Compared against `docs/team/citizen-web-portal.md`, `docs/api-contract.md`, `docs/design/` (identity, `cityfix.css`, `tokens.json`, `screens/web/*.html`), ADR 0003 (rename to CityFix) and the product rules. This is a review only: no source files were changed.

## Verdict

**The website works and is close to the mockups, but it needs one fix round before the demo.** The 7 major findings (W1–W7) come first.

All checks pass. Every page renders at 1440 px and 390 px with no horizontal scroll. Colours are token-exact, there are no gradients and RTL is correct. axe finds only three small issues. Status chips always carry text. The AI card is labelled "اقتراح الذكاء الاصطناعي". The contract match is good because the service layer is the shared mobile code.

The main problems:

- **W1:** the old name and logo are still on every page (header logo "فيكس ذا سيتي", footer "FixTheCity", tab title, share texts).
- **W2:** two of the three service cards ("تقليم أو إزالة شجرة", "مواعيد جمع القمامة") show "احجز دلوقتي" and lead to a **404**. The shared catalog now has routes for the mobile screens the website never built.
- **W3:** the shared outbox has **no cross-tab safety** on the web. Two open tabs overwrite each other's queue, and a saved offline report is lost (reproduced). The old web outbox used Web Locks; PR #12 removed it.
- **W4:** keyboard users can't pick every option in the bulky-waste booking. The arrow keys change the choice but leave focus behind, and the day picker has no arrow keys at all (verified).
- **W5–W7:** map pins show status by colour only, the "reopen" action that the timeline promises is missing, and on phones the photo picker can't open the gallery.

Severity counts: **0 blocker · 7 major · 13 minor · 11 nit**. 3 findings involve shared files (fix in `apps/mobile/src` first).

## Check results

Run in `apps/web` after `npm ci`.

| Check | Result |
| --- | --- |
| `npm run check:shared` | pass: "shared code matches apps/mobile/src". The script has a gap, though: it misses new mobile helpers (W17). |
| `npm run typecheck` | pass (no output) |
| `npm run lint` | pass (no output) |
| `npm test` (Vitest) | pass: 30 files, 167 tests |
| `NEXT_PUBLIC_API_MODE=mock npm run build` | pass: 12 routes. Google Fonts were mocked with `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` (scratchpad `font-mock.js`) because the sandbox blocks them. |
| `npm run test:e2e` (Playwright, run against `next start`) | 21/22 passed. `report-extras.spec.ts:23` (offline report, desktop) failed once in the full run and then passed 3/3 alone, so it is flaky (W19). |
| `npm audit --omit=dev` | 1 high, 1 moderate: `postcss` inside `next` (build-time only). The fix is a major Next upgrade (nit W31). |
| axe-core (WCAG 2 A/AA + best practice), 11 pages × 2 widths | 3 issues: progressbar without a name (profile), no `<main>` on `/map`, heading order on `/services` (W13). No contrast failures. |
| Network during the walk-through | 404 on `/services/tree` and `/services/garbage-schedule` (W2). OSM tiles and Nominatim are blocked in the sandbox, so maps show no tiles in the screenshots (not a defect). |

Screenshots are in `/tmp/claude-0/-home-claude/ea209f5e-0b2e-58b1-a3f6-d7cf9a3fe6ba/scratchpad/web-review/`:

- `web_<page>_<1440|390>.png`: the website.
- `design_<Screen>_<1440|390>.png`: the mockups.
- `cmp_<page>_<width>.png`: side by side, with the mockup on the left and the website on the right.

## Design match (summary)

| Page | Match | Mismatches that matter |
| --- | --- | --- |
| Sign-in | Layout, card, steps, OTP boxes, toggles and copy match | Old lockup "فيكس ذا سيتي" in the hero pill (W1). The hero slogan uses Aref Ruqaa where the mockup uses Readex display (nit W25). |
| Home | Hero with skyline, tiles, "حوالين بيتك" with "أنا كمان", map card, updates and SOS all match | Old header logo and footer (W1). The tree and garbage tiles go to `/services` (W2). |
| Category | Matches (emergency box, voice card, 12 tiles with "خطر", utility card) | none |
| Report | Matches: photo drop zone, AI card labelled as a suggestion, voice row, location card, privacy, sticky summary, duplicate and own-report panels | Phone photo picker (W7) |
| Success | Matches | Old mark asset path (W1) |
| Requests | Matches | none |
| Track | Matches: summary, priority strip with reasons, RTL timeline, share | No reopen card for resolved reports (W6). The tree booking details use the bulky labels (W12). |
| Services | Cards and filters match. Bulky booking is on its own route (fine). | The mockup shows "قريبًا" for non-bookable services. The website shows "احجز دلوقتي" on all three and two of them 404 (W2). |
| Map | Side panel, filters, legend, list and pin card match | Pins are colour-only dots; the mockup gives each status its own glyph (W5). |
| Profile | Matches | Footer "FixTheCity" (W1) |

## Findings

Severity: blocker / major / minor / nit. "Shared?" = yes means the file is a checked copy of `apps/mobile/src`: fix it there first and copy it again. Paths are relative to `apps/web/` unless stated.

| ID | Sev | File:line | Issue | Fix | Shared? |
| --- | --- | --- | --- | --- | --- |
| W1 | major | `src/ui/brand.tsx:5,9`; `src/ui/Shell.tsx:27,75`; `src/app/layout.tsx:10,12`; `src/app/sign-in/SignIn.tsx:126,127`; `src/app/(portal)/profile/page.tsx:104`; `src/app/(portal)/report/success/page.tsx:36,43`; `src/app/(portal)/requests/[id]/page.tsx:70,71`; `src/ui/QueuedNotice.tsx:17`; `public/brand/fixthecity-*.svg`; `README.md:1` | The old name is visible everywhere: the header lockup and its alt text, aria-labels, `<title>` ("فيكس ذا سيتي"), favicon, footer and profile "FixTheCity · النسخة ١٫٠", share messages "على فيكس ذا سيتي", and the sign-in pill. ADR 0003: everything people see uses CityFix / سيتي فيكس. | Copy `docs/design/assets/cityfix-lockup-ar.svg`, `cityfix-lockup-en.svg` and `cityfix-mark.svg` into `public/brand/` and delete the three `fixthecity-*.svg`. Point every `src` at `/brand/cityfix-*.svg`. Replace "فيكس ذا سيتي" with "سيتي فيكس" and "FixTheCity" with "CityFix" in all the lines listed. Retitle the README "CityFix — citizen website". Keep `package.json` `name` (technical ID). | no |
| W2 | major | `src/app/(portal)/services/page.tsx:32-38`; `src/app/(portal)/page.tsx:25,29` | `SERVICES` (shared) now gives `route: '/services/tree'` and `'/services/garbage-schedule'` for the mobile screens added in PR #10. The website has no such routes, so the cards show "احجز دلوقتي" and open a 404. Next also prefetches both. The home tiles "صيانة الشجر" and "مواعيد جمع القمامة" only go to `/services`. | Build `src/app/(portal)/services/tree/page.tsx` and `services/garbage-schedule/page.tsx` by porting `apps/mobile/src/app/services/tree.tsx` and `garbage-schedule.tsx` with the same web components as `bulky-waste/page.tsx`. First copy the pure helper `apps/mobile/src/components/services/tree.ts` and `tree.test.ts` to `src/shared/components/services/`. For the garbage card, use a CTA label that fits a schedule (e.g. "شوف المواعيد", not "احجز"). Point the home tiles at the new routes. If the pages can't land now, render "قريبًا" for any `route` that isn't in a web-side `BUILT_ROUTES` set. | no (catalog is correct) |
| W3 | major | `src/store/useOutboxSync.ts:11-29`, `src/ui/OutboxBanner.tsx:23`, shared `src/store/outboxFlush.ts`, `src/store/useOutbox.ts` | Multi-tab data loss (reproduced, `web-review/tabs.js`). Tab A queues report 1 offline and tab B queues report 2. B's persist write replaces the stored queue with only its own items, so report 1 is gone from storage. Close A, come back online, and only report 2 is sent. The reverse race is also possible: two tabs that both hydrated the same item flush it twice (duplicate report). zustand `persist` doesn't sync across tabs, and the removed `lib/outbox.ts` serialised sends with Web Locks. | (1) In the mobile app, add an injectable lock to `outboxFlush.ts`, e.g. `setOutboxRunner(fn: <T>(job: () => Promise<T>) => Promise<T>)` (default: run directly). Wrap `runFlush` with it, including the backoff-timer path. Copy it here. (2) On the web, register `navigator.locks?.request('ftc-outbox', job)` as the runner, and inside the job call `await useOutbox.persist.rehydrate()` before reading items. (3) In `useOutboxSync.ts`, add `window.addEventListener('storage', e => { if (e.key === 'ftc.outbox.v1') void useOutbox.persist.rehydrate(); })` so a tab never writes a stale queue. Rehydrate before `enqueue` too (call it in `submitReport`'s queue path, or in a web wrapper before `submitReport`). Add a two-page Playwright test (W19). | yes (runner hook) + web wiring |
| W4 | major | `src/ui/controls.tsx:50-53,67-77`; `src/app/(portal)/services/bulky-waste/page.tsx:79-100`; `src/app/(portal)/report/new/parts.tsx:115-129` | Keyboard (verified with Playwright). In `ChoiceGroup`, arrows call `onChange` but focus stays on the old radio (now `tabIndex=-1`). The next arrow starts from the old index again, so in "طريقة الدفع" only فوري and محفظة can be reached and إنستاباي never can. The bulky day picker uses roving `tabIndex` with **no** arrow handling, so only the selected day is reachable. The AI options set `tabIndex=0` on every radio and have no arrows. | `ChoiceGroup.move`: compute the next index, call `onChange`, then focus that element (keep refs, or `e.currentTarget.parentElement?.children[next]` cast to `HTMLElement`, then `.focus()`). Reuse `ChoiceGroup` for the day tiles, or add the same ArrowLeft/Down = next, ArrowRight/Up = previous handling with focus move. AI options: roving `tabIndex` (selected or first = 0) plus arrows. Add a Playwright keyboard test for the booking page. | no |
| W5 | major | `src/ui/brand.tsx:30-41` (`PinIcon`, `pinSvg`); `src/ui/map/IncidentMap.tsx` (`title={p.title}`) | Map pins show status by colour only: every pin has the same white dot. The rule says status is never colour-only, and `docs/design/screens/web/Map.html` draws a glyph per state: dot = received, arrow = assigned, clock = in progress, check = resolved, "!" = critical. The marker `title`/`alt` is only the title. | Give `pinSvg` and `PinIcon` a `glyph` argument from `pin.critical ? 'alert' : status` and copy the five inner paths from `Map.html` (e.g. clock `M32 19v8l5.5 3.5`, check `M26 26.8l4.4 4.4 8-8.6`, arrow `M25 26.5h13M33 20.5l-6 6 6 6`, alert `M32 19v9` plus a circle at 32,34). Set the marker `title`/`alt` to `${p.title} · ${STATUS_LABEL_AR[p.status]}${p.critical ? ' · خطر' : ''}`. | no |
| W6 | major | `src/app/(portal)/requests/[id]/page.tsx:166-186` | There is no "reopen" for a resolved report. The shared timeline text (`components/requests/timeline.ts:27`) tells the citizen "وتقدر تفتح البلاغ تاني لو المشكلة لسه موجودة". Mobile has `components/requests/ReopenCard.tsx`, and the website already ships `reopenReport` (`store/actions.ts`) and the API call. | Port `ReopenCard`: for `item.kind === 'report' && item.status === 'resolved'`, show a card with a note textarea (label "إيه اللي لسه موجود؟") and the button "لسه المشكلة موجودة". It calls `reopenReport(item.incident.id, note.trim())` and then shows "اتفتح البلاغ تاني، وهنراجعه ونبلّغك بأي جديد." Errors go in an `a-err` line. Add an e2e test (simulate to resolved, then reopen). | no |
| W7 | major | `src/app/(portal)/report/new/parts.tsx:46-55` | The one file input has `capture="environment"` and `multiple`. On Android Chrome and iOS Safari, `capture` opens the camera directly, so a photo that was already taken can't be picked. The "أو من المعرض" text is a `<span>` with no action, which is misleading. | Use two inputs: keep the camera input (`capture="environment"`, single), and add a gallery input (`accept="image/*" multiple`, **no** `capture`). Make "أو من المعرض" a `<label htmlFor="photo-gallery">` styled as `.w-link`. Desktop is unchanged (the drop zone and either input open the file dialog). | no |
| W8 | minor | `src/lib/voice.ts:5,171-173`; `src/services/api/upload.ts` (whole file) | Leftover from the old website. The voice recorder uses the pre-PR #12 `services/api/upload.ts` (`uploadFile`, `transcribe`), which duplicates the shared `services/api/uploads.ts` and `services.transcription`. In mock mode the shared `uploadAndTranscribeVoiceNote` is never used. `blob.type` is signed as is (e.g. `audio/webm;codecs=opus`), which is not one of the contract's content types. | In `startServer`'s `onstop`, call `uploadAndTranscribeVoiceNote(URL.createObjectURL(blob), blob.type.split(';')[0], onVoiceNote)` from `@/store` and revoke the object URL afterwards. Then delete `src/services/api/upload.ts` and update the README (W9). | no |
| W9 | minor | `README.md:1,66,74-75,82-83`; `src/lib/photo.ts:4` | Stale docs after PR #12. The README names the product "Fix the City" and still describes `src/lib/outbox.ts` ("One tab sends at a time (Web Locks)"), which is gone. Line 66 lists `services/api/upload.ts` as a platform file but omits the real ones (`services/network.ts`, `services/api/uploads.ts`, `store/useOutboxSync.ts`, `notifications/os.ts`, `platform/*`). Lines 82-83 describe the old queue (the shared outbox drops a 4xx item instead of holding the queue). `photo.ts:4` points at `api/upload.ts`. | Rewrite those README sections to describe the shared outbox (`store/useOutbox.ts`, `outboxFlush.ts`, `useOutboxSync.ts`) and its behaviour, list the real platform files (same list as `scripts/check-shared.sh`), and fix the `photo.ts` comment to say the shared upload service (`services/api/uploads.ts`). | no |
| W10 | minor | `src/platform/async-storage.ts:17-22` | `setItem` throws `QuotaExceededError` inside an async function. zustand persist ignores the rejected promise, so a queued report with two data-URL photos can stay in memory only while the page says "حفظنا البلاغ على جهازك". Closing the tab loses it. The old outbox caught this and showed "مفيش مساحة…". | Catch in the shim: `try { storage()?.setItem(k, v); } catch (e) { lastWriteError = e; throw e; }`. In `ReportForm` after `res.queued`, check `localStorage.getItem('ftc.outbox.v1')?.includes(res.item.id)`. If it is missing, call `useOutbox.getState().remove(res.item.id)` and show `submitError` "مفيش مساحة نحفظ البلاغ على جهازك. جرّب تبعته لما النت يرجع." | no |
| W11 | minor | `src/app/(portal)/page.tsx:117` "لو شايف مشكلة"; `profile/page.tsx:93` "متأكد إنك عايز تخرج؟"; `profile/page.tsx:118` "وصلت لأعلى لقب. شكرًا إنك بتصلّح مدينتك."; `report/success/page.tsx:67` "شكرًا إنك بتصلّح مدينتك"; `report/new/parts.tsx:84` "تقدر تختار التصنيف بنفسك وتكمّل."; `requests/[id]/page.tsx:57` "تقدر ترجع لقايمة طلباتك"; `services/bulky-waste/page.tsx:130` "لسه مختارتش" | Masculine second-person forms that are not in the mockups. Rule: gender-neutral copy (imperatives are OK). The mobile app already rewrote its versions (`success.tsx:120`). | "لو فيه مشكلة، بلّغ عنها…"; "تخرج من الحساب؟" (or "نخرج من الحساب؟"); "ده أعلى لقب. شكرًا على مشاركتك في تصليح مدينتك."; success: "ده بلاغك رقم {n}. ده أعلى لقب، شكرًا على مشاركتك في تصليح مدينتك."; "اختار التصنيف بنفسك وكمّل."; "ارجع لقايمة طلباتك."; "لسه مفيش". | no |
| W12 | minor | `src/app/(portal)/requests/[id]/page.tsx:152-163`; `src/app/(portal)/requests/page.tsx:22-26` | Service details always use the bulky-waste layout: "اللي هيترفع", "طريقة الدفع" and "الرسوم" for every service. A `tree_maintenance` booking (made on the phone, same account in API mode, or W2's page) has no `payment`, and its items are work types. | Branch on `item.request.serviceType`. For tree: "نوع الشغل" = `details.workType ?? items[0]`, "الرسوم" = `FREE_SERVICE_LABEL`, and no payment row. For bulky: as now. In `depLine`, use the catalog department (e.g. "إدارة الحدائق" for tree) instead of the fixed "خدمات الحي". | no |
| W13 | minor | `src/app/(portal)/profile/page.tsx:119`, `src/app/(portal)/report/success/page.tsx:70` (progressbar without a name); `src/app/(portal)/map/page.tsx:88` (`<div id="main">`, no `<main>`); `src/app/(portal)/services/page.tsx:35` (`h3` after `h1`); `src/app/(portal)/report/new/parts.tsx:47-60` + `src/styles/web.css:174` (focus on the hidden file input is invisible); all pages share one `<title>` | Accessibility (axe plus a manual check). The file input is `.w-sr`, so its focus outline is clipped and `.r-drop` shows no focus. Every page's tab title is the app name only. | Add `aria-label="التقدّم للقب الجاي"` to both bars. Make `.m-wrap` a `<main id="main">`. Use `<h2>` for the service card titles (keep the size via class). Add `.r-drop:focus-within{outline:3px solid var(--ftc-gold);outline-offset:2px}`. Per-page titles: a small `useEffect(() => { document.title = \`${t} · سيتي فيكس\`; })` helper in each page, or server `page.tsx` wrappers exporting `metadata`. | no |
| W14 | minor | `src/app/sign-in/SignIn.tsx:69-71,89-91` | Error handling drops server and network detail. `/auth/otp` failures always say "معرفناش نبعت الكود". **Any** verify failure, including no network or a 5xx, says "الكود مش صح". | `catch (e)`: if `e instanceof ApiError && [400, 401, 422].includes(e.status)` say "الكود مش صح، جرّب تاني". Otherwise show `e instanceof Error ? e.message : …` (http.ts already gives the friendly Arabic network and server lines). Do the same for `sendCode`. | no |
| W15 | minor | `src/app/(portal)/map/page.tsx:78-80` | The pin-card "أنا كمان" swallows errors silently (`// the button is available again`). | Add a `followFailed` state and render `<span className="a-err" role="alert">معرفناش نسجّل متابعتك، جرّب تاني.</span>` in the card, like the home page. | no |
| W16 | minor | `src/ui/Shell.tsx:18,37` | The bell only toasts "الإشعارات قريبًا", but the shared `useNotifications` store (copied in PR #12) records status changes and the mobile app has `app/notifications.tsx`. | Add `/notifications` (port mobile `notifications.tsx`: list from `useNotifications`, mark read, link to `/requests/[id]`), with an unread dot on the bell. Or leave the toast and note it in README "Known gaps". | no |
| W17 | minor | `scripts/check-shared.sh:30-34` (and the matching `web-ci.yml` path list) | The components loop only walks files that **already exist** on the web side, so a new pure mobile helper is never flagged as missing. This is how `components/services/tree.ts` and `tree.test.ts` were missed (W2). | Also walk `$MOBILE/components/**/*.ts` and report `missing:` for files that have no `react-native`/`expo-` import and no `index.ts` barrel, or keep an explicit allow-list of shared component files. Add `tree.ts` and `tree.test.ts` to `web-ci.yml` paths. | no |
| W18 | minor | `src/lib/geocode.ts:5,32`; `.env.example:4-5`; `README.md:76` | A third client env var, `NEXT_PUBLIC_GEOCODER_URL` (rule: only `NEXT_PUBLIC_API_MODE`/`NEXT_PUBLIC_API_URL`). By default the citizen's exact GPS fix goes to the public OSM Nominatim, a third party, with nothing on screen saying so. | Preferred: reverse-geocode through the backend (a proposed `GET /geo/reverse?lat&lng`, by contract PR), with the public server only in mock mode. Otherwise, get Abood's sign-off for the extra variable, add it to the brief's allowed list, default it to `off` in API mode, and mention it in the README privacy notes. | no |
| W19 | minor | `e2e/*.spec.ts` | Test gaps. Nothing clicks the service cards (W2 would have failed), and there is no multi-tab outbox test (W3), no keyboard booking test (W4) and no reopen test (W6). `report-extras.spec.ts:23` is flaky on desktop in the full run (row count 0 after going back online; it passed 3/3 alone). | Add the four specs. For the flake, wait for `outbox-banner` to be hidden **and** `useReports` to reload before counting, e.g. `await page.goto('/requests')` plus `await expect(rows).toHaveCount(before + 1, { timeout: 15000 })`. | no |
| W20 | minor | `src/services/mock/seed.ts:59` (`sensitivePlace: 'مدرسة الشهيد محمود'`); `src/shared/components/report/voice.test.ts:25` (`'ميدان الحصري'`) | Religious references in place names. "الشهيد" is shown through the priority reason, and الحصري is named after a Qur'an reciter (test fixture only). The rule says no religious references, including street names. | In `apps/mobile/src`, change them to neutral names (e.g. "مدرسة النصر الابتدائية", "ميدان الساعة"), then copy them here. | yes |
| W21 | nit | `src/lib/photo.ts:105-106` | Compression uses 1600 px / q 0.8 (1024 / 0.5 with data saver). The contract says the app sends 1600 px / q 0.7. | Use quality 0.7 when data saver is off. | no |
| W22 | nit | `src/services/api/http.ts:52,31-39` | The web copy hardcodes `Accept-Language: 'ar'` and the Arabic error lines. Mobile uses `getLang()`/`tr()` (part of the i18n work below). | Port the mobile lines (`getLang()`, `msgGeneric()` etc.); the diff is in the mobile file. | no |
| W23 | nit | `src/styles/web.css:84` | `.h-sky{left:0;right:auto}` uses physical sides. | `inset-inline-end:0; inset-inline-start:auto`. | no |
| W24 | nit | `src/app/(portal)/report/success/page.tsx:36` | The share text from the **website** says "افتح التطبيق". | "افتح الرابط وقول "أنا كمان"…". | no |
| W25 | nit | `src/app/sign-in/SignIn.tsx:128` | The hero slogan uses `.ftc-slogan` (Aref Ruqaa). `SignIn.html` uses the Readex display style. Both are allowed by the identity guide, but the mockup wins. | Use the display class from `SignIn.html` (`700 40px/48px` Readex), or ask Abood. | no |
| W26 | nit | `src/app/(portal)/map/page.tsx:90` | "{n} بلاغات حوالين {district}" counts all incidents (not the filtered ones) and reads "١ بلاغات" for one. | Count `visible.length` and use a singular/plural helper (e.g. `n === 1 ? 'بلاغ واحد' : …`). | no |
| W27 | nit | `src/app/(portal)/report/success/page.tsx:46` | "اتضمّيت للبلاغ الموجود" is masculine second person (same text in mobile `success.tsx:87`). | "بلاغك اتضم للبلاغ الموجود، رقمه …" in both apps. | no |
| W28 | nit | `src/services/api/index.ts:18` | The comment says `EXPO_PUBLIC_API_MODE`/`EXPO_PUBLIC_API_URL`. | Make the comment platform-neutral in mobile ("the app's API_MODE / API_URL env"). | yes |
| W29 | nit | `src/services/network.ts:8`; `src/services/mock/db.ts:20-21` | `isOnlineState` is unused on the web. The web `db.ts` lacks mobile's `withEnglish()` on load, so a mock DB saved before an English switch would have no English titles. | Delete `isOnlineState` (or keep it with a comment). Port `withEnglish` when English is added. | no |
| W30 | nit | `src/store/useOutbox.ts` (key `ftc.outbox.v1`) | The old website stored a plain array under the same key. The new persist format ignores it, so reports queued by the old build are dropped silently. | One-time migration in `useOutboxSync.ts`: if `JSON.parse(raw)` is an array, re-enqueue each `{userId, input}` and rewrite the key. Or accept the loss (demo data) and note it in the README. | no (web platform file) |
| W31 | nit | `package.json` (`next@15.5.28`) | `npm audit`: `postcss` advisory via `next` (build-time). | Track it; take the patched Next 15.x when it is released rather than `--force` to 16. | no |

Not counted as defects (as instructed): no English UI. The "English" links on sign-in and the profile "English — قريبًا" row are placeholders.

### Contract match (services, mock and API)

- **API service** (`src/services/api/index.ts`, shared): paths, methods and bodies match `docs/api-contract.md`. That covers `/auth/otp` → 204, `/auth/verify`, `/reports`, `/incidents`, `/incidents/{id}/follow`, `/incidents/{id}/reopen` (proposed), `/map/incidents`, `/service-requests`, `/triage`, `/uploads/sign` → PUT, and `/ai/transcribe` (proposed). 404/403 on GET-by-id becomes "not found".
- **http.ts** (web platform copy): Bearer token, 204 handling, `{detail}` for errors with a friendly Arabic line on 5xx, network failure and 422 arrays, and 401 → `expireSession`. Matches the brief.
- `NewReportInput` includes `severity`, `governorate`, `district`, `linkToIncidentId` and `voiceNoteUri` as in the contract. Photos are data URLs in mock mode and uploaded through `/uploads/sign` in API mode (shared `sendReport`). `/triage` gets `photoUri` only in mock mode (correct, because a data URL can't be read by the server).
- **Mock services** are the shared mobile files with the same seed (10 incidents around Nasr City, OTP 123456). They are stored in `localStorage` (`ftc.mock.db.v1`).
- Deviations: W8 (a second, legacy upload path for voice with a codec-suffixed content type), W12 (tree booking details) and W21 (photo quality). There are no web-only endpoints.

### Rules check

| Rule | Status |
| --- | --- |
| Arabic-first RTL, logical CSS | pass: `<html lang="ar" dir="rtl">` and logical properties throughout. One physical rule (W23). |
| Egyptian Arabic, gender-neutral | partial (W11, W27) |
| No religious motifs or phrases, incl. street names | partial: shared seed and test names (W20). UI copy is clean. |
| Flag palette from tokens only, no gradients, no dark mode | pass: every hex in `src/` and `public/` is a token value, and every `rgba()` is ink, white or red. No gradients and no `prefers-color-scheme`. |
| Arabic-Indic digits in citizen copy | pass. The only Western digits are FTC/SRV IDs and the masked phone `010 •••• 5678`, both as in the mockups. |
| Status never colour-only | chips pass; map pins fail (W5) |
| AI output labelled as a suggestion | pass ("اقتراح الذكاء الاصطناعي", "مش صح؟ اختار التصنيف بنفسك") |
| No secrets in the client | pass: no keys or tokens in the source. Extra public env var (W18). |
| Accessibility | mostly pass. Labels and skip link are present. W4 (keyboard) and W13 need fixing. |

### Arabic/English switch: how hard?

**The plumbing is ready; the website text is not.** It is a medium job, roughly 1–2 days, not a toggle:

1. **Ready already:**
   - `src/i18n` (`tr`, `useTr`, `useLang`, `setLang`, `labels.ts`) is copied and tested.
   - `usePrefs.lang` persists to `localStorage` through the AsyncStorage shim.
   - The shared helpers already return English (timeline, filters, labels, report text, mock data via `localize.ts`).
   - Next loads the Latin subsets of Readex Pro and IBM Plex.
2. **Needed:**
   - Wrap every web-only string in `useTr()`. There are about 770 Arabic lines in `src/app`, `src/ui` and `src/lib`, and today **none** use `tr`.
   - Swap `toArabicDigits` (36 calls) for `localDigits`, and the domain `labelAr` fields for `labelOf`/`statusLabel`.
   - Set `document.documentElement.lang/dir` from `useLang()` in a client component under the root layout. The layout hardcodes `lang="ar" dir="rtl"`; use a tiny inline script to avoid a flash.
   - Check the icons that must not mirror (`arrow-back`/`chevron`).
   - Avoid Aref Ruqaa for English text.
   - Port the `http.ts` `getLang()` lines (W22) and `withEnglish` in `db.ts` (W29).
   - Replace the sign-in "English" and profile "قريبًا" placeholders with `setLang`.

The CSS is already almost entirely logical, so the layout should flip cleanly.

## Fix plan (in order)

1. **W1, rename**: assets, alt text, titles, footer, share texts, README. Mechanical, about 30 minutes.
2. **W2, services**: copy `tree.ts`/`tree.test.ts` from mobile, build `/services/tree` and `/services/garbage-schedule`, fix the CTA labels and home tiles. Fix W12 at the same time (tree details on the track page and requests list).
3. **W4, keyboard**: fix `ChoiceGroup` focus, the day-picker arrows and the AI options' roving tabindex.
4. **W5, map pins**: status glyphs and status in the marker title.
5. **W7, photo picker**: separate camera and gallery inputs.
6. **W6, reopen card** on the track page.
7. **W3, outbox across tabs**: mobile PR for the runner hook in `outboxFlush.ts`, copy it here, then web Web Locks + `storage` rehydrate. W10 (quota) and W30 (old key) go in the same PR.
8. **W8 + W9**: route voice through the shared upload/transcription, delete `services/api/upload.ts`, rewrite the stale README sections.
9. **W11, W27, W24**: copy fixes. W20 and W28 go in a small mobile PR, then re-copy.
10. **W13–W16, W18**: a11y, sign-in errors, map follow error, notifications (or document the gap), geocoder decision.
11. **W17, W19**: harden `check-shared.sh` and add the missing e2e specs (services links, two tabs, keyboard booking, reopen). Deflake the offline spec.
12. Nits W21–W31 as time allows.
13. Afterwards: the English switch (section above) as its own feature PR.
