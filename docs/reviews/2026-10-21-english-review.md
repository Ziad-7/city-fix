# Mobile English translation review (2026-10-21)

Reviewer: review-and-fix pass of the English translation of `apps/mobile` on branch `feat/mobile-english`. The diff was
taken against `feat/mobile-phase-d` (`git diff feat/mobile-phase-d...HEAD -- apps/mobile docs`). Changes were made in place.
A "WIP snapshot" commit (`d08a4db`) was made outside this pass partway through. The rest of the fixes are uncommitted.

Three tracks translated disjoint parts of the app and were merged by hand:

- **E1:** sign-in, home, report flow, hotlines, schemas, triage summary, API errors.
- **E2:** requests, request detail, map, notifications, mock backend.
- **E3:** services, profile, tab bar, shared UI.

The review checked five things against `docs/mobile/english-glossary.md`:

- no Arabic in English mode
- re-rendering on a live switch
- LTR layout and fonts
- the quality of the English
- Arabic left unchanged

## Verdict

**Ready to merge after this pass.** The i18n design is sound and the three tracks applied it consistently:

- `useTr` / `tr` / `useLang`
- read-time localisation in the mock
- refetching lists on a language switch
- Western digits, and logical `start`/`end` styles everywhere

There is no leftover Arabic UI copy in English mode. No component misses a language subscription. No `tr()` runs at
module level.

The real problems were:

- **The emergency safety net was Arabic-only.** It is client-side and runs in production too, not just in the mock.
- **Visual issues:** the English sign-in slogan ran into the skyline, and the English "Danger" tag overlapped the category icon.
- **Copy:** stale strings in two places, and a set of literal calques and inconsistencies in the English.

**Severity counts: 0 blocker · 2 major · 13 minor · 4 nit.** Everything is fixed except the one item marked *open*.

### Check results (after fixes)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (no warnings) |
| `npm test` | 37 suites, 205 tests pass (new: English triage, English emergency words, English transcripts, next-pickup label) |
| Arabic-literal scan (TypeScript AST, see Method) | 513 literals outside a `tr(ar, en)` first argument. All were inspected and all are data with an English mapping, Arabic-only helpers behind a language branch, keyword lists or dev-only errors. |
| Leftover-Arabic DOM scan, English, 18 screens/states | none (text nodes, `aria-label`, `placeholder`, `title`). The only hit was the Arabic chip label "العربية", which is intentional. |
| Arabic regression: DOM text + `aria-label` + `placeholder` before vs after, 15 screens | identical, apart from clock times that moved by a minute between runs |
| Live switch (web export, Playwright) | Profile → English → Home / My requests / detail, then back to Arabic. No page load; all text, data titles and direction updated. |

## Findings

| # | Severity | File | Issue | Resolution |
| --- | --- | --- | --- | --- |
| 1 | Major | `src/logic/triage-mock.ts` | `detectEmergency` only knew Egyptian Arabic words. It is the client-side safety net in `report/new.tsx` and runs in API mode too. An English description such as "I smell gas" or "someone is injured" never showed the hotlines. The mock classifier also ignored English text, so English reports always got the prior or random categories. | Added a short English emergency word list (whole words) and English category, escalate and de-escalate stems. English stems match at a word start, so "tree" does not fire on "street". Arabic text can't match them, so Arabic results are unchanged. Tests added. |
| 2 | Major | `src/components/ui/AppText.tsx` | In English, the sign-in slogan used the Ruqaa size (30/46) in Readex Pro. It wrapped to 3 lines and ran into the skyline's tower. | English slogan sizes: `slogan` 24/32, `sloganSm` 18/26 (Readex Pro bold). The slogan now fits in 2 lines. |
| 3 | Minor | `src/app/sign-in.tsx` | The phone/OTP validation error is kept in state. After the "English"/"العربية" link on the same screen, it stayed in the old language. | The language link clears the error. |
| 4 | Minor | `src/notifications/os.ts`, `src/app/_layout.tsx` | The Android notification channel name and description were written once. They stayed in the first language after a switch. | The channel is renamed when the language changes: an effect in the root layout calls it again, and `showLocalNotification` checks too. The foreground handler is still set once. |
| 5 | Minor | `src/services/mock/transcription-service.ts` | The mock transcription put Egyptian Arabic sentences into an English description. | Added `MOCK_TRANSCRIPTS_EN`. The mock answers in the app language like the rest of the mock backend. Test added. |
| 6 | Minor | `src/components/report/CategoryTile.tsx` | The English "Danger" tag is wider than "خطر" and covered the icon disc. | In English only, the tag sits further into the corner, with less padding and a `zIndex`. |
| 7 | Minor | `src/i18n/labels.ts`, `ServiceDetailsCard.tsx` | "Fee: [as per the district’s rates]" kept the Arabic placeholder brackets. | Now "as per the district’s rates", as in the glossary. It is capitalised when it stands alone in the booking details. |
| 8 | Minor | `src/app/report/success.tsx` | The English was a literal translation in several lines: "This is your report number 3", "You joined the existing report, number #…", "Its number is", "It will send by itself", "It will go to the responsible department: …". | Now: "You’ve sent 3 reports" (correct plural), "You joined the existing report #…", "Report number:", "It’ll be sent automatically…", "Then it goes to the team in charge: …". |
| 9 | Minor | `src/logic/priority.ts` | The priority reason was joined with " + ", copied from the Arabic layout: "near a school or hospital + 7 reports + high risk". | Joined with commas. The test was updated. |
| 10 | Minor | `app/requests/[id].tsx`, `map-screen/PinSheet.tsx` | The header "Follow your report" was a literal translation of متابعة, and the success button already says "Track your report". "Responsible body" and "Place" were stiff. | "Track your report" / "Track your request", "Handled by", "Location". Added to the glossary. |
| 11 | Minor | `src/app/report/category.tsx` | The title "What type of problem is it?" wrapped to two lines next to the step label. The voice line said "we’ll understand the problem and sort it out". | "What’s the problem?" and "…we’ll work out what the problem is". |
| 12 | Minor | `src/domain/garbage-schedule.ts`, `app/services/garbage-schedule.tsx` | When the next pickup was 2–6 days away it said "Next Thursday", which is ambiguous in English. "The truck comes 8 PM – 11 PM" was a literal translation. | The weekday alone ("Thursday"). "Pickup time: 8 PM – 11 PM". Test added. |
| 13 | Minor | `components/services/tree.ts`, `app/services/bulky-waste.tsx` | Validation verbs were mixed. The screens said "Pick at least one item" / "Pick a day" / "Pick the type of work" while the schemas said "Choose …". | "Choose …" everywhere, matching the schemas and "Choose the type of problem". |
| 14 | Minor | `src/i18n/labels.ts`, `components/report/text.ts`, `domain/schemas.ts` | Lines broke inside units: "9 / AM – 12 PM" on request cards, "said Me / too" on Home, "010 / 1234 5678" in the phone error. | No-break spaces in English only (`SLOT_EN`, "Me too", the example number). Tests updated. |
| 15 | Minor, *resolved* | `src/components/services/ServiceCard.tsx` | The garbage-schedule card's button says "Book now" / «احجز دلوقتي», but the schedule is not a booking. | English says "See the times"; **resolved: Arabic now «شوف المواعيد»** (the bookable services keep «احجز دلوقتي»). |
| 16 | Nit | `components/requests/timeline.ts` | The future service step read "Request review". | "Request reviewed". |
| 17 | Nit | `report/VoiceNote.native.tsx`, `(tabs)/profile.tsx` | "No microphone permission." and "Permission isn’t available." were terse and literal. | "Microphone access is off. …" and "Notifications are turned off for CityFix. …". |
| 18 | Nit | `src/logic/triage-mock.ts` | The AI summary used straight quotes around the category. | Curly quotes. |
| 19 | Nit | `src/i18n/labels.ts` | The English tree chip "Leaning or dangerous tree" wrapped and lost centring. | "Leaning or unsafe tree" (`ITEM_EN`). |

