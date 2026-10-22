# CityCycle mobile review (branch `feat/mobile-citycycle`)

Date: 2026-10-22 · Scope: `git diff main...HEAD -- apps/mobile docs` (foundation, C1 citizen, C2 collector, C3 smart bins) · Reviewer only (no source changes).

## Verdict

**Approve with fixes. No blockers.** All checks pass, and the demo works end to end in Arabic and English at 390px. A pickup created by the citizen (RCY-3007) shows up as the nearest job in collector mode. Accept, on my way, weigh (hub scale plus manual entry), pay and done all work. After switching back to citizen mode, the pickup shows **Done**, the collector's first name and the weighed amounts. Impact went from 18.3 kg to 22.2 kg, and money from 160 to 174 EGP. The "completed" notification arrives. A "bin is full" report creates a garbage report that shows in طلباتي.

There are 4 major issues to fix before the demo:
- The smart-bin mock fills up for good after a few minutes.
- The collector's "net earnings" hero shows 0 EGP.
- Some Arabic strings use masculine 2nd-person forms.
- The full-threshold tick on the fill gauge is mirrored in RTL on web.

## Check results (run in `apps/mobile`)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass (exit 0) |
| `npm run lint` | pass (exit 0, no warnings printed) |
| `npm test` | pass: 50 suites, 337 tests |
| `EXPO_OFFLINE=1 npx expo export --platform web` | pass (entry bundle 2.4 MB) |
| Playwright walk, AR + EN, 390x844 | pass. No page errors and no horizontal overflow on any of the 29 screens per language. The English body text contains no Arabic, and Arabic screens use Arabic-Indic digits (the only Latin digits are the masked phone number and the ids). Screenshots: `/tmp/claude-0/-home-claude/ea209f5e-0b2e-58b1-a3f6-d7cf9a3fe6ba/scratchpad/cc-review/shots-{ar,en}/` |

What the walk covered, in both languages:
- Sign in.
- Home CityCycle section.
- `/recycle/new`: validation, with organics left unpriced to get "From 15 EGP".
- Success screen, then pickup detail (requested).
- Profile → "Work as a collector" → `/collector`: the new job shows, 5 m away.
- Accept → route → on my way (opens Google Maps in a popup) → weigh (hub scale for PET, 2.5 kg typed for organics) → pay → done.
- Earnings and account.
- In collector mode: deep link `/requests/RCY-3001` stays on the request (correct), and `/` redirects to `/collector` (correct).
- Back to citizen mode: requests (all and recycling filters), pickup detail (completed), notifications, impact.
- Map → smart bins layer → BIN-012 sheet → detail → "Bin is full" → reported. Hot bin BIN-017.
- طلباتي shows the new garbage report FTC-1043 "زبالة متراكمة · شارع الطيران".

**Not verified:**
- Native Android or iOS in Expo Go: react-native-maps markers and circles, the `geo:` and `maps://` links, NetInfo events.
- The offline queue at runtime (only read in code; covered by unit tests).
- The "already taken" path at runtime.
- Sign-out from collector mode at runtime (read in code: `clear()` resets `mode`).
- API mode.

## Findings

Severity: blocker / major / minor / nit. Line numbers are on the branch head.

