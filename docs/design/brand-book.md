# CityFix — سيتي فيكس

بلّغ.. وإحنا نتابع لحد ما تتصلّح — Report it, and we follow it until it's fixed.

CityFix is a civic platform for Egyptian cities: citizens report problems and request services, and the city's command center triages, prioritises, fixes and budgets them. The identity takes Balady's structure — Arabic-first, right-to-left, big service tiles, a calm government-grade feel — and dresses it in the colours of the Egyptian flag: red, white and black, with the gold of the eagle as the accent.

## Brand idea

**A pin that ends in a check, in the nation's colours.** Every report starts as a place on the map and ends as a fixed problem. The mark is a red map pin (where) holding a check (fixed), with a gold dot for the eagle — "something is happening".

| Flag element | Brand role | Token |
| --- | --- | --- |
| Red band | Primary colour: heroes, primary buttons, links, the pin | `red` |
| White band | The page ground and cards | `paper`, `surface` |
| Black band | Text, the admin sidebar, the Nile in the skyline | `ink` |
| Gold eagle | Action accent: the Report button, badges, highlights | `gold` |

The flag is used as a **palette**, not as a picture: never draw the eagle or the flag itself as decoration. The only literal flag is the small one next to the +20 country code.

## Logo

- **Mark** (`cityfix-mark.svg`): red pin, white disc, red check, gold dot. App icon, favicon, "your report" map marker.
- **English lockup** (`cityfix-lockup-en.svg`): "City" in `ink`, "Fix" in `red`.
- **Arabic lockup** (`cityfix-lockup-ar.svg`): سيتي فيكس ("سيتي" in `ink`, "فيكس" in `red`) — the default on Arabic screens; the mark sits on the right (RTL start).
- Clear space around the mark: at least the gold dot's diameter. Minimum mark size 24px.
- On `red` backgrounds put the mark on a white plate (a white circle or pill). Never recolour the gold dot.

## Voice and content