### Checked and left as is

| Area | Finding |
| --- | --- |
| Re-render on switch | An AST scan found no `React.memo` and no `tr()` at module level. Lazy wrappers (`msg()`, `msgGeneric()`, `retryLaterMsg()`) are fine. Every capitalised component that calls a language-dependent helper subscribes with `useTr`/`useLang`/`useIsRTL`, apart from `Stat` in `StatsCard`, which is rendered by a subscribing parent. Memoised text lists `lang`/`tr` (`useRequestItems`, request-detail steps). `FlatList` rows (`notifications.tsx` `Row`) subscribe themselves. |
| Strings in state | Report form errors, `submitError` and the VoiceNote hint are written in the language of the moment. The language can only change from Profile or sign-in, and the report screen sits above the tabs and unmounts on the way there, so this is not reachable. Accepted. |
| Stored notices | Store errors (`useReports.error`) are regenerated by the refetch after a switch. Toasts and transient notices are short-lived. Notification text is fixed at creation by design. |
| LTR layout | No `left:`/`right:`, `row-reverse`, `I18nManager`, `writingDirection` outside inputs, or `scaleX` outside `Icon`. The text inputs pick alignment per language explicitly. Horizontal chip rows start at the reading edge in both languages on web. The direction of the `CategoryPicker` modal follows the language. |
| Ruqaa font | The direct uses (`HomeParts` greeting, success title) already switch to Readex Pro in English. `AppText` handles the slogan variants. |
| Language chip "العربية" in English mode | Intentional: a language is named in its own script. |

## Method

1. **Arabic literals.** A TypeScript-AST script listed every string, template and JSX text node with Arabic characters in
   `src/**/*.ts(x)`. It skipped tests and `src/i18n` and ignored the first argument of `tr(ar, en)` and lookup-table keys. All
   513 hits were classified by hand:
   - domain data mapped in `labels.ts`
   - `*Ar` helpers behind a `getLang()` branch
   - triage keyword lists
   - seed Arabic with `*En` fields
   - the dev-only `simulateProgress` error, which is never shown
2. **Subscriptions.** Two more AST scans: calls made at module level, and components that use language-dependent helpers
   without `useTr`/`useLang`/`useIsRTL`.
3. **Visual.** `npx expo export --platform web` was served locally and driven with Playwright Chromium at 390 px, before and
   after the fixes. Covered in English and Arabic:
   - sign-in (also with a validation error), OTP, home, category, new report (with triage), My requests
   - report detail and service detail
   - map list and pin sheet
   - services, bulky waste (also with errors), tree, garbage schedule, profile, notifications
   - a live switch from Profile

   For each English screen the script also listed any Arabic in text nodes, `aria-label`, `placeholder` and `title`. The
   Arabic DOM text (plus labels and placeholders) of the before and after builds was diffed.

## Follow-ups

- Item 15: choose the Arabic label for the garbage-schedule button.
- Check on a real device (Android and iOS): a live language switch, LTR chip rows, and the renamed Android notification
  channel. Only the web preview was checked here.
- The emergency word lists are a safety net, not a classifier. Keep them short and favour recall. The real triage
  service should own emergency detection in both languages.