| ID | Sev | File:line | Issue | Fix |
| --- | --- | --- | --- | --- |
| M1 | major | `apps/mobile/src/services/mock/citycycle-service.ts:161-174` (`listBins`) | Every `listBins` call adds `driftPct` and saves. That includes every `refresh()`: sign-in, mode switch, language switch, impact pull-to-refresh, and the 45 s map polling. Fill only goes up, so within one demo session the drifting bins reach 100 % and stay "full" (persisted). In the walk, Hassan El Maamoun went from 71 % to 100 % and El Tayaran from 41 % to 61 %. Every bin with a non-zero `driftPct` ends up full or "filling", and the "ok" state disappears. | Make the drift time-based and cyclic. Compute the fill from `seedFill + driftPct * minutesSinceSeed / k` modulo a simulated collection (back to ~10 % after reaching 100 %), or empty a bin (fill 5–15 %, new `seq`) once it has been full for N refreshes. Don't drift inside `refresh()`'s call: drift only in `refreshBins`, or add a `drift` flag. Add a test that 50 consecutive `listBins` calls never leave all drifting bins full. |
| M2 | major | `apps/mobile/src/app/collector/(tabs)/earnings.tsx:50-63`, `apps/mobile/src/components/collector/logic.ts:128`, `apps/mobile/src/app/collector/job/[id].tsx:432-438` | The collector's hero card "صافي ربحك / Your net earnings" shows **0 EGP**. For a paid pickup the collector pays the household the list value, so value minus paid is always 0. The seed (RCY-2999, paid 38 for 38) and the new job both give 0, and the Done screen also shows "الصافي ٠ جنيه". This is the collector's main screen and it reads as broken. | Change the hero to what is true today: kg collected and "قيمة الخامات بالأسعار / Value at the price list", with "اتدفع للأسر / Paid to households" below. Keep "الصافي" only as a secondary row labelled "الفرق / Difference", with the existing formula caption. Optionally document in `docs/features/member-1-mobile.md` that collector income needs a hub buy price (not in the contract). Update `logic.test.ts` and `flow.test.ts` if labels or testIDs change (`net-value`). |
| M3 | major | `apps/mobile/src/app/bins/[id].tsx:108` ("لو شايف دخان"), `:149` ("إنت بلّغت"); `apps/mobile/src/app/recycle/new.tsx:149` ("مش متأكد تفرز إزاي؟"); `apps/mobile/src/components/collector/useAcceptJob.ts:22` ("لازم تكون متصل … لأن الأول بيشتغل"); `apps/mobile/src/domain/notifications.ts:65` ("في الطريق ليك") | Masculine 2nd-person adjectives and pronouns, which break the gender-neutral rule. The `useAcceptJob` sentence is also unclear ("because the first one works"). | `bins/[id].tsx:108` → "ابعد عنه ومتلمسوش. لو فيه دخان أو نار، اتصل بالمطافي فورًا."<br>`:149` → "بلّغت عن الصندوق ده قبل كده".<br>`new.tsx:149` → "محتاج مساعدة في الفرز؟" is still masculine, so use "إزاي تفرز؟ شوف دليل الفرز بالصور".<br>`useAcceptJob.ts:22` → "مفيش نت. قبول الشغل محتاج نت، لأن اللي يقبل الأول هو اللي ياخده."<br>`notifications.ts:65` → title `${name ?? 'الجامع'} في الطريق` (drop "ليك"), and update `pickup-requests-notifications.test.ts`, which expects 'محمود في الطريق ليك'. |
| M4 | major | `apps/mobile/src/components/bins/FillGauge.tsx:30` | The "full from 80 %" tick uses absolute `start: '80%'`. On web, react-native-web resolves `start` to `left`, while the `ProgressBar` fill follows the document `dir` (it fills from the right). In Arabic the tick therefore sits at 20 % (screenshots `shots-ar/26-bin-reported.png` and `27-bin-hot.png`). On native the root `direction` should keep it right, but this is not verified. | Lay the tick out with flex instead of an absolute offset: a row overlay `<View style={{position:'absolute',top:-3,bottom:-3,start:0,end:0,flexDirection:'row'}} pointerEvents="none"><View style={{flex:80}}/><View style={tick}/><View style={{flex:20}}/></View>`. Flex rows follow `dir` on web and `direction` on native. |
| m1 | minor | `apps/mobile/src/components/collector/useCollectorQueue.ts:135-141` | When the server refuses a queued **weighing** (`drop`), the loop `continue`s and then sends the queued **complete** for the same job. That finishes the job without the refused weighing, with a paid amount based on totals that included it, or the complete gets refused too. | On `drop` of a weighing, also remove any later `complete` for the same `jobId` from the queue and keep it out of the server call. Put the message in `setDropped` ("الوزن ده متبعتش، راجع الشغل قبل ما تخلّصه"). Add a test in `flow.test.ts`. |
| m2 | minor | `apps/mobile/src/components/collector/JobCard.tsx:49` | The job estimate shows "حوالي ١٥ جنيه / About 15 EGP" even when some items have no price (organics). The citizen's form says "From 15 EGP" for the same pickup. | Use `hasUnpricedItems(job.items, usePriceList())` and show `tr('من …','From …')` plus the "price to be set" note, as in `EstimateBar`. |
| m3 | minor | `apps/mobile/src/app/collector/job/[id].tsx:432-438` (DoneView), `apps/mobile/src/app/collector/(tabs)/account.tsx:62-67` (impact "قيمة الخامات"), `apps/mobile/src/app/collector/(tabs)/earnings.tsx:92-104` (finished-job rows) | These EGP values are computed from demo prices but have no "أسعار تجريبية / Demo prices" label. The rule is a label everywhere a price or value shows. | Render `{demo ? <DemoTag /> : null}` under each of these cards (`useDemoPrices()`). |
| m4 | minor | `apps/mobile/src/app/collector/job/[id].tsx:281-291` and `:235` | The "Read from hub scale / اقرا من ميزان المركز" button records `source: 'scale_ble'` with a "Bluetooth" caption. The contract enum maps the hub scale to `scale_api` ("ميزان المركز"), so the weighing list shows "ميزان بلوتوث". | Either rename the button "اقرا من الميزان (بلوتوث)" / "Read from Bluetooth scale", or record `scale_api` and caption it "قراءة تجريبية من ميزان المركز". Keep the label and the source consistent. |
| m5 | minor | `apps/mobile/src/components/collector/JobCard.tsx:92-96` (`CurrentJobCard`) | The current-job card lists bare weights ("٤ كجم ٦ كجم") with no material names. | Use `<ItemsRow items={job.items} />` (or `MaterialPill`, with the colours adjusted for the dark card). |
| m6 | minor | `apps/mobile/src/components/collector/JobsMap.native.tsx:28` and `apps/mobile/src/components/recycle/PickupPhoto.tsx:59` | Hard-coded `rgba(...)` colours, which breaks the tokens-only rule. | Add `colors.goldTint25`, `colors.redTint15` and `colors.scrim` (or a `withAlpha(token, a)` helper in `theme/tokens`) and use them. |
| m7 | minor | `apps/mobile/src/components/bins/BinMap.native.tsx:287` | The marker `key` includes the fill %. Every 45 s poll changes the fill of drifting bins, so those markers remount, which causes flicker on Android. This gets worse with M1. Not verified on device. | Keep `key={b.id}`. Reset `tracksViewChanges` to true for 600 ms when `state`, `pct` or `selected` change (an effect on those values inside `BinMarker`). |
| m8 | minor | `apps/mobile/src/components/requests/filters.ts` ('fixed') + `apps/mobile/src/store/useRequests.ts` (pickup → `pickupChipStatus`) | Completed pickups map to `resolved`, so they appear under the "اتصلّحت / Fixed" filter, which is wrong for a recycling pickup. | In `filterRequests` 'fixed', exclude `kind === 'pickup'` (they have their own "تدوير" filter). Add a case to `filter.test.ts`. |
| m9 | minor | `apps/mobile/src/domain/notifications.ts:77`, `apps/mobile/src/components/recycle/PickupDetail.tsx:49,100`, `apps/mobile/src/app/bins/[id].tsx:177` and other new strings using "تقدر" | "تقدر تطلب / تقدر ترجع" is a masculine 2nd-person form. Main already has 10 such strings, so this branch follows existing practice, but the rule says gender-neutral. | In the new CityCycle strings use "ينفع تطلب / ينفع ترجع …" or "ممكن تطلب". A wider cleanup of main can be a separate task. |
| m10 | minor | `docs/api-contract.md` CityCycle: `GET /me/impact` | The same account can be both a citizen and a collector (mode switch). `/me/impact` returns one `Impact`, so in API mode the citizen's impact screen would get the collector's impact (the mock avoids this only because the demo collector is a different user, `demo-collector`). | Under "Proposed additions from the mobile app", propose `GET /me/impact?as=citizen|collector`. Pass it from `useCityCycle.refreshImpact` (citizen) and `useCollector.refresh` (collector). |
| m11 | minor | `docs/api-contract.md` Rules → Privacy vs `apps/mobile/src/components/collector/JobCard.tsx:57` | The contract says a collector sees the address and landmark of an open job (and `jobView` sends them), but the card says "العنوان بالظبط بيظهر بعد ما تقبل / The exact address shows after you accept". The copy and the data disagree. The UI does not render the address, which is good. | Pick one. Either (preferred) propose in the contract that open jobs carry street-level `address` only (no building) and `landmark` only after accept, and strip the building in `citycycle-localize.ts` `jobView`; or reword the card to "المكان على الخريطة تقريبي". |
| n1 | nit | `apps/mobile/src/components/collector/JobCard.tsx:44` | `job.id` is not wrapped in `isolateLtr`, so "RCY-3007" can reorder in RTL. | `isolateLtr(job.id)`. |
| n2 | nit | `apps/mobile/src/app/collector/job/[id].tsx:344` | "١٤ جنيه+" (the plus sign is glued after the unit in RTL). | Use `tr(\`من ${formatEgp(v)}\`, \`From ${formatEgp(v)}\`)`, as on the citizen side. |
| n3 | nit | `apps/mobile/src/app/collector/job/[id].tsx:401` | "تأكيد ودفعت ١٤ جنيه" reads awkwardly. | "تأكيد: اتدفع ١٤ جنيه" / "Confirm: paid 14 EGP". |
| n4 | nit | `apps/mobile/src/services/api/citycycle.ts:53` | The dev-only error message is Arabic only. | `tr(...)`, or English (it is a developer error). |
| n5 | nit | `apps/mobile/src/components/collector/useCollectorQueue.ts` / `apps/mobile/src/store/useCollector.ts:33` | In mock mode the queue owner is always `demo-collector`, so any account signing in on the device flushes it. This only matters in mock mode. | Document it in the `collectorActorId` comment, or key the mock actor by `demo-collector:${userId}`. |
| n6 | nit | `docs/mobile/english-glossary.md` row "الجامع (الزبّال)" | "الزبّال" can read as disrespectful. It is not used in the UI. | Add "(never use الزبّال in the UI)" to the row, or drop it. |
| n7 | nit | `docs/api-contract.md` Rules → Privacy | The contract says a citizen sees the collector's "first name, district and verified badge". The app shows the first name only. | Either add "موثّق / Verified" to `PickupDetail` next to the name, or trim the contract sentence. |

