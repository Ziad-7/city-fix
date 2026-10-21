# Design pack review (2026-10-21)

Reviewer: review and fix pass of `docs/design/` on branch `design/identity-and-screens` (HEAD `ec29d02`, changes not committed), before it is merged as the reference for mobile, citizen web, admin web and backend. I checked it against the brand rules (flag palette from `tokens.json`, no religious motifs, no gradients, no dark mode, ink on gold, status never colour-only, Ruqaa for slogans only, Arabic-Indic digits in citizen copy and Western digits in admin, RTL with logical properties, gender-neutral Egyptian Arabic, no citizen names or phones in admin, AI output labelled as a suggestion) and against the live app in `apps/mobile/src`.

## Summary

**Ready to merge after this pass.** The pack was already in good shape. The palette was almost token-exact, there are no gradients and no religious content, all local links resolved, and there was no horizontal overflow at 1440 px or 390 px. The problems were mostly about consistency. The same demo report had three different priority scores and breakdowns. Several mobile mockups had drifted from the web screens and the app (filter chips, the medal, copy, working days). `tokens.json` still had a dark theme and lacked four values that the CSS and the app use. A few things in `identity.html` broke its own rules: white text on the gold swatch, English LTR samples for an Arabic admin, and a `≤` that rendered as `≥`.

All findings marked "fixed" are fixed in place. Severity counts: **0 blocker · 9 major · 17 minor · 4 nit**. Six items are left as they are, each with a reason.

### Checks run

| Check | Result after fixes |
| --- | --- |
| Local `href`/`src`/`url()` in all HTML, CSS and Markdown under `docs/` (script) | 43 files, 0 broken |
| `README.md` and `index.html` list all 28 screens (file links and preview links) | 28/28 in both |
| Hex colours not in `tokens.json` (map ground `#F1EEE8` and neutral `rgba` tints allowed) | 0 |
| `gradient` in HTML/CSS | 0 (only the "no gradients" comment) |
| White or paper text on gold, computed in the browser for every page | 0 |
| HTML tag balance (all 30 pages) | clean |
| Horizontal overflow at 1440 (all), 390 (web, identity, hub), 480 (mobile frames) | none |
| Content clipped or squeezed inside the fixed phone frames | none (two fixed: Main, Report) |
| `identity.html` swatches, CSS variables and Tailwind snippet vs `tokens.json` | all values match; every token present |

**Visual check:** I took full-page screenshots with Playwright and Chromium, with Readex Pro, IBM Plex Sans Arabic and Aref Ruqaa loaded from `~/.local/share/fonts/ftc`. Pages: identity and the hub (1440 and 390), all 10 web screens (1440 and 390), all 8 admin screens (1440) and all 10 mobile screens. I read every page. Note: fontconfig registers the Latin and Arabic subsets of Aref Ruqaa under the same family and style, so Chromium picked the Latin file and Ruqaa slogans fell back to Readex Pro. For the screenshots I injected `@font-face` rules with `unicode-range`. This only affects screenshots on this machine. The pages load the fonts from Google Fonts, which is correct.

### Shared demo data, now aligned

The demo report is **FTC-1042 / INC-0041** (pothole on Abbas El-Akkad, WO-318). Its score follows `apps/mobile/src/logic/priority.ts` and the inputs the mockups show (high severity, near a school, 7 reporters, reported today, Nasr City is not underserved):

| Factor | Points |
| --- | --- |
| Severity: high | +28 / 40 |
| Near a school | +20 / 20 |
| 7 reporters: (7 − 1) × 3 | +18 / 20 |
| Wait vs. target: 3 h of 5 working days | +0 / 15 |
| Area equity (Nasr City not underserved) | +0 / 5 |
| **Score** | **66 → "أولوية عالية"** (65–84; 85 and up is urgent) |

Before this pass the same report showed ٨٤ (mobile Track, identity), ٨١ (web Track, with +15 for waiting although it was "reported today") and 84 (admin, with +30, +15, +10 and +9, none of which priority.ts can produce). It now shows ٦٦ / 66 everywhere: mobile Track, web Track, admin Incidents (row, sort order and breakdown), WorkOrders, Budget and the identity samples. The AI suggestion for this report now reads the same on all surfaces: حفرة أو مطب عشوائي ٩٢٪ · رصيف مكسور ٥٪ · إشغالات طريق ٣٪, using the app's category names. Also aligned: SRV-2001 (Thursday 22 October, 9–12, "اتحوّل"), the open manhole on Hassan El-Maamoun (200 m, 12 neighbours), and the demo user's stats (report number 3, "جدع الشارع", 3/10).