- **Egyptian Arabic first, friendly and short.** "بلّغ عن مشكلة" not "تقديم بلاغ رسمي". English is the second language of the UI, not an afterthought.
- Address the citizen directly but gender-neutrally ("بلاغك", "طلبك") instead of choosing إنت or إنتي.
- **Say what happens next** after every action: "وصلنا بلاغك. هيتراجع خلال ٢٤ ساعة".
- **Explain, don't hide.** Priority and budget screens show the reason in one line: "أولوية عالية: قريب من مدرسة + ٧ بلاغات".
- Numbers: Arabic-Indic digits (٠١٢٣) in Arabic citizen copy, Western digits in the admin dashboard and data tables.
- Never blame: "لسه بنشتغل عليه" (we're still on it), not "pending".
- Label AI output as a suggestion: "اقتراح الذكاء الاصطناعي" with a confidence level; the person confirms.
- **Neutral, civic tone.** No religious phrases or symbols in system copy; promises are concrete ("متوقع نخلص بكرة").

## Visual foundations

- **RTL by default.** Layouts mirror for Arabic: navigation and the logo start on the right; timelines run right-to-left. Use logical CSS properties everywhere.
- **Ground and cards.** Pages sit on `paper`; content sits on `surface` cards with `radius-md` and `shadow-card`. Dividers use `line`. No gradients.
- **Service tiles (from Balady).** The citizen home is a grid of large tiles: `surface`, `radius-lg`, an icon in a `red-soft` well, label in `body-strong`.
- **One loud action per screen.** The primary action is `red` with `on-red` text. On mobile, "Report a problem" is a floating `gold` circle with `ink` icon.
- **Red vs. urgent.** Brand red marks the brand and primary actions. Critical items use the darker `urgent` and always carry a word or warning icon, so a red button is never mistaken for an alarm.
- **Status colours are a fixed language**, shared by chips, map pins and timelines: Received (`status-received`), Assigned (`status-assigned`), In progress (`status-progress` on `gold-soft`), Resolved (`status-resolved`), Critical (`urgent`). Chips always carry a word as well as a colour.
- **Typography.** Headings in Readex Pro (`display`, `h1`, `h2`), text in IBM Plex Sans Arabic (`body`, `small`, `caption`). Arabic needs air: body line-height is 28px on 16px.
- **Spacing.** A 4px base; card padding `space-4` on mobile and `space-6` on desktop; sections `space-8` apart.
- **Map (CityPulse).** OpenStreetMap tiles in a `radius-lg` frame. Pins are the brand pin shape filled with the status colour; selected repairs in the budget plan get a `gold` ring.

## Egyptian identity

| Source | How it shows up | Token / asset |
| --- | --- | --- |
| The flag's red, white, black and eagle gold | The whole palette | `red`, `paper`, `ink`, `gold` |
| Cairo's skyline on the Nile: Cairo Tower, apartment blocks with lit windows, the pyramids, the sun and a felucca | Bottom edge of the sign-up and home heroes — a red sky, a white city and a black Nile, so the hero reads like the flag's three bands | `cairo-skyline.svg` |
| Ruqaa handwriting (خط الرقعة) — the everyday script of Egyptian shop signs and school notebooks | Short slogans and greetings only: "مدينتك أحلى لما نصلّحها سوا"، "صباح الفل"، "تسلم إيدك" | `slogan`, `slogan-sm` (Aref Ruqaa) |
| Egyptian warmth in speech | Greet by time of day ("صباح الفل" / "مساء الفل"), thank after every report ("تسلم إيدك"), celebrate fixes ("اتصلّحت! شكرًا إنك بلّغت") | copy |
| جدعنة (community spirit) | Neighbourhood titles for active reporters: "جدع الشارع" (3 reports), "جدع الحي" (10 reports), shown as a gold medal on `gold-soft`. No points, cash or leaderboards of people | `gold`, `gold-soft` |

**Rules**

- Ruqaa is a voice, not a UI font: one line, at most 6 words, on a hero or a celebration. Never for buttons, forms, numbers or body text.
- One illustration per screen. No decorative patterns.
- No religious symbols, religious phrases or seasonal religious themes anywhere in the product.

## Made for Egypt

These rules apply to every citizen screen; they are what make CityFix Egyptian beyond the colours.

- **Sign-up by phone, not email.** Egyptian mobile number with a fixed `+20` prefix (works on Vodafone, Orange, Etisalat and WE). The one-time code goes by SMS or WhatsApp, the citizen's choice. No national ID at sign-up.
- **Egypt's address structure.** Location is محافظة → حي (e.g. القاهرة · حي مدينة نصر أول), plus a free-text **landmark** field ("قدام مدرسة النصر الإعدادية"), because many streets are known by landmarks, not numbers.
- **Emergencies are never a report.** Any screen where a citizen picks a problem shows the emergency numbers as `tel:` buttons first: ١٢٢ police, ١٢٣ ambulance, ١٨٠ fire, on `urgent-soft`. Gas leaks get ١٢٩ with a one-line safety instruction.
- **Utility outages go to the utility.** Water (١٢٥), electricity (١٢١) and sewage (١٧٥ in Cairo and Alexandria) are shown as direct-call buttons; the report is still logged but the citizen is told calling is faster.
- **Egyptian problem categories**, in street language: حفرة أو مطب عشوائي، بالوعة مفتوحة، طفح مجاري، كسر ماسورة مياه، زبالة متراكمة، عمود نور مطفي، سلك كهربا مكشوف، إشغالات طريق، كلاب ضالة، شجرة واقعة أو مايلة، رصيف مكسور. Life-threatening ones (open manhole, exposed wire) carry an `urgent` "خطر" tag and jump the priority queue.
- **Voice first.** A WhatsApp-style voice note in Egyptian Arabic is a first-class way to describe a problem; the AI writes it out and the citizen can correct the text.
- **WhatsApp for updates and sharing.** Status updates go by WhatsApp with SMS as the fallback. "Send to the building group" (جروب العمارة) and the "أنا كمان" (me too) button turn neighbours into supporters of one report instead of duplicates.
- **Local payment.** Paid services offer cash to the worker, Fawry, InstaPay and mobile wallets. Fees are shown before booking; never invent a fee — use the district's published rate.
- **Built for weak connections and older phones.** A data-saver mode (light images, map loads on demand) is on by default. Reports are saved offline and sent when the connection returns, and the screen says so.
- **Privacy and trust.** Faces and car plates in photos are blurred automatically before publishing. Citizens can report without their name being visible to the district. The phone number is only used for updates — say so on the sign-up screen.
- **Working week.** Sunday–Thursday; Friday and Saturday are weekends, so response-time targets count working days.
- **Admin side names real Egyptian bodies**: الحي (district), هيئة النظافة والتجميل, شركة مياه الشرب, إنارة الحي, حدائق الحي. External bodies are tagged "جهة خارجية" with their hotline.

## Iconography

- Line icons, 1.75px stroke, rounded caps and joins, 24px grid (Lucide or Tabler fit; they have RTL-safe arrows).
- Category icons sit in a 40px `red-soft` circle; dangerous categories use `urgent-soft` with an `urgent-deep` icon.
- Directional icons (arrows, chevrons, "back") mirror in RTL; objects (camera, pin, tree) never mirror.

## Core components (for the Next.js + shadcn/ui build)

| Component | Spec |
| --- | --- |
| Button / primary | `red` fill, `on-red` text, `radius-md`, 48px tall on mobile, 40px on desktop |
| Button / report (mobile FAB) | `gold` fill, `ink` camera icon, `radius-pill`, `shadow-float`, 4px `paper` ring |
| Status chip | `radius-pill`, `caption` text, status colour text on its `-bg` token, leading 6px dot |
| Filter / choice chip | pill, `surface` with `line` border; selected = `red` fill with `on-red` text (boxed choice chips: `red-soft` with a `red` border) |
| Service tile | `surface`, `radius-lg`, `shadow-card`, icon well `red-soft`, label `body-strong` |
| Report card | photo thumbnail 64px `radius-sm`, title `body-strong`, reference + time in `ink-muted`, status chip at the end |
| AI suggestion card | `red-soft` background, "اقتراح الذكاء الاصطناعي" `caption` label in `red-deep`, top-3 category options with confidence bars in `red`, a confirm control |
| Priority breakdown | score `metric` (0–100), then one row per factor: label, `+points`, a bar in `red` |
| Timeline | vertical, RTL; done steps `red`, the current step `gold` with a `gold-soft` ring, actor + note + time |
| KPI card | `surface`, label `small` `ink-muted`, value `metric`, delta in `status-resolved` or `urgent` |
| Admin sidebar | `ink` background, `on-ink` text (`on-ink-muted` for captions), active item `gold` with `ink` text |
| Budget row | title, cost in EGP, priority score; selected rows on `gold-soft` |
| Community badge | gold medal with red and black ribbon tails on `gold-soft`; title in `slogan-sm` `gold-deep` |

## Accessibility

- Every text pair in the tokens meets 4.5:1 (light theme only; there is no dark mode); `gold` only ever carries `ink` text.
- Status is never colour-only: chips have words, map pins have icons.
- Touch targets at least 44px. Forms label every field above the input.