Contract (focus 4): the foundation's deviation is documented. The `confirm` row says "*Proposed change (mobile):* … already `completed` after the collector's `complete` … `confirm` only sets `confirmedAt`", and it is listed again under "Proposed additions from the mobile app". The other mobile assumptions (`isDemo`, `note`/`paidToHouseholdEgp`/`startedAt`/`confirmedAt`, `approxPin`, `GET /collector/pickups`, `/start`, `roles` from `/auth/verify`, client-side "filling") are all marked *proposed*. The app's API client matches the contract paths. Open points are m10, m11 and n7.

Seams that work (no action needed):
- The citizen pickup becomes the collector's job, and completion updates the pickup, impact and notification (one "done" notification after the switch back, since intermediate stages coalesce while the citizen store isn't refreshing).
- Same demo user switching modes.
- Mode is persisted and reset on sign-in and sign-out.
- Language switch triggers `refreshAll`, including collector data.
- Notification deep links to `/requests/RCY-…` are not redirected in collector mode.
- Own-cancel suppression (`expectOwnChange(…, 'cancelled')`).
- Bin polling stops on blur (`useFocusEffect` cleanup).
- The collector sync hook removes its NetInfo and AppState listeners.
- No religious content.
- Touch targets in the new screens are ≥44 (60 for the collector's main buttons; the photo-remove button is 32 px but has `hitSlop` 10).

## Ordered fix plan

1. **M1**: make the mock bin drift cyclic and stop drifting on `refresh()`. Add the test.
2. **M2**: rework the earnings hero and the Done card (value at price list, paid to households, difference). Update the tests.
3. **M3 + m9**: Arabic wording fixes in the listed files, and update the notification test string.
4. **M4**: flex-based threshold tick in `FillGauge`.
5. **m1**: queue drops a pending `complete` when a weighing for the same job is refused. Add the test.
6. **m3, m2, m4, m5**: demo labels on the remaining values, the partial estimate on `JobCard`, the hub-scale source and label, and the current-job card materials.
7. **m6, m7, m8**: colour tokens, stable marker keys, and pickups excluded from the "Fixed" filter.
8. **m10, m11, n7**: contract notes under "Proposed additions from the mobile app", plus the `jobView` address trim or the copy change.
9. Nits n1–n6.
10. Re-run `npm run typecheck && npm run lint && npm test` and the web export. Re-walk citizen → collector → citizen and bins in AR and EN at 390px. Then a quick Expo Go Android pass (maps markers, `geo:` link, offline weighing and complete), which this review did not verify.