## Findings

Severity: **major** = breaks a hard brand rule or would make teams build different things; **minor** = visible inconsistency or bug; **nit** = polish.

| # | Severity | File | Issue | Resolution |
| --- | --- | --- | --- | --- |
| D1 | major | `screens/mobile/Track.html`, `screens/web/Track.html`, `screens/admin/{Incidents,WorkOrders,Budget}.html`, `identity.html` | The same report's priority was ٨٤ / ٨١ / 84, with breakdowns that `priority.ts` cannot produce (+30 severity, +22 reporters, +10 equity, +15 waiting on a report from today). Admin coloured 84 as urgent although 84 is "high". | Fixed: 66 everywhere, with the factor rows from priority.ts. The admin score uses high (gold) styling, the row moved below 71 so the queue stays sorted, and the SLA shows "3 س / 5 أيام" (pothole target). |
| D2 | major | `identity.html` | The gold swatch had **white text on gold**, in the rule guide itself. | Fixed: ink text. |
| D3 | major | `tokens.json`, `brand-book.md` | `tokens.json` defined a **Dark** theme and dark values for every colour, and the brand book said "4.5:1 in both themes". Any Tailwind or theme generator would offer dark mode. | Fixed: light theme only. Dark values removed (the `{"light": …}` shape is kept for tooling), wording fixed. |
| D4 | major | `tokens.json`, `css/fixthecity.css`, `identity.html` | The "source of truth" lacked values the CSS and the app already use: `gold-pressed`, `status-progress-bg`, `icon-muted`, `map-ground`. The admin sidebar used `#F2EFEA` and `#B3B3B3` (dark-theme leftovers) as raw hex. | Fixed: added `gold-pressed`, `status-progress-bg`, `on-ink`, `on-ink-muted`, `icon-muted` and `map-ground` to tokens.json and CSS, with a "Supporting values" swatch row in identity. The sidebars, docbar and admin Login now use `var(--ftc-on-ink*)`. |
| D5 | major | `css/fixthecity.css` → all web and admin pages | The selected `.ftc-filter` was **ink**, but the app's `Chip` (and the mobile mockups, admin Incidents and Budget) use **red with on-red**. The website would not have matched the app. | Fixed in the shared CSS (red fill, on-red, 600 weight). Now one style on all three surfaces. The brand book documents filter and choice chips. |
| D6 | major | `identity.html` | The Tailwind snippet was incomplete. It had no status `-bg` colours (chips could not be built), no `gold-pressed`/`on-red`/`on-ink`, no type scale and no spacing. Its `borderRadius` `sm`/`md`/`lg` silently overrode Tailwind's defaults. It used `received`/`assigned` names that differ from the CSS. | Fixed: a complete `tailwind.config.ts` (v3, `satisfies Config`, `content`) with every colour token named as in the CSS, the type scale, `ftc-*` spacing and radii, shadows, and a logical-utilities note. Checked by script against tokens.json. |
| D7 | major | `screens/mobile/Report.html` | The phone frame was 1400 px but the content is 1612 px. The duplicate panel was cut off and the **"ابعت البلاغ" submit button was missing**. | Fixed: frame height 1620 px. |
| D8 | major | `screens/mobile/Main.html` | The fixed frame squeezed the flex hero from 336 px to 222 px. The **skyline's sun and pyramid sat on top of the hero text and the "بلّغ دلوقتي" button**. | Fixed: hero `flex-shrink: 0`, frame 1290 px. |
| D9 | major | `screens/mobile/Services.html` | Booking days were "الأربعاء ٢٢ / الخميس ٢٣ / **السبت** ٢٥". 22 Oct 2026 is a Thursday and Saturday is not a working day (the work week is Sunday–Thursday). The web shows the correct days. | Fixed: الخميس ٢٢ · الأحد ٢٥ · الاتنين ٢٦, as on the web. The selected day and slot use the app's ChoiceChip style (red-soft with a red border) instead of solid red and gold-soft. |
| D10 | minor | `identity.html` | The admin samples were English and LTR: sidebar "Overview/Incidents", KPI "Open incidents ▼ 12% vs last week", budget table "Repair/Cost/Score" with `dir="ltr"`. The admin is Arabic RTL with Western digits. | Fixed: Arabic RTL samples with Western digits, matching Overview and Budget. Costs come from `categories.ts`. |
| D11 | minor | `identity.html` | In the per-surface rules, "≤ 760px" rendered as **"≥ 760px"** (the ≤ glyph mirrors in RTL). "أرقام عربية" was ambiguous (it could mean Western "Arabic numerals"). The admin card had no privacy or AI-suggestion rule. | Fixed: `<bdi dir="ltr">`, "أرقام هندية-عربية (٠١٢٣)", and admin rules for privacy ("مواطن" / "بلاغ بدون اسم", no phones) and AI-as-suggestion. Added the bdi rule to the accessibility list. |
| D12 | minor | `identity.html` | The red and urgent-soft usage text still referred to the dark theme and called urgent-soft the "Critical chip background", but `.ftc-chip--critical` is filled `urgent`. | Fixed in identity and tokens.json. |
| D13 | minor | `identity.html`, `screens/web/{Home,Requests}.html`, `screens/mobile/{Main,Track,Success}.html` | **LTR leak:** "#FTC-1042 · …" rendered as "FTC-1042#" in RTL text. | Fixed: IDs wrapped in `<bdi dir="ltr">`, as in the pages that already did this. |
| D14 | minor | `screens/web/Profile.html`, `screens/mobile/Track.html` | Masked phone "010 •••• 5678" was not isolated, so the groups can reorder in RTL. The app uses `isolateLtr`. | Fixed: `<bdi dir="ltr">`. |
| D15 | minor | `screens/mobile/Login.html` | The phone field was forced `dir="ltr"`, which put "+20" on the left, while the web and the app (`TextField` prefix with `borderEnd`) put it on the right. | Fixed: RTL row, `border-inline-end`, LTR input, `<bdi>` around +20. |
| D16 | minor | `screens/mobile/Login.html`, `screens/web/SignIn.html` | The +20 flag used off-palette `#CE1126` / `#C09300`. | Fixed: token `red` / `gold`. |
| D17 | minor | `screens/mobile/Success.html` | The medal was a check-mark badge, not the app's star medal (`Medal.tsx`, web, identity). The copy differed from the app ("ده تالت بلاغ ليك…") and the colour was off-token `#6B4F00`. | Fixed: same star medal SVG, the app's copy "ده بلاغك رقم ٣. ٧ بلاغات كمان وتاخد لقب جدع الحي.", "الجهة المسؤولة: صيانة الطرق", and `gold-deep`. |
| D18 | minor | `screens/mobile/Profile.html`, `screens/web/Profile.html` | Mobile said 7 reports and 4 resolved (7/10) while Success and web say report number 3. The web medal line differed from the app's `remainingLine`. | Fixed: ٣ / ١ / ٣ من ١٠, and "فاضل ٧ بلاغات وتاخد لقب جدع الحي" on both. |
| D19 | minor | `screens/web/Category.html` | The "خطر" tag on tiles was the soft variant at the start corner. The app's `CategoryTile` and the mobile mockup use a filled `urgent` tag with on-red text at the end corner. | Fixed. |
| D20 | minor | `screens/mobile/Report.html`, `screens/web/Report.html`, `identity.html` | The AI suggestion used non-existent categories ("حفرة في الطريق", "هبوط أرضي", "كسر في الرصيف") on mobile and different numbers on web (٨٦/٩/٥). | Fixed: the app's category names and ٩٢/٥/٣ on all surfaces. |
| D21 | minor | `screens/mobile/Requests.html`, `screens/mobile/Map.html` | SRV-2001 had a different day, slot and status from web and admin. The map pin card showed a different manhole, 350 m away, from the Home/web "حوالين بيتك" card (Hassan El-Maamoun, 200 m). | Fixed: aligned to web and admin. |
| D22 | minor | `screens/web/Report.html`, `screens/admin/Login.html` | Gendered address: "لو **إنت** مبلّغ عنها…", "**إنت** مبلّغ عنها بالفعل", "لو **إنت** مواطن وعايز تبلّغ…". The identity voice table says avoid إنتَ/إنتِ. | Fixed: "لو بلّغت عنها قبل كده", "بلّغت عنها بالفعل", "للموظفين فقط. بلاغات المواطنين بتيجي من التطبيق أو الموقع." |
| D23 | minor | `screens/admin/Overview.html` | The "فاتت ميعادها" list says "مرتّبة حسب الأولوية" but listed 93, 71, 78. | Fixed: 93, 78, 71, 58, 52. |
| D24 | minor | `screens/admin/{IncidentDetail,Login,WorkOrders,Incidents}.html`, `screens/mobile/{Report,Track}.html` | Off-token hex: `#8E959A`, `#D9D5CE`, `#5A6870`, `#26343A`, `#EFEBE3`, `#333`, `#444`. | Fixed: mapped to tokens (`icon-muted`, `line`, `status-received`, `ink`, `on-ink-muted`) or neutral `rgba` tints. |
| D25 | minor | `screens/mobile/Main.html` | The "طلباتي" service tile linked to `Track.html`. | Fixed: `Requests.html`. |
| D26 | minor | `docs/team/citizen-web-portal.md` | It said Aref Ruqaa is "the logo/wordmark only", which contradicts the rule (short slogans and greetings). It did not point to `identity.html` or `fixthecity.css`. The mockup column was plain text. | Fixed: Ruqaa rule corrected, identity and CSS listed first, mockups are links (checked). |
| D27 | nit | `index.html` | "متغيّرات --ftc-* وفئات .ftc-*" was scrambled by bidi. | Fixed: `<bdi dir="ltr">`. |
| D28 | nit | `screens/admin/ServiceRequests.html` | Button copy "جدّل العربية" (means "braid"). | Fixed: "جدوِل العربية". |
| D29 | nit | `screens/admin/Incidents.html` | Breakdown points used physical `text-align: left`. | Fixed: `text-align: end`. |
| D30 | nit | `brand-book.md` | The admin sidebar spec said "`paper`-light text", which is not a token. | Fixed: `on-ink` / `on-ink-muted`. |
| L1 | minor | `screens/admin/{IncidentDetail,Incidents,Overview,Map}.html` | INC-0042 (open manhole) shows 93 = 40 + 20 + 18 + 10 + 5. The "+10 waiting" uses hours (19 h vs 1 day, and the text says "النسبة 1.0" while 19/24 = 0.79). The "+5 equity" applies to Nasr City, which `locations.ts` marks as not underserved. priority.ts would give 78 (still "خطر" because severity is critical). | **Left:** admin-only data, spread over 4 pages and a timeline whose entries move the score (65 → 84 → 87 → 93). Changing it is a product decision: should waiting time count in hours? Backend should confirm the formula; then align these numbers in one pass. |
| L2 | minor | `apps/mobile/src/components/report/ReportParts.tsx` | The app string "إنت مبلّغ عنها بالفعل" is gendered (see D22). | **Left:** outside the design pack. Mobile owner should change it to "بلّغت عنها بالفعل" so web and app copy match again. |
| L3 | minor | `screens/mobile/{Login,Track,Report}.html` | The mockups draw toggles as checkboxes, while the app (`ToggleRow`) and the web use switches. | **Left:** a visual redraw of several rows, not a surgical fix. Build from `.ftc-toggle` and the app. |
| L4 | minor | `screens/admin/Budget.html` | The simulator works in whole thousands of EGP. The pothole was "45 ألف" while WorkOrders and `categories.ts` say 4,500 EGP. | **Partly fixed:** set to 5 (≈ 4,500 rounded to the simulator's integer unit). Other budget rows are separate incidents, so I left them. |
| L5 | nit | `screens/web/Map.html` | The pin card reason "خطر على المارة + ١٢ بلاغ" is not what `priorityReason()` would output ("١٢ بلاغات + خطورة عالية"). | **Left:** wording only, and the app's own Arabic count agreement ("١٢ بلاغات") needs a fix first. |
| L6 | nit | phone numbers in citizen copy | "010 •••• 5678" uses Western digits in citizen screens. | **Left on purpose:** the app's `maskPhone` and the input fields keep phone numbers in Western digits as LTR identifiers. This is consistent across app, mobile and web. |

## Not problems (checked)

- **Religious content:** the only matches for رمضان/إسلام are the "ممنوع" rule itself; "عيد" only matched inside "مواعيد".
- **Flag:** the small flag next to +20 is the one flag the identity explicitly allows.
- **Admin privacy:** reporters are shown as "مواطن" or "بلاغ بدون اسم". The only names are staff (سارة محمود، م. هشام عادل، م. سامي). No citizen phone numbers appear.
- **AI labelling:** every AI output is labelled "اقتراح" with a confidence score and needs a confirm action (citizen Report, admin Incidents and IncidentDetail, the merge suggestion).
- **Digits:** citizen copy uses Arabic-Indic digits; admin data uses Western digits, with IDs LTR.
- **Ruqaa:** used only for slogans, greetings and medal titles, at most 6 words.
- **Status:** chips always carry words; map pins carry icons and a legend.
- **Fixed tab bar:** the web screens at 390 px show the tab bar in the middle of full-page screenshots. This is a screenshot artefact of `position: fixed`, not a bug.
