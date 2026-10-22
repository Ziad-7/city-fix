# FixTheCity — City Command Center: UI design spec

Audience: the junior implementer of `apps/admin-web` (Next.js App Router, TypeScript, Tailwind v4). You build ONLY from this document; you do not need to open the HTML mockups. Everything below is derived from `docs/design/screens/admin/*.html`, `docs/design/css/fixthecity.css`, `docs/design/tokens.json`, `docs/design/identity.html`, `apps/mobile/src/components/icon-shapes.ts`, `apps/mobile/src/domain/types.ts`, `apps/mobile/src/logic/priority.ts` and the plan `docs/plans/2026-10-21-admin-dashboard.md` (the plan wins on data and endpoints; the mockups win on look and Arabic copy).

Contents: 0 Conventions and deliberate deviations · 1 Theme + `ftc.css` (paste-ready) · 2 Components · 3 Pages · 4 Formatting and text helpers.

---

## 0. Conventions

### 0.1 Hard rules (from the plan, restated)

- `<html lang="ar" dir="rtl">`. Light theme only. No gradients, no dark mode, no new colours, no religious motifs.
- Ink `#161616` sidebar 232px, gold active nav item with ink text, red primary buttons, white cards on paper `#F8F6F2`.
- **Western digits everywhere in the admin** (`128`, `1,800 جنيه`, `15:20`, `22/10`). Never call `toArabicDigits`. Never render `١٢٣`. Do NOT use `relativeTimeAr`, `formatTimeAr`, `formatDateAr`, `formatDateTimeAr` from the copied `utils/time.ts` (they produce Arabic-Indic digits). Use `src/lib/format.ts` (section 4).
- Privacy: never render a citizen name or phone. Reporter label is `مواطن` or `بلاغ بدون اسم` only.
- Status = same word + same colour everywhere. Words come from `STATUS_LABEL_AR` (copied from mobile): `received` وصل · `triaged` اتصنّف · `assigned` اتحوّل · `in_progress` جاري التنفيذ · `resolved` اتصلّح · `closed` اتقفل. Work-order words: `open` اتسلّم · `assigned` اتوزّع · `in_progress` شغالين عليه · `done` اتحلّت.
- AI output is always labelled `اقتراح الذكاء الاصطناعي`, shows confidence %, and has confirm and change buttons. Merging duplicates always needs a human click.
- Every status-change form REQUIRES a note to citizens and shows a live preview of what the citizen will read.
- Keyboard: every control reachable, visible focus = gold 3px outline (already global in `ftc.css`). Tables rows are focusable and Enter/Space selects.
- Do not translate or "improve" Arabic strings. They are Egyptian dialect on purpose. Copy them exactly.

### 0.2 Where the mockups are inconsistent or silent (decisions made once, here)

| Topic | Mockup says | Decision |
| --- | --- | --- |
| Incident ids | `INC-0042`, `WO-318` mixed styles | Always render the API id as is (`INC-501`, `WO-318`, `SRV-2001`, `FTC-1090`). Never pad or invent ids. |
| Digits in one table | Incidents mock has `١٢٥` once | Western: `125`. |
| Page padding | Incidents and Budget use inline wrappers with padding `24px 28px`, others use `.ftc-admin-main` `24px 32px` | All pages use `<main class="ftc-admin-main"><div class="page">…`. |
| Sidebar scrolling | Static | Extension: sidebar is sticky full height on desktop (CSS in section 1). |
| Shell breakpoint | Sidebar stacks at ≤760 | Extension: stack at ≤900 so 768px tablets do not squeeze the content to ~470px. Everything else follows the mockups (≤1200 grids collapse, ≤1100 KPIs 2-up, ≤760 phone). |
| Side-panel AI label | Incidents side panel says `فرز CityBrain` | Use `اقتراح الذكاء الاصطناعي` (plan rule). |
| Priority chip colour | Only "high" shown (gold-soft chip) | critical → `ftc-chip--critical`, high → `ftc-chip--progress`, medium and low → `ftc-chip--received`. (extension, existing tokens) |
| Score badge colour | 92 urgent, 66/71/78 gold-soft, 58/46/33 grey | `score ≥ 85` urgent, `≥ 65` high (gold-soft), otherwise low (grey). Medium (40–64) uses the grey badge exactly like the mockups. |
| `triaged` and `closed` chip colours | not shown | `triaged` uses the received colours; `closed` uses the resolved colours. (extension) |
| Tree icon in service requests | Mockup draws its own tree | Use the app icon `tree` from `icon-shapes.ts` (single icon set). |
| Drawer on Work orders | Absolutely positioned inside the board | Fixed to the viewport (same look, does not scroll away). |
| Kanban column min-height | 800px | 520px. |
| Checkbox "ابعتها للـ N مواطنين على واتساب (أو SMS)" | Present, checked | Rendered checked and disabled (no API field exists; the backend notifies via the timeline). Never sent. Reported as a gap. |
| District select on login | Decorative | Rendered as in the mock, value not sent; the session district comes from `StaffSession.district`. |

### 0.3 File layout the spec assumes

```
apps/admin-web/src/
  app/globals.css            (section 1.1)
  app/ftc.css                (section 1.2)
  app/layout.tsx             (fonts, html lang/dir)
  components/ui/*.tsx        (section 2, one file per component)
  components/ui/icon-shapes.ts   (copy of apps/mobile/src/components/icon-shapes.ts + ADMIN_EXTRA_SHAPES, section 2.1)
  lib/format.ts              (section 4)
  lib/text.ts                (section 4.4)
public/brand/fixthecity-mark.svg, public/brand/cairo-skyline.svg   (section 2.2)
```

### 0.4 Fonts (layout.tsx)

```tsx
import { Readex_Pro, IBM_Plex_Sans_Arabic } from 'next/font/google';
const readex = Readex_Pro({ subsets: ['arabic', 'latin'], weight: ['500', '600', '700'], variable: '--font-readex', display: 'swap' });
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
// <html lang="ar" dir="rtl" className={`${readex.variable} ${plex.variable}`}><body>…
```

The admin does not use the Aref Ruqaa slogan font. Do not load it.

---

## 1. Theme and stylesheet

### 1.1 `apps/admin-web/src/app/globals.css`

```css
@import "tailwindcss";
@import "./ftc.css";

/* Tokens as Tailwind utilities: bg-ftc-red, text-ftc-ink, border-ftc-line, rounded-ftc-md, shadow-ftc-card, font-display … */
@theme {
  --color-ftc-red: #C8102E;
  --color-ftc-red-deep: #8E0A20;
  --color-ftc-red-soft: #FBE4E7;
  --color-ftc-gold: #D4A20B;
  --color-ftc-gold-pressed: #BC8F09;
  --color-ftc-gold-soft: #FAF0D2;
  --color-ftc-gold-deep: #7A5A00;
  --color-ftc-ink: #161616;
  --color-ftc-ink-muted: #5A5A5A;
  --color-ftc-on-red: #FFFFFF;
  --color-ftc-paper: #F8F6F2;
  --color-ftc-surface: #FFFFFF;
  --color-ftc-line: #E6E1D8;
  --color-ftc-on-ink: #F2EFEA;
  --color-ftc-on-ink-muted: #B3B3B3;
  --color-ftc-icon-muted: #C9D1D4;
  --color-ftc-map-ground: #F1EEE8;
  --color-ftc-status-received: #3D4A50;
  --color-ftc-status-received-bg: #E6EAEC;
  --color-ftc-status-assigned: #1E4F87;
  --color-ftc-status-assigned-bg: #DCE8F6;
  --color-ftc-status-progress: #7A5A00;
  --color-ftc-status-progress-bg: #FAF0D2;
  --color-ftc-status-resolved: #1F6B33;
  --color-ftc-status-resolved-bg: #DCF1E1;
  --color-ftc-urgent: #A50E25;
  --color-ftc-urgent-soft: #FBE4E7;
  --color-ftc-urgent-deep: #8E0A20;

  --radius-ftc-sm: 8px;
  --radius-ftc-md: 14px;
  --radius-ftc-lg: 22px;
  --radius-ftc-pill: 999px;

  --shadow-ftc-card: 0 1px 2px rgba(22,22,22,.06), 0 4px 16px rgba(22,22,22,.06);
  --shadow-ftc-float: 0 8px 28px rgba(22,22,22,.18);

  --spacing-ftc-1: 4px;
  --spacing-ftc-2: 8px;
  --spacing-ftc-3: 12px;
  --spacing-ftc-4: 16px;
  --spacing-ftc-6: 24px;
  --spacing-ftc-8: 32px;

  --text-ftc-h1: 28px;       --text-ftc-h1--line-height: 38px;
  --text-ftc-h2: 22px;       --text-ftc-h2--line-height: 32px;
  --text-ftc-metric: 32px;   --text-ftc-metric--line-height: 36px;
  --text-ftc-body: 16px;     --text-ftc-body--line-height: 28px;
  --text-ftc-small: 14px;    --text-ftc-small--line-height: 22px;
  --text-ftc-caption: 12px;  --text-ftc-caption--line-height: 18px;
}

/* Fonts reference the CSS variables next/font sets on <html>, so they must be "inline". */
@theme inline {
  --font-display: var(--font-readex), "Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif;
  --font-sans: var(--font-plex), "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif;
}
```

Rule of use: build UI from the `.ftc-*` / screen classes in `ftc.css` (they are the 1:1 port of the mockups). Tailwind utilities are allowed only for one-off layout glue (`flex`, `gap-2`, `mt-3`, `hidden`, `sr-only`) and must use logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) never `ml-`/`mr-`/`left-`/`right-`.

### 1.2 `apps/admin-web/src/app/ftc.css` (complete)

Everything is in `@layer base` / `@layer components` so Tailwind utilities (layer `utilities`) can still override it. The class names are the original names from the mockups so markup ports 1:1. Sections: tokens, base, type, surfaces, buttons, chips/tags, forms, atoms (bar, timeline, notice, table), admin shell, page atoms, Overview, Incidents, Incident detail, Map, Service requests, Work orders, Budget, Login, state components (skeleton, toast, modal, drawer, empty/error), responsive.

```css
@layer base {
  :root {
    /* Flag palette */
    --ftc-red: #C8102E;
    --ftc-red-deep: #8E0A20;
    --ftc-red-soft: #FBE4E7;
    --ftc-gold: #D4A20B;
    --ftc-gold-pressed: #BC8F09;
    --ftc-gold-soft: #FAF0D2;
    --ftc-gold-deep: #7A5A00;
    --ftc-ink: #161616;
    --ftc-ink-muted: #5A5A5A;
    --ftc-on-red: #FFFFFF;
    --ftc-paper: #F8F6F2;
    --ftc-surface: #FFFFFF;
    --ftc-line: #E6E1D8;
    --ftc-on-ink: #F2EFEA;
    --ftc-on-ink-muted: #B3B3B3;
    --ftc-icon-muted: #C9D1D4;
    --ftc-map-ground: #F1EEE8;
    /* Status language */
    --ftc-status-received: #3D4A50;  --ftc-status-received-bg: #E6EAEC;
    --ftc-status-assigned: #1E4F87;  --ftc-status-assigned-bg: #DCE8F6;
    --ftc-status-progress: #7A5A00;  --ftc-status-progress-bg: #FAF0D2;
    --ftc-status-resolved: #1F6B33;  --ftc-status-resolved-bg: #DCF1E1;
    --ftc-urgent: #A50E25;  --ftc-urgent-soft: #FBE4E7;  --ftc-urgent-deep: #8E0A20;
    /* Type: the --font-readex / --font-plex variables are set by next/font on <html> */
    --ftc-font-display: var(--font-readex), "Readex Pro", "IBM Plex Sans Arabic", system-ui, sans-serif;
    --ftc-font-sans: var(--font-plex), "IBM Plex Sans Arabic", "IBM Plex Sans", system-ui, sans-serif;
    /* Spacing, radii, shadows */
    --ftc-space-1: 4px; --ftc-space-2: 8px; --ftc-space-3: 12px; --ftc-space-4: 16px; --ftc-space-6: 24px; --ftc-space-8: 32px;
    --ftc-radius-sm: 8px; --ftc-radius-md: 14px; --ftc-radius-lg: 22px; --ftc-radius-pill: 999px;
    --ftc-shadow-card: 0 1px 2px rgba(22,22,22,.06), 0 4px 16px rgba(22,22,22,.06);
    --ftc-shadow-float: 0 8px 28px rgba(22,22,22,.18);
    /* Layout */
    --ftc-web-max: 1100px;
    --ftc-admin-sidebar: 232px;
    /* Derived from existing tokens (used by the mockups as rgba literals) */
    --ftc-scrim: rgba(22,22,22,.35);
    --ftc-on-ink-hover: rgba(255,255,255,.08);
    --ftc-on-ink-line: rgba(255,255,255,.12);
  }

  *, *::before, *::after { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    margin: 0; background: var(--ftc-paper); color: var(--ftc-ink);
    font-family: var(--ftc-font-sans); font-size: 16px; line-height: 28px;
  }
  a { color: var(--ftc-red); text-decoration: none; }
  a:hover { color: var(--ftc-red-deep); }
  :focus-visible { outline: 3px solid var(--ftc-gold); outline-offset: 2px; }
  img, svg { display: block; }
  button { font-family: inherit; }
}

@layer components {
  /* ---------- Type scale ---------- */
  .ftc-display { font: 700 40px/48px var(--ftc-font-display); }
  .ftc-h1 { font: 700 28px/38px var(--ftc-font-display); margin: 0; }
  .ftc-h2 { font: 600 22px/32px var(--ftc-font-display); margin: 0; }
  .ftc-metric { font: 600 32px/36px var(--ftc-font-display); }
  .ftc-body { font: 400 16px/28px var(--ftc-font-sans); }
  .ftc-body-strong { font: 600 16px/28px var(--ftc-font-sans); }
  .ftc-small { font: 400 14px/22px var(--ftc-font-sans); }
  .ftc-caption { font: 500 12px/18px var(--ftc-font-sans); }
  .ftc-muted { color: var(--ftc-ink-muted); }
  .num { font-variant-numeric: tabular-nums; }
  .small { font-size: 14px; line-height: 22px; }
  .mini { font-size: 12px; line-height: 18px; color: var(--ftc-ink-muted); }
  .strong { font-weight: 600; }

  /* ---------- Surfaces ---------- */
  .ftc-card { background: var(--ftc-surface); border-radius: var(--ftc-radius-md); box-shadow: var(--ftc-shadow-card); padding: var(--ftc-space-4); }
  .ftc-card--lg { padding: var(--ftc-space-6); }
  .ftc-divider { border: 0; border-top: 1px solid var(--ftc-line); margin: var(--ftc-space-3) 0; }

  /* ---------- Buttons ---------- */
  .ftc-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--ftc-space-2);
    height: 48px; padding: 0 var(--ftc-space-6); border: 0; border-radius: var(--ftc-radius-md);
    font: 600 16px/1 var(--ftc-font-sans); cursor: pointer; text-decoration: none; white-space: nowrap;
  }
  .ftc-btn--primary { background: var(--ftc-red); color: var(--ftc-on-red); }
  .ftc-btn--primary:hover { background: var(--ftc-red-deep); color: var(--ftc-on-red); }
  .ftc-btn--gold { background: var(--ftc-gold); color: var(--ftc-ink); }
  .ftc-btn--gold:hover { background: var(--ftc-gold-pressed); color: var(--ftc-ink); }
  .ftc-btn--secondary { background: var(--ftc-surface); color: var(--ftc-red); border: 1.5px solid var(--ftc-red); }
  .ftc-btn--secondary:hover { background: var(--ftc-red-soft); color: var(--ftc-red-deep); }   /* extension: hover = red-soft */
  .ftc-btn--ghost { background: transparent; color: var(--ftc-ink); }
  .ftc-btn--ghost:hover { background: var(--ftc-paper); color: var(--ftc-ink); }               /* extension */
  .ftc-btn--sm { height: 40px; padding: 0 var(--ftc-space-4); font-size: 14px; }
  .ftc-btn--block { width: 100%; }
  .ftc-btn:disabled, .ftc-btn[aria-disabled="true"] { opacity: .5; cursor: not-allowed; }       /* extension */
  .ftc-btn.is-loading { pointer-events: none; }
  .ftc-spinner {
    width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-inline-end-color: transparent;
    animation: ftc-spin .7s linear infinite; flex: none;
  }
  @keyframes ftc-spin { to { transform: rotate(360deg); } }

  /* ---------- Chips and tags ---------- */
  .ftc-chip {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px;
    border-radius: var(--ftc-radius-pill); font: 600 12px/18px var(--ftc-font-sans); white-space: nowrap;
  }
  .ftc-chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .ftc-chip--received { color: var(--ftc-status-received); background: var(--ftc-status-received-bg); }
  .ftc-chip--assigned { color: var(--ftc-status-assigned); background: var(--ftc-status-assigned-bg); }
  .ftc-chip--progress { color: var(--ftc-status-progress); background: var(--ftc-status-progress-bg); }
  .ftc-chip--resolved { color: var(--ftc-status-resolved); background: var(--ftc-status-resolved-bg); }
  .ftc-chip--critical { color: var(--ftc-on-red); background: var(--ftc-urgent); }
  .ftc-chip--critical::before { background: var(--ftc-on-red); }
  .ftc-tag-danger { display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; height: 22px; border-radius: var(--ftc-radius-pill); background: var(--ftc-urgent-soft); color: var(--ftc-urgent-deep); font: 700 12px/18px var(--ftc-font-sans); white-space: nowrap; }
  .ftc-tag-gold { display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; height: 22px; border-radius: var(--ftc-radius-pill); background: var(--ftc-gold-soft); color: var(--ftc-gold-deep); font: 700 12px/18px var(--ftc-font-sans); white-space: nowrap; }
  .ftc-tag-muted { display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; height: 22px; border-radius: var(--ftc-radius-pill); background: var(--ftc-status-received-bg); color: var(--ftc-status-received); font: 700 12px/18px var(--ftc-font-sans); white-space: nowrap; }
  .ftc-tag-ext { display: inline-block; font-size: 11px; font-weight: 700; color: var(--ftc-status-assigned); background: var(--ftc-status-assigned-bg); border-radius: 999px; padding: 0 8px; line-height: 18px; white-space: nowrap; }  /* "جهة خارجية" pill */

  .ftc-filter {
    display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: var(--ftc-radius-pill);
    background: var(--ftc-surface); border: 1px solid var(--ftc-line); color: var(--ftc-ink); font: 500 14px/1 var(--ftc-font-sans);
    cursor: pointer; white-space: nowrap;
  }
  .ftc-filter:hover { border-color: var(--ftc-ink-muted); }                                         /* extension */
  .ftc-filter[aria-pressed="true"], .ftc-filter.is-active { background: var(--ftc-red); border-color: var(--ftc-red); color: var(--ftc-on-red); font-weight: 600; }
  .ftc-filter .c { margin-inline-start: 6px; font-size: 12px; opacity: .75; font-variant-numeric: tabular-nums; }

  /* ---------- Forms ---------- */
  .ftc-field { display: flex; flex-direction: column; gap: 6px; }
  .ftc-label { font: 600 14px/22px var(--ftc-font-sans); }
  .ftc-input, .ftc-select, .ftc-textarea {
    width: 100%; min-height: 48px; padding: 10px 14px; border: 1px solid var(--ftc-line); border-radius: var(--ftc-radius-sm);
    background: var(--ftc-surface); color: var(--ftc-ink); font: 400 16px/26px var(--ftc-font-sans);
  }
  .ftc-textarea { min-height: 112px; resize: vertical; }
  .ftc-input:disabled, .ftc-select:disabled, .ftc-textarea:disabled, .ftc-input[readonly] { background: var(--ftc-paper); color: var(--ftc-ink-muted); cursor: not-allowed; }
  .ftc-help { font: 400 12px/18px var(--ftc-font-sans); color: var(--ftc-ink-muted); }
  .ftc-field.has-error .ftc-input, .ftc-field.has-error .ftc-select, .ftc-field.has-error .ftc-textarea { border-color: var(--ftc-urgent); border-width: 1.5px; }
  .ftc-error { display: flex; align-items: center; gap: 6px; font: 600 12px/18px var(--ftc-font-sans); color: var(--ftc-urgent-deep); }
  .ftc-count { align-self: flex-end; font: 400 12px/18px var(--ftc-font-sans); color: var(--ftc-ink-muted); }
  .chk { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 20px; }
  .chk input { width: 18px; height: 18px; accent-color: var(--ftc-red); margin: 1px 0 0; }
  input[type="range"] { accent-color: var(--ftc-red); width: 100%; }

  /* ---------- Icon wells ---------- */
  .ftc-icon-well { width: 40px; height: 40px; border-radius: 50%; background: var(--ftc-red-soft); color: var(--ftc-red); display: inline-flex; align-items: center; justify-content: center; flex: none; }
  .ftc-icon-well--danger { background: var(--ftc-urgent-soft); color: var(--ftc-urgent-deep); }

  /* ---------- Progress bar ---------- */
  .ftc-bar { height: 8px; border-radius: var(--ftc-radius-pill); background: var(--ftc-line); overflow: hidden; display: block; }
  .ftc-bar > span { display: block; height: 100%; background: var(--ftc-red); border-radius: inherit; }
  .ftc-bar--gold > span { background: var(--ftc-gold); }

  /* ---------- Timeline ---------- */
  .ftc-timeline { list-style: none; margin: 0; padding: 0; }
  .ftc-timeline li { position: relative; padding-inline-start: 28px; padding-bottom: 18px; }
  .ftc-timeline li::before { content: ""; position: absolute; inset-inline-start: 6px; top: 8px; bottom: -8px; width: 2px; background: var(--ftc-line); }
  .ftc-timeline li:last-child::before { display: none; }
  .ftc-timeline li::after { content: ""; position: absolute; inset-inline-start: 0; top: 6px; width: 14px; height: 14px; border-radius: 50%; background: var(--ftc-line); }
  .ftc-timeline li.is-done::after { background: var(--ftc-red); }
  .ftc-timeline li.is-done::before { background: var(--ftc-red); }
  .ftc-timeline li.is-current::after { background: var(--ftc-gold); box-shadow: 0 0 0 4px var(--ftc-gold-soft); }
  .ftc-timeline li.is-pending::after { background: var(--ftc-surface); border: 2px solid var(--ftc-line); }
  .ftc-timeline .tl-item b { font-weight: 600; }
  .ftc-timeline .tl-item .who { font-size: 12px; color: var(--ftc-ink-muted); }
  .ftc-timeline .ai-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--ftc-red-deep); background: var(--ftc-red-soft); border-radius: 999px; padding: 0 8px; line-height: 18px; margin-inline-start: 6px; }

  /* ---------- Notices ---------- */
  .ftc-notice { display: flex; gap: var(--ftc-space-3); padding: var(--ftc-space-3) var(--ftc-space-4); border-radius: var(--ftc-radius-md); background: var(--ftc-gold-soft); color: var(--ftc-gold-deep); font: 500 14px/22px var(--ftc-font-sans); }
  .ftc-notice > svg { flex: none; }
  .ftc-notice--danger { background: var(--ftc-urgent-soft); color: var(--ftc-urgent-deep); }
  .ftc-notice--ai { background: var(--ftc-red-soft); color: var(--ftc-red-deep); }

  /* ---------- Tables ---------- */
  .ftc-table { width: 100%; border-collapse: collapse; background: var(--ftc-surface); font: 400 14px/22px var(--ftc-font-sans); }
  .ftc-table th { text-align: start; font-weight: 600; color: var(--ftc-ink-muted); font-size: 12px; padding: 10px 12px; border-bottom: 1px solid var(--ftc-line); white-space: nowrap; }
  .ftc-table td { padding: 12px; border-bottom: 1px solid var(--ftc-line); vertical-align: middle; }
  .ftc-table tbody tr:last-child td { border-bottom: 0; }
  .ftc-table tr.is-selected td { background: var(--ftc-red-soft); }
  .ftc-table tr.is-plan td { background: var(--ftc-gold-soft); }
  .ftc-table.is-clickable tbody tr { cursor: pointer; }
  .ftc-table.is-clickable tbody tr:hover td { background: var(--ftc-paper); }
  .ftc-table.is-clickable tbody tr.is-selected:hover td { background: var(--ftc-red-soft); }
  .th-sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
  .th-sort[data-dir] { color: var(--ftc-ink); }
  .tablewrap { overflow-x: auto; }

  /* ---------- Admin shell ---------- */
  .ftc-admin { display: grid; grid-template-columns: var(--ftc-admin-sidebar) 1fr; min-height: 100vh; }
  .ftc-admin-sidebar { background: var(--ftc-ink); color: var(--ftc-on-ink); padding: 20px 14px; display: flex; flex-direction: column; gap: 4px; }
  .ftc-admin-sidebar a { height: 44px; border-radius: var(--ftc-radius-md); padding: 0 12px; display: flex; align-items: center; gap: 10px; color: var(--ftc-on-ink); font: 500 14px/1 var(--ftc-font-sans); }
  .ftc-admin-sidebar a[aria-current="page"] { background: var(--ftc-gold); color: var(--ftc-ink); font-weight: 700; }
  .ftc-admin-sidebar a:hover:not([aria-current]) { background: var(--ftc-on-ink-hover); color: var(--ftc-on-ink); }
  .ftc-admin-sidebar a .lbl { flex: 1; }
  .ftc-admin-sidebar a .count { font-size: 12px; color: var(--ftc-on-ink-muted); }
  .ftc-admin-sidebar a[aria-current="page"] .count { color: var(--ftc-ink); font-weight: 700; }
  .ftc-admin-sidebar .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px 18px; }
  .ftc-admin-sidebar .brand b { display: block; font: 700 16px/22px var(--ftc-font-display); }
  .ftc-admin-sidebar .brand small { display: block; font-size: 12px; line-height: 18px; color: var(--ftc-on-ink-muted); }
  .ftc-admin-sidebar .sb-user { margin-top: auto; border-top: 1px solid var(--ftc-on-ink-line); padding: 14px 4px 0; display: flex; align-items: center; gap: 10px; }
  .ftc-admin-sidebar .sb-user .who { flex: 1; min-width: 0; }
  .ftc-admin-sidebar .sb-user b { display: block; font: 600 14px/20px var(--ftc-font-sans); }
  .ftc-admin-sidebar .sb-user small { display: block; font-size: 12px; line-height: 16px; color: var(--ftc-on-ink-muted); }
  .ftc-admin-sidebar .sb-user .out { width: 36px; height: 36px; padding: 0; justify-content: center; flex: none; display: flex; align-items: center; border: 0; background: transparent; color: var(--ftc-on-ink); border-radius: var(--ftc-radius-md); cursor: pointer; }
  .ftc-admin-sidebar .sb-user .out:hover { background: var(--ftc-on-ink-hover); }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--ftc-gold); color: var(--ftc-ink); display: inline-flex; align-items: center; justify-content: center; font: 700 15px/1 var(--ftc-font-display); flex: none; }
  .ftc-admin-main { padding: var(--ftc-space-6) var(--ftc-space-8); min-width: 0; }

  /* ---------- Page atoms ---------- */
  .page { display: flex; flex-direction: column; gap: 20px; }
  .page-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .page-head .grow { flex: 1 1 260px; min-width: 0; }
  .page-head h1 { margin: 0; font: 700 26px/36px var(--ftc-font-display); }
  .page-head p { margin: 0; font-size: 14px; line-height: 22px; color: var(--ftc-ink-muted); }
  .search { height: 44px; flex: 0 1 280px; min-width: 200px; border-radius: var(--ftc-radius-md); background: var(--ftc-surface); border: 1px solid var(--ftc-line); display: flex; align-items: center; gap: 8px; padding: 0 12px; color: var(--ftc-ink-muted); }
  .search:focus-within { outline: 3px solid var(--ftc-gold); outline-offset: 2px; }
  .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 400 14px/22px var(--ftc-font-sans); color: var(--ftc-ink); }
  .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .kpis--auto { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
  .kpi { display: flex; flex-direction: column; gap: 4px; }
  .kpi .l { font-size: 13px; line-height: 20px; color: var(--ftc-ink-muted); }
  .kpi .d { font-size: 12px; line-height: 18px; font-weight: 600; }
  .kpi--md .ftc-metric { font-size: 28px; line-height: 34px; }
  .kpi .ftc-metric--urgent { color: var(--ftc-urgent); }
  .d--bad { color: var(--ftc-urgent-deep); }
  .d--good { color: var(--ftc-status-resolved); }
  .d--mute { color: var(--ftc-ink-muted); font-weight: 400 !important; }
  .mini-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .sec-title { margin: 0; font: 600 17px/26px var(--ftc-font-display); display: flex; align-items: center; gap: 8px; }
  .sec-sub { margin: 0; font-size: 12px; line-height: 18px; color: var(--ftc-ink-muted); }
  .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .score { display: inline-flex; width: 40px; height: 28px; border-radius: 8px; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex: none; font-variant-numeric: tabular-nums; }
  .score--urgent { background: var(--ftc-urgent); color: var(--ftc-on-red); }
  .score--high { background: var(--ftc-gold-soft); color: var(--ftc-gold-deep); }
  .score--low { background: var(--ftc-status-received-bg); color: var(--ftc-status-received); }
  .score--lg { width: 52px; height: 36px; font-size: 18px; }
  .row-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .stack { display: flex; flex-direction: column; }
  .g8 { gap: 8px; } .g12 { gap: 12px; } .g16 { gap: 16px; }
  .link { color: var(--ftc-red); font-weight: 600; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .btn-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn-split { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-split .ftc-btn { flex: 1; padding: 0 10px; }
  .kv { display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; font-size: 14px; line-height: 22px; margin: 0; }
  .kv dt { color: var(--ftc-ink-muted); }
  .kv dd { margin: 0; font-weight: 600; }
  .side-form { display: flex; flex-direction: column; gap: 12px; }
  .side-form .ftc-input, .side-form .ftc-select { min-height: 44px; font-size: 14px; }
  .side-form .ftc-textarea { min-height: 92px; font-size: 14px; line-height: 22px; }
  .fbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .fbar .ftc-select { width: auto; min-height: 36px; padding: 4px 12px; font-size: 14px; border-radius: 999px; }
  .hr0 { margin: 0; }

  /* ---------- Overview ---------- */
  .grid-b { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
  .grid-c { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 16px; align-items: start; }
  .grid-d { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .hbars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
  .hbars li { display: grid; grid-template-columns: 170px minmax(0, 1fr) 40px; align-items: center; gap: 12px; font-size: 14px; line-height: 22px; }
  .hbars .lbl { display: flex; align-items: center; gap: 6px; }
  .hbars .val { font-weight: 700; text-align: end; font-variant-numeric: tabular-nums; }
  .hbars .ftc-bar { height: 12px; }
  .stackbar { display: flex; height: 16px; border-radius: 999px; overflow: hidden; gap: 2px; background: var(--ftc-surface); }
  .stackbar span { display: block; height: 100%; }
  .seg--received { background: var(--ftc-status-received); }
  .seg--assigned { background: var(--ftc-status-assigned); }
  .seg--progress { background: var(--ftc-gold); }
  .seg--resolved { background: var(--ftc-status-resolved); }
  .legend-rows { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .legend-rows li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .legend-rows .n { margin-inline-start: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
  .legend-rows .p { width: 44px; text-align: end; color: var(--ftc-ink-muted); font-size: 12px; }
  .sla { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .sla li { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--ftc-line); }
  .sla li:last-child { border-bottom: 0; }
  .sla .t { flex: 1; min-width: 0; }
  .sla .t a { display: block; font-weight: 600; color: var(--ftc-ink); font-size: 14px; line-height: 22px; }
  .sla .t a:hover { color: var(--ftc-red); }
  .load { display: flex; align-items: center; gap: 8px; min-width: 120px; }
  .load .ftc-bar { flex: 1; }
  .mapprev { border-radius: var(--ftc-radius-md); overflow: hidden; border: 1px solid var(--ftc-line); position: relative; height: 300px; background: var(--ftc-map-ground); }
  .feed { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .feed li { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--ftc-line); font-size: 14px; line-height: 22px; }
  .feed li:last-child { border-bottom: 0; }
  .feed .ic { width: 32px; height: 32px; border-radius: 50%; background: var(--ftc-red-soft); color: var(--ftc-red); display: flex; align-items: center; justify-content: center; flex: none; }
  .feed .ic--ai { background: var(--ftc-gold-soft); color: var(--ftc-gold-deep); }
  .feed .ic--ok { background: var(--ftc-status-resolved-bg); color: var(--ftc-status-resolved); }
  .feed .ic--urgent { background: var(--ftc-urgent-soft); color: var(--ftc-urgent-deep); }
  .feed time { font-size: 12px; color: var(--ftc-ink-muted); white-space: nowrap; margin-inline-start: auto; padding-top: 2px; font-variant-numeric: tabular-nums; }

  /* ---------- Incidents queue ---------- */
  .inc-wrap { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
  .inc-table-card { flex: 999 1 520px; min-width: 0; background: var(--ftc-surface); border-radius: var(--ftc-radius-md); box-shadow: var(--ftc-shadow-card); overflow-x: auto; }
  .inc-table { min-width: 640px; }
  .inc-table th:first-child, .inc-table td:first-child { padding-inline-start: 16px; }
  .inc-table th:last-child, .inc-table td:last-child { padding-inline-end: 16px; }
  .inc-table .ttl { display: block; font-weight: 600; color: var(--ftc-ink); }
  .inc-table a.ttl:hover { color: var(--ftc-red); }
  .late-cell { color: var(--ftc-urgent-deep); font-weight: 600; }
  .inc-aside { flex: 1 1 340px; min-width: 0; max-width: 100%; background: var(--ftc-surface); border-radius: var(--ftc-radius-md); padding: 18px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--ftc-shadow-card); }
  .inc-aside .head { display: flex; gap: 12px; align-items: center; }
  .thumb { width: 64px; height: 64px; border-radius: 8px; background: var(--ftc-status-received); color: var(--ftc-icon-muted); flex: none; display: flex; align-items: center; justify-content: center; }
  .inc-aside h2 { margin: 0; font: 700 18px/26px var(--ftc-font-display); }
  .aibox { background: var(--ftc-red-soft); border-radius: var(--ftc-radius-md); padding: 12px; display: flex; flex-direction: column; gap: 6px; }
  .aibox .lab { display: inline-flex; align-items: center; gap: 6px; color: var(--ftc-red-deep); font-size: 12px; font-weight: 700; }
  .pf-head { display: flex; align-items: baseline; justify-content: space-between; }
  .pf-score { font: 700 28px/32px var(--ftc-font-display); }
  .pf-score small { font-size: 14px; color: var(--ftc-ink-muted); font-weight: 500; }
  .pf { display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 20px; }
  .pf-row { display: flex; align-items: center; gap: 8px; }
  .pf-row .nm { flex: 0 0 140px; }
  .pf-row .ftc-bar { flex: 1; }
  .pf-row .pts { flex: 0 0 32px; text-align: end; font-weight: 600; font-variant-numeric: tabular-nums; }
  .wo-sum { border-top: 1px solid var(--ftc-line); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; }
  .wo-sum label.mini { display: flex; flex-direction: column; gap: 4px; }

  /* ---------- Incident detail ---------- */
  .crumbs { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ftc-ink-muted); }
  .crumbs a { font-weight: 600; }
  .title-row { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px; }
  .title-row h1 { margin: 0; font: 700 26px/36px var(--ftc-font-display); }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 6px; font-size: 14px; line-height: 22px; color: var(--ftc-ink-muted); }
  .meta span { display: inline-flex; align-items: center; gap: 6px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
  .col { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  .photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .photo { margin: 0; border-radius: var(--ftc-radius-sm); overflow: hidden; background: var(--ftc-status-received); position: relative; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; color: var(--ftc-icon-muted); }
  .photo figcaption { position: absolute; inset-inline-start: 8px; bottom: 8px; background: rgba(22,22,22,.78); color: var(--ftc-on-red); font-size: 12px; line-height: 18px; padding: 2px 8px; border-radius: 999px; }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: stretch; }
  .ai { background: var(--ftc-red-soft); border-radius: var(--ftc-radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; color: var(--ftc-ink); }
  .ai .lab { display: inline-flex; align-items: center; gap: 6px; color: var(--ftc-red-deep); font: 700 12px/18px var(--ftc-font-sans); }
  .ai .opt { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 4px 10px; align-items: center; font-size: 14px; }
  .ai .opt .ftc-bar { grid-column: 1 / -1; background: var(--ftc-surface); }
  .ai .opt .pct { text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ai .opt.top .nm { font-weight: 700; }
  .ai .done { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ftc-status-resolved); background: var(--ftc-surface); border-radius: var(--ftc-radius-sm); padding: 8px 10px; }
  .score-big { display: flex; align-items: baseline; gap: 8px; }
  .score-big b { font: 700 44px/48px var(--ftc-font-display); color: var(--ftc-urgent); }
  .score-big b.is-mid { color: var(--ftc-gold-deep); }
  .score-big b.is-low { color: var(--ftc-ink-muted); }
  .score-big span { color: var(--ftc-ink-muted); font-weight: 500; }
  .factors { display: flex; flex-direction: column; gap: 14px; margin-top: 14px; }
  .factor { display: grid; grid-template-columns: minmax(150px, 230px) minmax(0, 1fr) 64px; gap: 4px 14px; align-items: center; }
  .factor .nm { font-size: 14px; font-weight: 600; line-height: 22px; }
  .factor .pts { text-align: end; font-weight: 700; font-variant-numeric: tabular-nums; font-size: 14px; }
  .factor .pts small { font-weight: 400; color: var(--ftc-ink-muted); }
  .factor .why { grid-column: 1 / -1; font-size: 12px; line-height: 18px; color: var(--ftc-ink-muted); margin-top: -2px; }
  .factor .ftc-bar { height: 10px; }
  .reason { margin-top: 14px; align-items: center; }
  .mapsnip { border-radius: var(--ftc-radius-sm); overflow: hidden; border: 1px solid var(--ftc-line); height: 220px; background: var(--ftc-map-ground); }
  .dup { border: 1.5px dashed var(--ftc-gold); background: var(--ftc-gold-soft); border-radius: var(--ftc-radius-md); padding: 14px; display: flex; flex-direction: column; gap: 10px; color: var(--ftc-gold-deep); }
  .dup .lab { display: inline-flex; align-items: center; gap: 6px; font: 700 12px/18px var(--ftc-font-sans); }
  .dup .box { background: var(--ftc-surface); border-radius: var(--ftc-radius-sm); padding: 10px 12px; color: var(--ftc-ink); font-size: 14px; line-height: 22px; }
  .dup .box a { font-weight: 700; }
  .cit-preview { background: var(--ftc-paper); border: 1px dashed var(--ftc-line); border-radius: var(--ftc-radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .cit-preview .ttl { font: 700 12px/18px var(--ftc-font-sans); color: var(--ftc-ink-muted); }
  .cit-preview .ftc-timeline li { padding-bottom: 0; }

  /* ---------- Map ---------- */
  .filters { display: grid; grid-template-columns: minmax(0, 2.2fr) repeat(3, minmax(0, 1fr)); gap: 14px 16px; align-items: end; }
  .filters .grp { display: flex; flex-direction: column; gap: 6px; }
  .filters .ftc-select { min-height: 40px; font-size: 14px; padding: 6px 12px; }
  .filters .lab { font: 600 13px/20px var(--ftc-font-sans); }
  .maplayout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
  .mapframe { position: relative; border-radius: var(--ftc-radius-lg); overflow: hidden; box-shadow: var(--ftc-shadow-card); background: var(--ftc-map-ground); border: 1px solid var(--ftc-line); }
  .mapframe .leaflet-container { width: 100%; height: clamp(420px, 66vh, 700px); font-family: var(--ftc-font-sans); background: var(--ftc-map-ground); }
  .legend { position: absolute; inset-inline: 14px; bottom: 34px; z-index: 1000; background: var(--ftc-surface); border-radius: var(--ftc-radius-md); box-shadow: var(--ftc-shadow-float); padding: 8px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; font-size: 13px; line-height: 20px; }
  .legend .t { font: 700 12px/18px var(--ftc-font-sans); color: var(--ftc-ink-muted); }
  .legend .it { display: flex; align-items: center; gap: 8px; }
  .zoom { position: absolute; inset-inline-end: 14px; top: 14px; z-index: 1000; display: flex; flex-direction: column; background: var(--ftc-surface); border-radius: var(--ftc-radius-sm); box-shadow: var(--ftc-shadow-float); overflow: hidden; }
  .zoom button { width: 40px; height: 40px; border: 0; background: transparent; font: 500 20px/1 var(--ftc-font-sans); cursor: pointer; color: var(--ftc-ink); }
  .zoom button:hover { background: var(--ftc-paper); }
  .zoom button + button { border-top: 1px solid var(--ftc-line); }
  .maptag { position: absolute; inset-inline-start: 50%; transform: translateX(50%); top: 14px; z-index: 1000; background: var(--ftc-surface); border-radius: 999px; padding: 4px 12px; font-size: 12px; color: var(--ftc-ink-muted); box-shadow: var(--ftc-shadow-card); }
  .sel .head { display: flex; gap: 12px; align-items: flex-start; }
  .sel h2 { margin: 0; font: 700 18px/26px var(--ftc-font-display); }
  .sel .why { margin: 12px 0; }
  .sum { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .sum li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .sum .n { margin-inline-start: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
  /* Leaflet markers (map container is dir="ltr", so physical left/top are safe here) */
  .ftc-divicon { background: transparent !important; border: 0 !important; }
  .ftc-pin { position: relative; width: 30px; height: 35px; }
  .ftc-pin svg { position: relative; z-index: 1; width: 100%; height: 100%; }
  .ftc-pin--lg { width: 41px; height: 48px; }
  .ftc-pin--critical::before, .ftc-pin.is-selected::before { content: ""; position: absolute; left: 50%; top: 0; width: 52px; height: 52px; margin-left: -26px; border-radius: 50%; background: var(--ftc-urgent-soft); }
  .ftc-pin.is-selected::before { background: var(--ftc-gold-soft); box-shadow: 0 0 0 3px var(--ftc-gold); }
  .ftc-pin__tag { position: absolute; z-index: 2; left: 50%; top: -26px; transform: translateX(-50%); height: 22px; padding: 0 10px; border-radius: 999px; background: var(--ftc-urgent); color: var(--ftc-on-red); font: 700 12px/22px var(--ftc-font-sans); white-space: nowrap; }
  .ftc-pin--near { opacity: .85; }
  .ftc-cluster { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; border-radius: 50%; background: var(--ftc-ink); color: var(--ftc-on-red); border: 3px solid var(--ftc-surface); box-shadow: 0 0 0 6px rgba(22,22,22,.14); font: 700 15px/1 var(--ftc-font-display); font-variant-numeric: tabular-nums; }
  .leaflet-tooltip.ftc-tip { background: var(--ftc-surface); color: var(--ftc-ink); border: 0; border-radius: var(--ftc-radius-sm); box-shadow: var(--ftc-shadow-card); font: 500 13px/20px var(--ftc-font-sans); padding: 6px 10px; }
  .leaflet-tooltip.ftc-tip::before { display: none; }

  /* ---------- Service requests ---------- */
  .sr-layout { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
  .type { display: flex; align-items: center; gap: 10px; }
  .type .ftc-icon-well { width: 36px; height: 36px; }
  .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .items li { display: flex; align-items: center; gap: 10px; background: var(--ftc-paper); border-radius: var(--ftc-radius-sm); padding: 8px 12px; font-size: 14px; }
  .items li svg { color: var(--ftc-status-resolved); }
  .cap { display: flex; flex-direction: column; gap: 6px; }

  /* ---------- Work orders ---------- */
  .board-wrap { position: relative; }
  .board { display: grid; grid-template-columns: repeat(4, minmax(240px, 1fr)); gap: 14px; overflow-x: auto; padding-bottom: 6px; }
  .colm { background: rgba(22,22,22,.04); border-radius: var(--ftc-radius-md); padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 520px; }
  .colm h2 { margin: 0; font: 600 15px/24px var(--ftc-font-display); display: flex; align-items: center; gap: 8px; }
  .colm h2 .n { margin-inline-start: auto; background: var(--ftc-surface); border-radius: 999px; padding: 0 10px; font-size: 13px; line-height: 22px; font-family: var(--ftc-font-sans); font-variant-numeric: tabular-nums; }
  .colm .dot { width: 10px; height: 10px; border-radius: 50%; }
  .colm .dot--open { background: var(--ftc-status-received); }
  .colm .dot--assigned { background: var(--ftc-status-assigned); }
  .colm .dot--progress { background: var(--ftc-gold); }
  .colm .dot--done { background: var(--ftc-status-resolved); }
  .colm .empty { margin: auto; text-align: center; font-size: 13px; color: var(--ftc-ink-muted); padding: 24px 8px; }
  .wo { background: var(--ftc-surface); border-radius: var(--ftc-radius-sm); box-shadow: var(--ftc-shadow-card); padding: 12px; display: flex; flex-direction: column; gap: 8px; border: 2px solid transparent; color: var(--ftc-ink); text-align: start; width: 100%; font: inherit; cursor: pointer; }
  .wo:hover { border-color: var(--ftc-line); }
  .wo.is-late { border-color: var(--ftc-urgent); }
  .wo.is-open { border-color: var(--ftc-gold); }
  .wo .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .wo .id { font-weight: 700; font-size: 14px; font-variant-numeric: tabular-nums; }
  .wo .t { font-weight: 600; font-size: 14px; line-height: 22px; }
  .wo .row { display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 18px; color: var(--ftc-ink-muted); }
  .wo .row svg { flex: none; }
  .wo .due { font-weight: 600; }
  .wo .due.late { color: var(--ftc-urgent-deep); }
  .wo a.inc { color: var(--ftc-red); font-weight: 600; }
  .tasks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
  .tasks li { display: flex; gap: 10px; align-items: center; }
  .tasks button.task { display: flex; gap: 10px; align-items: center; width: 100%; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: start; cursor: pointer; }
  .tasks .box { width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--ftc-line); display: flex; align-items: center; justify-content: center; flex: none; }
  .tasks .done .box { background: var(--ftc-status-resolved); border-color: var(--ftc-status-resolved); color: var(--ftc-on-red); }

  /* ---------- Budget ---------- */
  .budget-card { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; }
  .budget-top { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
  .budget-top label { font-size: 14px; font-weight: 600; }
  .budget-value { font: 700 30px/36px var(--ftc-font-display); color: var(--ftc-red-deep); }
  .budget-presets { display: flex; flex-wrap: wrap; gap: 8px; margin-inline-start: auto; }
  .budget-scale { display: flex; justify-content: space-between; font-size: 12px; color: var(--ftc-ink-muted); }
  .cover-bar { display: block; height: 6px; border-radius: 999px; background: var(--ftc-red-soft); }
  .cover-bar span { display: block; height: 6px; border-radius: 999px; background: var(--ftc-red); }
  .plan-grid { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
  .plan-col { flex: 1 1 380px; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .plan-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--ftc-gold); flex: none; }
  .plan-dot--out { background: none; border: 2px solid var(--ftc-ink-muted); }
  .plan-list { display: flex; flex-direction: column; gap: 10px; }
  .plan-row { display: flex; align-items: center; gap: 12px; border-radius: 8px; padding: 10px 12px; }
  .plan-row--in { background: var(--ftc-gold-soft); }
  .plan-row--out { border: 1px solid var(--ftc-line); }
  .plan-row .score { width: 36px; height: 26px; font-size: 13px; }
  .plan-row--in .score { background: var(--ftc-surface); color: var(--ftc-gold-deep); }
  .plan-row .t { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .plan-row .t a, .plan-row .t b { font-size: 14px; line-height: 22px; font-weight: 600; color: var(--ftc-ink); }
  .plan-row .t a:hover { color: var(--ftc-red); }
  .plan-row .t span { font-size: 12px; line-height: 18px; color: var(--ftc-ink-muted); }
  .plan-row--in .t span { color: var(--ftc-gold-deep); }
  .plan-row .cost { font-size: 14px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .plan-row--in .cost { font-weight: 700; }
  .plan-row--out .cost { color: var(--ftc-ink-muted); }
  .is-busy { opacity: .6; transition: opacity .15s; }

  /* ---------- Login ---------- */
  .login { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: 100vh; }
  .login-hero { background: var(--ftc-ink); color: var(--ftc-on-ink); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; position: relative; }
  .login-hero .top { padding: 40px 56px 0; }
  .login-hero .lockup { display: flex; align-items: center; gap: 12px; }
  .login-hero .lockup b { font: 700 20px/26px var(--ftc-font-display); }
  .login-hero h1 { margin: 56px 0 8px; font: 700 56px/68px var(--ftc-font-display); color: var(--ftc-on-red); }
  .login-hero p { margin: 0; max-width: 420px; font: 400 18px/32px var(--ftc-font-sans); color: var(--ftc-on-ink-muted); }
  .login-hero .skyline { width: 100%; height: auto; margin-top: 32px; }
  .login-hero .tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
  .login-hero .tags span { height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.2); font: 500 13px/28px var(--ftc-font-sans); color: var(--ftc-on-ink); }
  .login-form { display: flex; align-items: center; justify-content: center; padding: 40px 24px; }
  .login-form form { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 18px; }
  .login-form h2 { margin: 0; font: 700 28px/38px var(--ftc-font-display); }
  .login-form .sub { margin: 0; color: var(--ftc-ink-muted); font-size: 14px; line-height: 22px; }
  .login-form .ftc-input, .login-form .ftc-select { direction: ltr; text-align: start; }
  .login-form .ftc-select { direction: rtl; }
  .pw { position: relative; }
  .pw .ftc-input { padding-right: 48px; }
  .pw button { position: absolute; right: 4px; top: 2px; width: 44px; height: 44px; border: 0; background: transparent; color: var(--ftc-ink-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 8px; }
  .login-form .ftc-btn { height: 52px; font-size: 17px; }
  .login-form .row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
  .login-form .chk { align-items: center; font-size: 14px; }
  .staff-note { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: var(--ftc-radius-md); background: var(--ftc-gold-soft); color: var(--ftc-gold-deep); font: 500 14px/22px var(--ftc-font-sans); }

  /* ---------- State components (extensions built only from existing tokens) ---------- */
  .ftc-skel { display: block; background: var(--ftc-line); border-radius: var(--ftc-radius-sm); animation: ftc-pulse 1.3s ease-in-out infinite; }
  .ftc-skel--line { height: 14px; }
  .ftc-skel--title { height: 22px; width: 40%; }
  .ftc-skel--metric { height: 36px; width: 50%; }
  .ftc-skel--block { height: 120px; }
  @keyframes ftc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }

  .ftc-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 40px 16px; }
  .ftc-state h2 { margin: 0; font: 600 17px/26px var(--ftc-font-display); }
  .ftc-state p { margin: 0; max-width: 420px; font-size: 14px; line-height: 22px; color: var(--ftc-ink-muted); }

  .ftc-toasts { position: fixed; bottom: 24px; inset-inline-end: 24px; z-index: 2000; display: flex; flex-direction: column; gap: 8px; max-width: min(420px, calc(100vw - 32px)); }
  .ftc-toast { display: flex; align-items: flex-start; gap: 10px; background: var(--ftc-surface); border-radius: var(--ftc-radius-md); box-shadow: var(--ftc-shadow-float); padding: 12px 14px; border-inline-start: 4px solid var(--ftc-status-resolved); font-size: 14px; line-height: 22px; }
  .ftc-toast--error { border-inline-start-color: var(--ftc-urgent); }
  .ftc-toast--success svg { color: var(--ftc-status-resolved); }
  .ftc-toast--error svg { color: var(--ftc-urgent); }
  .ftc-toast button { margin-inline-start: auto; border: 0; background: none; color: var(--ftc-ink-muted); cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex: none; }

  .ftc-scrim { position: fixed; inset: 0; background: var(--ftc-scrim); z-index: 1500; }
  .ftc-modal-wrap { position: fixed; inset: 0; z-index: 1600; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .ftc-modal { position: relative; background: var(--ftc-surface); border-radius: var(--ftc-radius-lg); box-shadow: var(--ftc-shadow-float); width: 100%; max-width: 480px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
  .ftc-modal h2 { margin: 0; font: 600 22px/32px var(--ftc-font-display); }
  .ftc-modal p { margin: 0; font-size: 14px; line-height: 24px; }
  .ftc-modal .actions { display: flex; gap: 8px; justify-content: flex-start; flex-wrap: wrap; }

  .drawer { position: fixed; top: 0; bottom: 0; inset-inline-end: 0; z-index: 1600; width: 420px; max-width: 100%; background: var(--ftc-surface); box-shadow: var(--ftc-shadow-float); border-start-start-radius: var(--ftc-radius-md); border-end-start-radius: var(--ftc-radius-md); padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
  .drawer .close { width: 40px; height: 40px; border: 0; background: var(--ftc-paper); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--ftc-ink); cursor: pointer; flex: none; }

  /* ---------- Responsive ---------- */
  /* Desktop target is 1280-1440. Sticky sidebar only where it sits beside the content. */
  @media (min-width: 901px) {
    .ftc-admin-sidebar { position: sticky; top: 0; height: 100vh; align-self: start; overflow-y: auto; }   /* extension */
  }
  @media (max-width: 1200px) {
    .grid-b, .grid-c, .grid-d, .layout, .two, .maplayout, .sr-layout { grid-template-columns: minmax(0, 1fr); }
    .filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .filters .grp:first-child { grid-column: 1 / -1; }
  }
  @media (max-width: 1100px) {
    .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .ftc-admin-main { padding: var(--ftc-space-6); }
  }
  @media (max-width: 900px) {
    /* extension: the sidebar stacks above the content from 900px so a 768px tablet keeps full width */
    .ftc-admin { grid-template-columns: 1fr; }
    .ftc-admin-sidebar { flex-direction: row; flex-wrap: wrap; padding: 12px; gap: 6px; }
    .ftc-admin-sidebar .brand { width: 100%; padding: 0 4px 6px; }
    .ftc-admin-sidebar > a { flex: 1 1 calc(50% - 6px); min-width: 140px; }
    .ftc-admin-sidebar .sb-user { width: 100%; margin-top: 6px; }
    .login { grid-template-columns: 1fr; }
    .login-hero .top { padding: 28px 24px 0; }
    .login-hero h1 { font-size: 36px; line-height: 46px; margin-top: 24px; }
    .login-hero p { font-size: 16px; line-height: 28px; }
    .login-hero .tags { display: none; }
  }
  @media (max-width: 760px) {
    .ftc-admin-main { padding: 16px; }
    .page-head h1, .title-row h1 { font-size: 22px; line-height: 30px; }
    .kpis, .mini-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hbars li { grid-template-columns: 120px minmax(0, 1fr) 32px; gap: 8px; font-size: 13px; }
    .factor { grid-template-columns: minmax(0, 1fr) 56px; }
    .factor .ftc-bar { grid-column: 1 / -1; order: 3; }
    .factor .why { order: 4; }
    .photos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .legend { position: static; border-radius: 0; box-shadow: none; border-top: 1px solid var(--ftc-line); gap: 6px 14px; }
    .filters { grid-template-columns: minmax(0, 1fr); }
    .colm { min-height: 0; }
    .board { grid-template-columns: repeat(4, 260px); }
    .drawer { inset-inline: 0; width: 100%; border-radius: 0; }
    .ftc-toasts { inset-inline: 16px; bottom: 16px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ftc-skel, .ftc-spinner { animation: none; }
    .is-busy { transition: none; }
  }
}
```

Notes for the implementer:
- `.num` only sets tabular figures; the digits are Western because the data and `format.ts` produce them.
- Generic class names (`.page`, `.kv`, `.col`, `.two`, `.layout`, `.type`, `.items`, `.sel`, `.row`) are scoped by use; never reuse them for other meanings.
- `.sr-only` comes from Tailwind. Do not define it again.
- Clickable cards that are `<button class="wo">` and `<a class="wo">` must both work (the style resets the font and alignment).

---

## 2. Components

All components live in `apps/admin-web/src/components/ui/`, are function components, and use only the classes of section 1.2. `cx(...)` = a tiny class-name joiner (`clsx`). Types `IncidentStatus`, `Severity`, `CategoryId`, `Priority` come from the copied `@/domain/types`; `AdminIncident`, `WorkOrder`, … from `@/domain/admin-types`.

Shared state vocabulary used in every component below:
- **default / hover / focus-visible / active / disabled** for controls. Focus = global gold outline (never remove it). Disabled = `opacity .5`, `cursor:not-allowed`, `aria-disabled`.
- **loading** = skeleton (`.ftc-skel`) for blocks, `.ftc-spinner` inside buttons, `.is-busy` (opacity .6 + `aria-busy`) when refreshing data that is already on screen.
- **empty** = `EmptyState`. **error** = `ErrorState` with retry. **no-permission** = `ErrorState variant="forbidden"`.

### 2.1 Icon

```tsx
export type AdminIconName = IconName | 'grid' | 'truck' | 'wrench' | 'wallet' | 'logout' | 'eye' | 'eye-slash' | 'lock' | 'send' | 'merge' | 'list' | 'chevron-left';
type IconProps = { name: AdminIconName; size?: number /* default 20 */; className?: string; title?: string };
```

Markup: `<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden={!title} role={title ? 'img' : undefined}>` + one SVG child per shape. Shape tuples: `['p', d]` → `<path d>`, `['c', cx, cy, r]` → `<circle>`, `['r', x, y, w, h, rx]` → `<rect rx>`, `['e', cx, cy, rx, ry]` → `<ellipse>`. Icons in `FILLED_ICONS` (`more`, `play`) use `fill="currentColor" stroke="none"`. Icons in `DIRECTIONAL_ICONS` (`arrow-back`, `arrow-forward`, `chevron`) get `className="rtl:-scale-x-100"`; `chevron-left` is already drawn pointing left (the "go on" direction in RTL) and is never mirrored.

Copy `apps/mobile/src/components/icon-shapes.ts` to `components/ui/icon-shapes.ts` unchanged (all the app icons: home, map, camera, clipboard, user, bell, arrow-back, arrow-forward, chevron, chevron-down, alert-triangle, trash, tree, bulb, mic, play, pin, shield-check, wifi, users, share, check, plus, search, clock, zap, droplets, pipe, manhole, pothole, cone, paw, sidewalk, more, phone, sparkles, eye-off, whatsapp, x, image, locate, info, flame, calendar, refresh). Then add this file next to it (`admin-icon-shapes.ts`, reusing the same `p/c/r/e` helper functions) and merge: `const ALL = { ...ICON_SHAPES, ...ADMIN_EXTRA_SHAPES }`.

```ts
// Same grid (24x24) and stroke as the app icons. Paths taken from the admin mockups.
export const ADMIN_EXTRA_SHAPES: Record<string, readonly Shape[]> = {
  grid: [r(3, 3, 7, 7, 1), r(14, 3, 7, 7, 1), r(3, 14, 7, 7, 1), r(14, 14, 7, 7, 1)],
  truck: [p('M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2'), p('M15 18H9'),
          p('M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14'), c(17, 18, 2), c(7, 18, 2)],
  wrench: [p('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z')],
  wallet: [r(2, 6, 20, 12, 2), c(12, 12, 2.5)],                       // the "الميزانية" nav icon
  logout: [p('M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'), p('m16 17 5-5-5-5'), p('M21 12H9')],
  eye: [p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'), c(12, 12, 3)],
  'eye-slash': [p('M9.88 9.88a3 3 0 1 0 4.24 4.24'), p('M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68'),
                p('M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61'), p('M2 2l20 20')],
  lock: [r(3, 11, 18, 11, 2), p('M7 11V7a5 5 0 0 1 10 0v4')],
  send: [p('m22 2-7 20-4-9-9-4z'), p('M22 2 11 13')],
  merge: [c(18, 18, 3), c(6, 6, 3), p('M6 21V9a9 9 0 0 0 9 9')],
  list: [p('M8 6h13'), p('M8 12h13'), p('M8 18h13'), p('M3 6h.01'), p('M3 12h.01'), p('M3 18h.01')],
  'chevron-left': [p('m15 18-6-6 6-6')],
};
```

Icon usage map (name → where): `grid` nav نظرة عامة · `alert-triangle` nav البلاغات, SLA header, WO card incident row, danger notices, feed urgent rows, error messages · `map` nav الخريطة · `truck` nav طلبات الخدمات, "جدوِل العربية" button, WO card row for service requests · `wrench` nav أوامر الشغل, feed default rows, the WO card in incident detail · `wallet` nav الميزانية · `logout` sign-out · `search` search box · `eye`/`eye-slash` password toggle (`eye-slash` also in the photo blur notice) · `lock` staff note on login · `sparkles` AI labels and AI feed rows · `merge` duplicate card and ادمجهم button · `list` WO card department row · `users` reporters count and WO card team row · `pin` meta address · `clock` meta time · `calendar` WO due row · `camera` photos card header · `image` photo placeholders and thumbnails · `check` task done, SR items, resolved feed rows, toasts · `x` drawer/modal/toast close · `send` ابعت رسالة للمواطن · `chevron-left` "see more" links · `refresh` retry buttons · `shield-check` forbidden state · `info` neutral empty states · `trash` and `tree` service-type icons (bulky waste, tree maintenance) in the service requests table.

Pin glyphs (inside the map pin, not `Icon`): see 2.21.

### 2.2 Brand assets (copy to `public/brand/`)

`fixthecity-mark.svg` (used in the sidebar at 34px and on login at 48px, always `alt=""`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <title>FixTheCity mark</title>
  <path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill="#C8102E"/>
  <circle cx="32" cy="26.5" r="12.5" fill="#FFFFFF"/>
  <path d="M26 26.8l4.4 4.4 8-8.6" fill="none" stroke="#C8102E" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="50" cy="10" r="6.5" fill="#D4A20B"/>
</svg>
```

`cairo-skyline.svg` (login hero only, `alt=""`, intrinsic 390×150, scaled to 100% width): copy the file `docs/design/assets/cairo-skyline.svg` as is (2.3 KB, flag colours only).

### 2.3 AppShell and Sidebar

```tsx
type AppShellProps = { children: React.ReactNode };            // wraps every route except /login
```

Behaviour: `useSession()`; no session → redirect `/login`. While the session is being read from storage render a full-page skeleton (the `.ftc-admin` grid with an ink sidebar holding 6 `ftc-skel` bars and a `page` with a title skeleton). Nav counts come from `GET /admin/dashboard?range=7d` (`nav.incidentsOpen`, `nav.serviceRequestsOpen`), React Query key `['dashboard','7d']`, refetch every 60 s; while loading or on error the count `<span>` is simply not rendered.

```tsx
<div className="ftc-admin">
  <a href="#main" className="sr-only focus:not-sr-only">اقفز للمحتوى</a>            {/* extension: skip link; when focused it needs ftc-btn ftc-btn--gold ftc-btn--sm classes */}
  <nav className="ftc-admin-sidebar" aria-label="قائمة مركز القيادة">
    <div className="brand">
      <img src="/brand/fixthecity-mark.svg" alt="" width={34} height={34} />
      <span><b>FixTheCity</b><small>{session.district}</small></span>          {/* "القاهرة · حي مدينة نصر أول" */}
    </div>
    {items.map((it) => (
      <Link key={it.href} href={it.href} aria-current={isActive(it.href) ? 'page' : undefined}>
        <Icon name={it.icon} size={20} /><span className="lbl">{it.label}</span>
        {it.count != null && <span className="count">{formatNumber(it.count)}</span>}
      </Link>
    ))}
    <div className="sb-user">
      <span className="avatar" aria-hidden="true">{nameInitial(session.name)}</span>
      <span className="who"><b>{session.name}</b><small>{session.title}</small></span>
      <button type="button" className="out" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={signOut}><Icon name="logout" size={18} /></button>
    </div>
  </nav>
  <main className="ftc-admin-main" id="main"><div className="page">{children}</div></main>
</div>
```

Nav items in order (label · href · icon · count): `نظرة عامة` `/` `grid` · `البلاغات` `/incidents` `alert-triangle` `incidentsOpen` · `الخريطة` `/map` `map` · `طلبات الخدمات` `/service-requests` `truck` `serviceRequestsOpen` · `أوامر الشغل` `/work-orders` `wrench` · `الميزانية` `/budget` `wallet` (**only when `session.role === 'admin'`**).

`isActive`: `/` only on exact `/`; others when `pathname === href || pathname.startsWith(href + '/')` (so `/incidents/INC-501` highlights البلاغات).
`nameInitial(name)`: strip a leading `م. ` then take the first character (`سارة محمود` → `س`, `م. هشام عادل` → `ه`).
`signOut`: clear token + session, clear the React Query cache, `router.replace('/login')`.
States: item hover (translucent white, from CSS), active (gold with ink text), focus (gold outline), sign-out hover. At ≤900px the sidebar becomes a wrapped block above the content (CSS only).

### 2.4 PageHead

```tsx
type PageHeadProps = {
  title: string;
  subtitle?: React.ReactNode;           // grey 14px line under the title
  actions?: React.ReactNode;            // chip groups / buttons, placed before the search box
  search?: { value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string; ariaLabel: string };
};
```
```tsx
<header className="page-head">
  <div className="grow"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
  {actions}
  {search && (
    <label className="search">
      <Icon name="search" size={18} />
      <input aria-label={search.ariaLabel} placeholder={search.placeholder} value={search.value}
             onChange={(e) => search.onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search.onSubmit?.()} />
    </label>
  )}
</header>
```
Set `document.title` per page (section 3 gives each title). Loading state for the subtitle: a `ftc-skel ftc-skel--line` 40% wide.

### 2.5 KpiCard

```tsx
type KpiCardProps = {
  label: string; value: React.ReactNode; valueTone?: 'default' | 'urgent';
  note?: React.ReactNode; noteTone?: 'bad' | 'good' | 'mute'; size?: 'lg' | 'md'; footer?: React.ReactNode; loading?: boolean;
};
```
```tsx
<div className={cx('ftc-card kpi', size === 'md' && 'kpi--md')}>
  <span className="l">{label}</span>
  <span className={cx('ftc-metric num', valueTone === 'urgent' && 'ftc-metric--urgent')}>{value}</span>
  {note && <span className={cx('d', `d--${noteTone ?? 'mute'}`)}>{note}</span>}
  {footer}
</div>
```
`loading`: same card with `<span className="ftc-skel ftc-skel--line" style={{width:'55%'}}/>`, `<span className="ftc-skel ftc-skel--metric"/>` and a short skeleton line. Signed numbers inside `note` use `<Delta value={14} />` which renders `<bdi dir="ltr">+14</bdi>` (the minus is `−` U+2212, zero is `0`) so the sign stays left of the digits in RTL.

### 2.6 StatusChip, Tag, ScoreBadge

```tsx
type StatusChipProps =
  | { kind: 'incident'; status: IncidentStatus }       // وصل / اتصنّف / اتحوّل / جاري التنفيذ / اتصلّح / اتقفل
  | { kind: 'workorder'; status: WorkOrderStatus }     // اتسلّم / اتوزّع / شغالين عليه / اتحلّت
  | { kind: 'critical' }                               // خطر (filled urgent)
  | { kind: 'priority'; score: number; levelOnly?: boolean };   // "أولوية عالية · 78" or, with levelOnly, "أولوية عالية"
```
Output `<span className={`ftc-chip ftc-chip--${tone}`}>{label}</span>`. Mapping (single source, export it as `STATUS_CHIP`):

| value | class | label |
| --- | --- | --- |
| incident received, triaged | `received` | `وصل`, `اتصنّف` |
| incident assigned | `assigned` | `اتحوّل` |
| incident in_progress | `progress` | `جاري التنفيذ` |
| incident resolved, closed | `resolved` | `اتصلّح`, `اتقفل` |
| workorder open | `received` | `اتسلّم` |
| workorder assigned | `assigned` | `اتوزّع` |
| workorder in_progress | `progress` | `شغالين عليه` |
| workorder done | `resolved` | `اتحلّت` |
| critical | `critical` | `خطر` |
| priority ≥85 | `critical` | `أولوية عاجلة · {score}` |
| priority 65–84 | `progress` | `أولوية عالية · {score}` |
| priority 40–64 | `received` | `أولوية متوسطة · {score}` |
| priority <40 | `received` | `أولوية عادية · {score}` |

The chip dot is drawn by CSS `::before`. Test requirement (Task 5): every status renders its Arabic word and its class.

```tsx
type TagProps = { tone: 'danger' | 'gold' | 'muted' | 'ext'; children: React.ReactNode };   // .ftc-tag-danger | -gold | -muted | -ext
```
`danger` = the `خطر` word, lateness (`متأخر يومين`, `باقي 5 س`) and overdue counts. `gold` = priority tag in the WO drawer (`أولوية عالية · 66`) and "داخل الخطة". `muted` = medium/low priority tag. `ext` = `جهة خارجية`.

```tsx
type ScoreBadgeProps = { score: number; size?: 'md' | 'lg' };
// className: `score score--${score >= 85 ? 'urgent' : score >= 65 ? 'high' : 'low'}` + (lg → ' score--lg'); aria-label={`الأولوية ${score} من 100`}
```

### 2.7 FilterChip (and chip groups)

```tsx
type FilterChipProps = { label: string; pressed: boolean; onClick: () => void; count?: number; disabled?: boolean };
<button type="button" className="ftc-filter" aria-pressed={pressed} onClick={onClick} disabled={disabled}>
  {label}{count != null && <span className="c">{formatNumber(count)}</span>}
</button>
```
Groups: `<div className="chips" role="group" aria-label="…">`. Two modes: *single choice* (range tabs, queue views, department filter: clicking selects it, the others get `aria-pressed=false`) and *multi toggle* (map status filters). States: default white with line border, hover darker border, pressed red with white text, focus gold outline, disabled 50%.

### 2.8 Form fields: TextField, SelectField, TextArea, Checkbox

All wrap `.ftc-field`: label above (`.ftc-label`), optional `.ftc-help`, error `.ftc-error`. When `error` is set add `has-error` to `.ftc-field`, set `aria-invalid` and `aria-describedby={id + '-msg'}` on the control, and render `<span className="ftc-error" id={id+'-msg'} role="alert"><Icon name="alert-triangle" size={14}/>{error}</span>` (it replaces the help text).

```tsx
type FieldBase = { id: string; label: string; help?: string; error?: string; hideLabel?: boolean /* sr-only label */; disabled?: boolean };
type TextFieldProps = FieldBase & { value: string; onChange: (v: string) => void; type?: 'text'|'email'|'password'|'date'; placeholder?: string; autoComplete?: string; readOnly?: boolean; dir?: 'ltr'|'rtl'; required?: boolean };
type SelectFieldProps = FieldBase & { value: string; onChange: (v: string) => void; options: { value: string; label: string; disabled?: boolean }[]; variant?: 'field' | 'pill' };
type TextAreaProps = FieldBase & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; placeholder?: string };
type CheckboxProps = { id: string; label: React.ReactNode; checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean };
```
- `SelectField variant="pill"` renders a bare `<select className="ftc-select">` (inside `.fbar` it becomes the pill-shaped filter select; its label is sr-only).
- `TextArea` with `maxLength` shows `<span className="ftc-count num">{value.length} / {maxLength}</span>` under the control.
- `Checkbox` = `<label className="chk"><input type="checkbox" …/><span>{label}</span></label>`.
- Disabled/read-only: paper background, muted text.
- Heights: field controls 48px; inside `.side-form` 44px with 14px text.

### 2.9 Button

```tsx
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'gold' | 'ghost';   // default primary
  size?: 'md' | 'sm'; block?: boolean; loading?: boolean; icon?: AdminIconName; href?: string /* renders <Link> with the same classes */;
};
// className = cx('ftc-btn', `ftc-btn--${variant}`, size==='sm' && 'ftc-btn--sm', block && 'ftc-btn--block', loading && 'is-loading')
// children = (loading ? <span className="ftc-spinner" aria-hidden /> : icon && <Icon name={icon} size={size==='sm'?16:20}/>) + label
```
States: primary red → hover red-deep; secondary white with red border → hover red-soft; gold (ink text, never white) → hover gold-pressed; ghost → hover paper; disabled 50%; loading shows the spinner, keeps its width, ignores clicks, `aria-busy`. Use `variant="primary"` for exactly one main action per card.

### 2.10 Card and CardHead

```tsx
type CardProps = { children: React.ReactNode; className?: string; padded?: boolean /* default true; false = padding 0 for tables */; as?: 'section'|'aside'|'div'; labelledBy?: string; style?: React.CSSProperties };
type CardHeadProps = { id?: string; title: React.ReactNode; subtitle?: React.ReactNode; icon?: AdminIconName; action?: React.ReactNode };
<div className="card-head"><div><h2 className="sec-title" id={id}>{icon && <Icon name={icon}/>}{title}</h2>{subtitle && <p className="sec-sub">{subtitle}</p>}</div>{action}</div>
```
`Card` = `<section className="ftc-card" aria-labelledby>`. Selected-card variant (map): `style={{ border: '2px solid var(--ftc-gold)' }}`.

### 2.11 DataTable

```tsx
type Column<T> = {
  id: string; header: React.ReactNode; cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => number | string;          // present = header is a sort button
  className?: string; nowrap?: boolean;
};
type DataTableProps<T> = {
  ariaLabel: string; columns: Column<T>[]; rows: T[]; getRowId: (r: T) => string;
  selectedId?: string | null; onSelect?: (r: T) => void;
  sort?: { id: string; dir: 'asc' | 'desc' }; onSortChange?: (s: { id: string; dir: 'asc' | 'desc' } | undefined) => void;
  rowClassName?: (r: T) => string | undefined;       // e.g. 'is-plan'
  loading?: boolean; skeletonRows?: number;          // default 6
  empty?: React.ReactNode;                           // an EmptyState element
  minWidth?: number;                                 // inline min-width on the table (640)
  tableClassName?: string;                           // e.g. 'inc-table', 'sr-table'
};
```
```tsx
<div className="tablewrap">
  <table className={cx('ftc-table', onSelect && 'is-clickable', tableClassName)} style={{ minWidth }} aria-label={ariaLabel}>
    <thead><tr>{columns.map(c => <th key={c.id} scope="col" aria-sort={sorted ? (dir==='asc'?'ascending':'descending') : c.sortValue ? 'none' : undefined}>
      {c.sortValue ? <button type="button" className="th-sort" data-dir={sorted ? dir : undefined} onClick={…}>{c.header}<Icon name="chevron-down" size={14} className={dir==='asc' ? 'rotate-180' : ''}/></button> : c.header}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={id} tabIndex={onSelect ? 0 : undefined} aria-selected={onSelect ? selected : undefined}
        className={cx(selected && 'is-selected', rowClassName?.(r))} onClick={() => onSelect?.(r)}
        onKeyDown={(e) => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onSelect?.(r); } if (e.key==='ArrowDown') focusSibling(e, 1); if (e.key==='ArrowUp') focusSibling(e, -1); }}>…</tr>)}</tbody>
  </table>
</div>
```
Sorting is client-side: first click ascending, second descending, third returns to the server order (`onSortChange(undefined)`). A link or button inside a row must call `e.stopPropagation()` so it does not also select the row. States: header default muted 12px/600; sorted header ink; row hover paper (clickable tables); selected row red-soft; focus gold outline on the row; `loading` renders `skeletonRows` rows of `ftc-skel ftc-skel--line` cells; `empty` replaces the `<tbody>` rows with one `<tr><td colSpan>` holding the empty element. Tests: sorting toggles, selected row class, Enter selects.

### 2.12 PriorityBreakdown

```tsx
type PriorityBreakdownProps = {
  priority: Priority; variant: 'full' | 'compact';
  whyByKey?: Record<string, string>;            // 'full' only: one reason line per factor (section 4.4 factorWhy)
  labelByKey?: Record<string, string>;          // 'compact' only: short labels (section 4.4 shortFactorLabel)
  reason?: string;                              // 'full': the notice text (priorityReason)
};
```
**full** (incident detail, section "سبب الأولوية"):
```tsx
<>
  <div className="score-big" aria-label={`الأولوية ${score} من 100`}>
    <b className={cx('num', level==='medium' && 'is-mid', level==='low' && 'is-low')}>{score}</b><span>/ 100</span>
    <StatusChip kind="priority" score={score} levelOnly />   {/* margin-inline-start: 8px */}
  </div>
  {reason && level !== 'low' && <div className={cx('ftc-notice reason', score >= 65 && 'ftc-notice--danger')}><Icon name="alert-triangle" size={20}/><span>{reason}</span></div>}
  <div className="factors">
    {factors.map(f => <div className="factor" key={f.key}>
      <span className="nm">{f.label}</span>
      <span className="ftc-bar" role="img" aria-label={`${f.points} من ${f.max}`}><span style={{ width: `${f.points / f.max * 100}%` }} /></span>
      <span className="pts">+{f.points} <small>/ {f.max}</small></span>
      <span className="why">{whyByKey?.[f.key]}</span>
    </div>)}
  </div>
</>
```
`score-big b` colour: ≥65 urgent (default), 40–64 gold-deep (`is-mid`), <40 ink-muted (`is-low`).
**compact** (incidents side panel): `<div className="pf-head"><span className="strong small">سبب الأولوية</span><span className="pf-score num">{score}<small> / 100</small></span></div>` then `<div className="pf">` with one `.pf-row` per factor: `<span className="nm">{short label}</span><span className="ftc-bar" style={{background:'var(--ftc-paper)'}}><span style={{width}}/></span><span className="pts">+{points}</span>`.
Invariant tested in Task 5: the displayed `+N` values sum to `score` (capped at 100).

### 2.13 Timeline

```tsx
type TimelineItem = { id: string; title: React.ReactNode; who?: React.ReactNode; body?: React.ReactNode; state?: 'done' | 'current' | 'pending' | 'plain'; ai?: boolean };
type TimelineProps = { items: TimelineItem[] };
<ol className="ftc-timeline">{items.map(i => <li key={i.id} className={i.state && i.state !== 'plain' ? `is-${i.state}` : undefined}>
  <div className="tl-item"><b>{i.title}</b>{i.ai && <span className="ai-tag"><Icon name="sparkles" size={12}/>اقتراح</span>}
  {i.who && <div className="who">{i.who}</div>}{i.body && <div className="small">{i.body}</div>}</div></li>)}</ol>
```
`done` red dot + red connector, `current` gold dot with gold-soft ring, `pending` hollow dot. Dates inside `who` are wrapped `<span className="num">`. Empty list → render nothing (the parent shows an EmptyState text).

### 2.14 HBarChart and StackBar

```tsx
type HBarRow = { key: string; label: React.ReactNode; value: number; danger?: boolean };
type HBarChartProps = { rows: HBarRow[]; ariaLabel: string };
<ul className="hbars" aria-label={ariaLabel}>{rows.map(r => <li key={r.key}>
  <span className="lbl">{r.label}{r.danger && <span className="ftc-tag-danger">خطر</span>}</span>
  <span className="ftc-bar" aria-hidden="true"><span style={{ width: `${pct(r.value)}%` }} /></span>
  <span className="val">{formatNumber(r.value)}</span></li>)}</ul>
```
`pct = value / max(rows.value) * 100`, minimum 3% when value > 0 so a bar is always visible. No Recharts is needed for these two (label and value are always visible text). If the team prefers Recharts elsewhere it must be styled with these exact tokens.

```tsx
type StackSegment = { key: 'received' | 'assigned' | 'progress' | 'resolved'; value: number };
type StackBarProps = { segments: StackSegment[]; ariaLabel: string };      // e.g. "وصل 44، اتحوّل 31، جاري التنفيذ 53"
<div className="stackbar" role="img" aria-label={ariaLabel}>{segments.filter(s => s.value > 0).map(s => <span key={s.key} className={`seg--${s.key}`} style={{ width: `${s.value / total * 100}%` }} />)}</div>
```
`LegendRows` = `<ul className="legend-rows">` with `<li><StatusChip …/><span className="n">{value}</span><span className="p">{percent}%</span></li>`.

### 2.15 Drawer

```tsx
type DrawerProps = { open: boolean; onClose: () => void; titleId: string; ariaLabel: string; children: React.ReactNode };
```
Renders (in a portal to `document.body`) `<div className="ftc-scrim" aria-hidden onClick={onClose}/>` and `<aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-label={ariaLabel}>`. Behaviour: on open focus the close button; trap Tab inside; `Esc` closes; on close return focus to the element that opened it; lock body scroll while open. The header row inside is `<div className="row-between" style={{alignItems:'flex-start'}}><div><h2 className="sec-title" id={titleId} style={{fontSize:22,lineHeight:'32px'}}>…</h2><p className="sec-sub">…</p></div><button className="close" aria-label="اقفل" onClick={onClose}><Icon name="x"/></button></div>`. At ≤760px it fills the width. Tests: Esc closes, focus trap.

### 2.16 Modal and ConfirmModal

```tsx
type ModalProps = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; actions: React.ReactNode; dismissible?: boolean /* default true; false while busy */ };
type ConfirmModalProps = { open: boolean; title: string; body: React.ReactNode; confirmLabel: string; cancelLabel?: string /* default "إلغاء" */; busy?: boolean; onConfirm: () => void; onCancel: () => void };
<div className="ftc-scrim" onClick={dismissible ? onClose : undefined} />
<div className="ftc-modal-wrap"><div className="ftc-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">{title}</h2>{children}
  <div className="actions">{actions}</div></div></div>
```
`ConfirmModal` actions: `<Button variant="primary" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>` then `<Button variant="ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>` (primary first = at the start/right in RTL). Same focus handling as Drawer (focus the confirm button first). `Esc` = cancel (ignored while busy).

### 2.17 Toast

```tsx
type ToastApi = { success: (msg: string) => void; error: (msg: string) => void };
export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element;
export function useToast(): ToastApi;
<div className="ftc-toasts" aria-live="polite">{toasts.map(t =>
  <div key={t.id} className={`ftc-toast ftc-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
    <Icon name={t.kind === 'error' ? 'alert-triangle' : 'check'} size={20} /><span>{t.msg}</span>
    <button type="button" aria-label="اقفل" onClick={() => dismiss(t.id)}><Icon name="x" size={16} /></button></div>)}</div>
```
Success auto-dismisses after 5 s, error after 8 s; pause on hover/focus; max 3 visible (oldest dropped). Position: bottom, at the inline-end (the left in RTL, away from the sidebar). Mount the provider once in the root layout inside a client `Providers` component together with React Query.

### 2.18 Notice, CitizenPreview, EmptyState, ErrorState, Skeletons

```tsx
type NoticeProps = { tone?: 'gold' | 'danger' | 'ai'; icon?: AdminIconName; children: React.ReactNode; className?: string };
<div className={cx('ftc-notice', tone==='danger' && 'ftc-notice--danger', tone==='ai' && 'ftc-notice--ai', className)}>{icon && <Icon name={icon} size={20}/>}<span>{children}</span></div>
```
```tsx
// What the citizen will read in their tracking timeline. Shown live under every status-change note field.
type CitizenPreviewProps = { status: IncidentStatus; note: string };
<div className="cit-preview" aria-live="polite">
  <span className="ttl">هيظهر للمواطن كده</span>
  <ol className="ftc-timeline"><li className="is-current"><div className="tl-item">
    <StatusChip kind="incident" status={status} /> <div className="who">دلوقتي</div>
    <div className="small">{note.trim() || 'اكتب الرسالة وهتظهر هنا'}</div></div></li></ol>
</div>
```
(The chip is the citizen-visible *incident* status the change produces. For a work-order change: `in_progress` → `جاري التنفيذ`, `done` → `اتصلّح`, `open`/`assigned` → `اتحوّل`.)

```tsx
type EmptyStateProps = { icon?: AdminIconName; title: string; message?: string; action?: React.ReactNode };
<div className="ftc-state"><span className="ftc-icon-well"><Icon name={icon ?? 'info'} size={20}/></span><h2>{title}</h2>{message && <p>{message}</p>}{action}</div>
type ErrorStateProps = { variant?: 'error' | 'forbidden' | 'notfound'; title?: string; message?: string; onRetry?: () => void; action?: React.ReactNode };
```
`ErrorState` defaults: **error** → icon `alert-triangle` in `ftc-icon-well ftc-icon-well--danger`, title `حصلت مشكلة وإحنا بنحمّل البيانات`, message = the API `detail` or `اتأكد من النت وجرّب تاني.` (no connection: `مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.`), button `<Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>جرّب تاني</Button>`. **forbidden** → icon `shield-check`, title `مش مسموح`, message `الصفحة دي مش متاحة لحسابك.`. **notfound** → icon `search`, title `مش موجود`, message `ممكن يكون اتمسح أو الرقم غلط.`, action link `ارجع للقائمة`. Inside a `Card` for section-level errors; centred in the page for page-level errors.

```tsx
export function Skeleton(props: { variant: 'line' | 'title' | 'metric' | 'block'; width?: string | number; height?: number }): JSX.Element;   // <span className="ftc-skel ftc-skel--{variant}" aria-hidden />
export function SkeletonTable(props: { rows?: number; cols: number }): JSX.Element;
```
Wrap skeleton regions in `aria-busy="true"` and add a visually hidden `<span className="sr-only">جاري التحميل…</span>`.

### 2.19 StatusChangeForm (shared by incident detail, incidents panel, service requests, work-order drawer)

This is the most important form in the product: the note is what citizens read.

```tsx
type StatusOption = { value: string; label: string };
type StatusChangeFormProps = {
  kind: 'incident' | 'workorder' | 'service';
  currentStatus: string;                       // option value of the current status
  options: StatusOption[];                     // already filtered/ordered by the caller
  defaultStatus?: string;                      // next logical status (default: currentStatus)
  previewStatusFor: (value: string) => IncidentStatus;   // which citizen-visible status the chip preview shows
  submitLabel?: string;                        // default "حدّث الحالة وابلّغ المواطنين"
  citizensCount?: number;                      // for the (disabled) WhatsApp/SMS checkbox label
  disabledReason?: string;                     // staff of another department: render the form disabled + this notice
  compact?: boolean;                           // panel/drawer: textarea 2 rows, no help text, no templates
  onSubmit: (v: { status: string; note: string }) => Promise<void>;   // throws → form shows toast.error(detail)
};
```
Markup (full):
```tsx
<form className="side-form" noValidate onSubmit={…}>
  <SelectField id="st" label="الحالة الجديدة" options={options} value={status} onChange={…} error={statusError} />
  <TextArea id="note" label="رسالة للمواطنين" value={note} onChange={…} maxLength={500} error={noteError}
            help="بتظهر في تتبع البلاغ. اكتبها قصيرة وفيها اللي هيحصل بعد كده." />
  {!note && <div className="chips" role="group" aria-label="رسايل جاهزة">{templates.map(t => <button type="button" className="ftc-filter" onClick={() => setNote(t)}>{t}</button>)}</div>}
  <CitizenPreview status={previewStatusFor(status)} note={note} />
  <Checkbox id="notify" checked disabled label={`ابعتها للـ ${citizensCount} مواطنين على واتساب (أو SMS)`} />   {/* only if citizensCount; see 0.2 */}
  <Button type="submit" block loading={busy}>حدّث الحالة وابلّغ المواطنين</Button>
</form>
```
Validation (on submit and on blur of the note): note trimmed empty → `اكتب رسالة للمواطنين` (same words as the backend 400); status equals current → `اختار حالة غير الحالة الحالية`. Submit is never silently disabled: it shows the messages and moves focus to the first invalid field. While busy the controls are disabled. On success: the caller shows the toast, the form resets (`note=''`, `status=` the new current). On `400`/`403`/`409` from the API: `toast.error(detail)`, the form keeps its values.
Quick message templates (extension; shown only while the note is empty; keyed by target status): `received`/`triaged` → `استلمنا بلاغكم وبنراجعه.` · `assigned` → `اتحوّل للجهة المسؤولة وهيتابعوا معاكم قريب.` · `in_progress` → `الفريق بدأ الشغل في الموقع. هنبلّغكم أول ما نخلّص.` · `resolved` → `اتصلّح المكان. لو لسه فيه مشكلة بلّغونا تاني.` · `closed` → `اتقفل البلاغ ده. شكرًا لتعاونكم.` For work orders map `open`→`assigned` template, `assigned`→`assigned`, `in_progress`→`in_progress`, `done`→`resolved`.
`disabledReason` set: all controls `disabled`, a `Notice tone="gold"` above the form with the reason, no submit button.

### 2.20 AiSuggestionCard and DuplicateCard

```tsx
type AiSuggestionCardProps = {
  triage: NonNullable<AdminIncident['triage']>;     // { options[], severity, summary, source, confirmed }
  reviewedBy?: string; reviewedAt?: string;
  canAct: boolean;                                   // false for staff of another department
  onConfirm: () => Promise<void>;                    // POST /admin/incidents/{id}/triage/confirm { categoryId: options[0].categoryId, severity: triage.severity }
  onChange: (v: { categoryId: CategoryId; severity: Severity }) => Promise<void>;   // same endpoint with the chosen values
};
```
```tsx
<section className="ai" aria-labelledby="h-ai">
  <span className="lab" id="h-ai"><Icon name="sparkles" size={16}/>اقتراح الذكاء الاصطناعي</span>
  <div className="stack g12">{triage.options.slice(0,3).map((o,i) => <div key={o.categoryId} className={cx('opt', i===0 && 'top')}>
    <span className="nm">{i===0 ? `${label(o.categoryId)} · ${SEVERITY_AI_AR[triage.severity]}` : label(o.categoryId)}</span>
    <span className="pct">{pct}%</span>
    <span className="ftc-bar" role="img" aria-label={i===0 ? `ثقة ${pct}%` : `${pct}%`}><span style={{width:`${pct}%`}}/></span></div>)}</div>
  <p className="small" style={{margin:0}}>{triage.summary}</p>
  <p className="mini" style={{margin:0, color:'var(--ftc-red-deep)'}}>ده اقتراح بس. القرار ليك.</p>
  {triage.confirmed ? <div className="done"><Icon name="check" size={16}/>اتأكّد بواسطة {reviewedBy} · {formatWhen(reviewedAt)}</div>
   : canAct && <div className="btn-split"><Button size="sm" onClick={onConfirm}>أكّد التصنيف</Button><Button size="sm" variant="secondary" onClick={openChangeModal}>غيّر التصنيف</Button></div>}
  {triage.source === 'fallback' && <p className="mini" style={{margin:0}}>اقتراح بالكلمات المفتاحية، مش من نموذج ذكاء اصطناعي.</p>}
</section>
```
`pct = Math.round(confidence * 100)`. `SEVERITY_AI_AR`: low `خطورة بسيطة`, medium `خطورة متوسطة`, high `خطورة عالية`, critical `خطورة حرجة` (the chip word for critical stays `خطر`; this longer phrase is only for the AI line). The "change" button opens a `Modal` titled `غيّر التصنيف` with a `SelectField` `النوع` (the 12 category labels from `CATEGORIES`, preselected = top option) and a `SelectField` `الخطورة` (`خطورة بسيطة` / `خطورة متوسطة` / `خطورة عالية` / `خطر` for low/medium/high/critical, preselected = triage.severity), actions `احفظ التصنيف` (primary) and `إلغاء`. States: default, busy (buttons loading), confirmed (buttons replaced by the green `done` row), no-permission (buttons absent), fallback note.

```tsx
type DuplicateCardProps = {
  current: { id: string; createdAt: string };
  matches: DuplicateMatch[];                 // GET /admin/incidents/{id}/similar
  canAct: boolean;
  onMerge: (sourceId: string, intoId: string) => Promise<void>;   // POST /admin/incidents/{sourceId}/merge { intoIncidentId }
};
```
Renders only if there is at least one match not dismissed. The first match is shown (others: a `mini` line `وفيه {n} بلاغات قريبة تانية`):
```tsx
<section className="dup" aria-labelledby="h-dup">
  <span className="lab" id="h-dup"><Icon name="merge" size={16}/>اقتراح دمج · محتاج موافقتك</span>
  <div className="box"><Link href={`/incidents/${m.incidentId}`}>{m.incidentId}</Link> · {m.title}<br/>
    <span className="mini">على بعد {m.distanceM} م · {m.followers} مواطنين بيتابعوه · نفس النوع</span></div>
  <p className="small" style={{margin:0}}>الذكاء الاصطناعي شايف إنهم نفس المشكلة. الدمج بيضم المتابعين للبلاغ الأقدم وبيجمّع الأولوية.</p>
  <div className="btn-split"><Button size="sm" icon="merge">ادمجهم</Button><Button size="sm" variant="secondary">مش نفس المشكلة</Button></div>
  <p className="mini" style={{margin:0,color:'var(--ftc-gold-deep)'}}>مفيش دمج تلقائي أبدًا. أي دمج بيتسجّل باسمك.</p>
</section>
```
"ادمجهم" opens `ConfirmModal`: title `تأكيد دمج البلاغات`, body `هيتدمج {source} في {target}. المتابعين والبلاغات المربوطة هتتنقل للبلاغ الأقدم، والبلاغ التاني هيتقفل برسالة للمواطنين. الدمج بيتسجّل باسمك ومينفعش يتراجع.`, confirm label `أكّد الدمج`. Direction: the incident with the **older** `createdAt` is the target; fetch the match with `GET /admin/incidents/{match.incidentId}` (or take it from the cached queue) to compare. "مش نفس المشكلة" hides the card and stores `ftc.dup.dismissed:{current.id}:{match.incidentId}` in `localStorage`. `canAct=false` hides both buttons.

### 2.21 Map components (Leaflet)

Dependencies: `leaflet`, `react-leaflet`, `react-leaflet-cluster` (wraps `leaflet.markercluster`); import `leaflet/dist/leaflet.css` once inside `map-view.tsx`. Always load the map through `next/dynamic(() => import('./map-view'), { ssr: false, loading: () => <Skeleton variant="block" height={420} /> })`.

```tsx
type PinKind = 'received' | 'assigned' | 'progress' | 'resolved' | 'critical';
type MapPinModel = { id: string; lat: number; lng: number; kind: PinKind; title: string; near?: boolean };
type MapViewProps = {
  pins: MapPinModel[]; selectedId?: string | null; onSelect?: (id: string) => void;
  center?: [number, number];            // default [30.056, 31.330]
  zoom?: number;                        // default 15  (Overview preview: 14, incident detail snippet: 16)
  interactive?: boolean;                // default true; false = no drag/zoom/keyboard, pins not clickable
  cluster?: boolean;                    // default true
  circle?: { lat: number; lng: number; radiusM: number };   // incident detail: 250 m duplicate radius
  onMapReady?: (map: L.Map) => void;    // the page's custom zoom buttons call map.zoomIn()/zoomOut()
};
```
`pinKind(incident)`: if the incident is open and `isCriticalIncident(incident)` → `critical`; else by status: `received|triaged` → `received`, `assigned` → `assigned`, `in_progress` → `progress`, `resolved|closed` → `resolved`.

Container:
```tsx
<div dir="ltr" style={{ height: '100%' }}>
  <MapContainer center={center} zoom={zoom} zoomControl={false} attributionControl={false} scrollWheelZoom={interactive} dragging={interactive} keyboard={interactive} style={{ height: '100%', width: '100%' }} ref={…}>
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
    <AttributionControl position="bottomleft" prefix={false} />
    {circle && <Circle center={[circle.lat, circle.lng]} radius={circle.radiusM} pathOptions={{ color: '#A50E25', weight: 1.5, dashArray: '5 5', fillColor: '#A50E25', fillOpacity: 0.08 }} />}
    <MarkerClusterGroup chunkedLoading maxClusterRadius={48} showCoverageOnHover={false} spiderfyOnMaxZoom disableClusteringAtZoom={17} iconCreateFunction={clusterIcon}>
      {pins.filter(p => p.id !== selectedId).map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.kind, false, p.near)} title={`${p.id} · ${p.title}`}
          zIndexOffset={p.kind === 'critical' ? 1000 : 0} eventHandlers={{ click: () => onSelect?.(p.id) }}>
        <Tooltip direction="top" offset={[0, -34]} className="ftc-tip">{p.id} · {p.title}</Tooltip></Marker>)}
    </MarkerClusterGroup>
    {selected && <Marker position={[selected.lat, selected.lng]} icon={pinIcon(selected.kind, true)} zIndexOffset={2000} />}   {/* never inside a cluster */}
  </MapContainer>
</div>
```
The map is `dir="ltr"` (tiles and attribution are not mirrored); everything around it (cards, legend, zoom buttons) stays RTL. When `selectedId` changes call `map.flyTo([lat,lng], Math.max(map.getZoom(), 16), { duration: .4 })`. Clicking a cluster zooms to its bounds (plugin default).

Pin icon (divIcon HTML; pure strings, no React). The hex values are the tokens `status-received / status-assigned / gold / gold-deep / status-resolved / urgent`:

```ts
const PIN_PATH = 'M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z';
const PIN_STYLE: Record<PinKind, { body: string; glyph: string; svg: string }> = {
  received: { body: '#3D4A50', glyph: '#3D4A50', svg: '<circle cx="12" cy="12" r="3.2" fill="#3D4A50" stroke="none"/>' },
  assigned: { body: '#1E4F87', glyph: '#1E4F87', svg: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>' },
  progress: { body: '#D4A20B', glyph: '#7A5A00', svg: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>' },
  resolved: { body: '#1F6B33', glyph: '#1F6B33', svg: '<path d="M20 6 9 17l-5-5"/>' },
  critical: { body: '#A50E25', glyph: '#A50E25', svg: '<path d="M12 6v7"/><path d="M12 17.5h.01"/>' },
};
function pinSvg(kind: PinKind) {
  const s = PIN_STYLE[kind];
  return `<svg viewBox="4 2 52 60" aria-hidden="true"><path d="${PIN_PATH}" fill="${s.body}" stroke="#fff" stroke-width="3"/><circle cx="32" cy="26.5" r="12.5" fill="#fff"/><g transform="translate(23.6 18.1) scale(.7)" fill="none" stroke="${s.glyph}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${s.svg}</g></svg>`;
}
export function pinIcon(kind: PinKind, selected = false, near = false) {
  const lg = kind === 'critical' || selected;
  const [w, h] = lg ? [41, 48] : [30, 35];
  const cls = cx('ftc-pin', lg && 'ftc-pin--lg', kind === 'critical' && 'ftc-pin--critical', selected && 'is-selected', near && 'ftc-pin--near');
  const tag = kind === 'critical' ? '<span class="ftc-pin__tag">خطر</span>' : '';
  return L.divIcon({ className: 'ftc-divicon', html: `<div class="${cls}">${tag}${pinSvg(kind)}</div>`, iconSize: [w, h], iconAnchor: [w / 2, h] });
}
export function clusterIcon(cluster: L.MarkerCluster) {
  const n = cluster.getChildCount(); const d = n < 10 ? 40 : n < 50 ? 44 : 48;
  return L.divIcon({ className: 'ftc-divicon', html: `<div class="ftc-cluster">${n}</div>`, iconSize: [d, d] });
}
```
Look: teardrop pin 30×35 px (selected/critical 41×48) with a white inner disc and a status glyph; **critical** pins have a pale-red halo disc behind them and a red `خطر` pill above; **selected** pin has a gold-soft halo with a 3px gold ring; **near** pins (detail snippet neighbours) are the normal received pin at 85% opacity. **Cluster bubble** = ink circle (40/44/48 px by count), 3px white border, 6px translucent-ink halo (`box-shadow`), white Readex 15px 700 count. No other colours.

Legend (HTML overlay on `.mapframe`, not inside Leaflet):
```tsx
<div className="legend" role="group" aria-label="دليل الدبابيس"><span className="t">دليل الدبابيس</span>
  {(['received','assigned','progress','resolved','critical'] as PinKind[]).map(k => <span className="it" key={k}><span dangerouslySetInnerHTML={{ __html: pinSvg(k).replace('<svg ', '<svg width="20" height="19" ') }} />{LEGEND_LABEL[k]}</span>)}
  <span className="it"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#161616"/><text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">8</text></svg>تجمّع بلاغات (قرّب عشان تفتحه)</span></div>
```
`LEGEND_LABEL`: received `وصل` · assigned `اتحوّل` · progress `جاري التنفيذ` · resolved `اتصلّح` · critical `خطر · محتاج تدخّل فوري`. Zoom buttons: `<div className="zoom"><button type="button" aria-label="تكبير" onClick={() => map?.zoomIn()}>+</button><button type="button" aria-label="تصغير" onClick={() => map?.zoomOut()}>−</button></div>`.
States: loading (skeleton block), empty after filtering (the map stays, a `.maptag` pill: `مفيش بلاغات بالفلاتر دي`), error (ErrorState replaces the map card; failed tile loads are not handled).

### 2.22 BudgetSlider and presets

```tsx
type BudgetSliderProps = {
  valueEgp: number; onChange: (egp: number) => void;     // slider fires continuously; the page debounces the API call (300 ms)
  min?: number /* 50000 */; max?: number /* 600000 */; step?: number /* 1000 */;
  unlimitedEgp?: number;                                   // sum of all candidate costs rounded up to 1000 and capped at max; undefined until the first plan arrives
  busy?: boolean;
};
```
```tsx
<section className="ftc-card budget-card" aria-label="الميزانية">
  <div className="budget-top">
    <label htmlFor="budget">الميزانية المتاحة</label>
    <span className="budget-value num" aria-live="polite">{formatBudget(valueEgp)}</span>          {/* "300 ألف جنيه" */}
    <div className="budget-presets" role="group" aria-label="ميزانيات جاهزة">
      <FilterChip label="تقشّف · 150 ألف" pressed={valueEgp === 150000} onClick={() => onChange(150000)} />
      <FilterChip label="الميزانية الحالية · 300 ألف" pressed={valueEgp === 300000} onClick={() => onChange(300000)} />
      <FilterChip label={`بدون حد · ${unlimitedEgp ? formatThousands(unlimitedEgp) : '…'}`} pressed={unlimitedEgp != null && valueEgp >= unlimitedEgp} disabled={unlimitedEgp == null} onClick={() => onChange(unlimitedEgp!)} />
    </div>
  </div>
  <input id="budget" type="range" min={min} max={max} step={step} value={valueEgp} aria-valuetext={formatBudget(valueEgp)} onChange={(e) => onChange(Number(e.target.value))} />
  <div className="budget-scale"><span>50 ألف جنيه</span><span>600 ألف جنيه</span></div>
</section>
```
`formatThousands(300000)` → `300 ألف`. Keyboard: native range (arrow keys ±1,000; add PageUp/PageDown ±10,000 in `onKeyDown`). While `busy` the results region gets `.is-busy` and `aria-busy`.

### 2.23 Kanban column and work-order card

```tsx
type KanbanColumnProps = { status: WorkOrderStatus; title: string; count: number; children: React.ReactNode };
<section className="colm" aria-label={title}>
  <h2><span className={`dot dot--${dot[status]}`} aria-hidden />{title}<span className="n">{count}</span></h2>
  {count === 0 ? <p className="empty">مفيش أوامر شغل هنا</p> : children}
</section>
```
`dot`: open → `open`, assigned → `assigned`, in_progress → `progress`, done → `done`. Titles: اتسلّم · اتوزّع · شغالين عليه · اتحلّت (DOM order = visual order; in RTL the first column is on the right).

```tsx
type WorkOrderCardProps = { wo: WorkOrder; selected?: boolean; now: number; onOpen: (id: string) => void };
<div role="button" tabIndex={0} className={cx('wo', late && 'is-late', selected && 'is-open')} onClick={() => onOpen(wo.id)} onKeyDown={enterOrSpace} aria-label={`أمر الشغل ${wo.id}: ${wo.title}`}>
  <div className="top"><span className="id">{wo.id}</span>{late ? <Tag tone="danger">{formatDueLabel(hoursLate)}</Tag> : wo.external && <Tag tone="ext">جهة خارجية</Tag>}</div>
  <span className="t">{wo.title}</span>
  <span className="row"><Icon name={wo.incidentId ? 'alert-triangle' : 'truck'} size={14}/><Link className="inc" href={…} onClick={stop}>{wo.incidentId ?? wo.serviceRequestId}</Link></span>
  <span className="row"><Icon name="list" size={14}/>{wo.department}</span>
  <span className="row"><Icon name="users" size={14}/>{teamLine(wo)}</span>
  <span className="row"><Icon name={wo.status === 'done' ? 'check' : 'calendar'} size={14}/><span className={cx('due', late && 'late')}>{dueLine(wo)}</span></span>
</div>
```
`late = wo.overdue && wo.status !== 'done'`; the lateness tag text is `formatDueLabel` of the hours past `dueAt` (so `متأخر يومين`); for an external, not-late order the top-right shows the `جهة خارجية` pill. `teamLine`: external → `بلّغنا الشركة · الخط الساخن {externalHotline}`; team → `{team} · {teamSize} أفراد` (no size → only the team); none → `لسه من غير فريق`. `dueLine`: not done → `التسليم {formatDayDM(dueAt, now)}` (`التسليم الخميس 22/10`, `التسليم النهارده 21/10`, late example `التسليم الاثنين 19/10`); done → `اتحلّت {formatDayWithTime(resolvedAt, now)}` (`اتحلّت النهارده 08:40`, `اتحلّت الأحد 18/10`). (A `div role="button"` is used because the card contains a link.) Card states: default white with card shadow, hover line border, late red border (2px urgent), selected gold border (2px), focus gold outline.

### 2.24 KvList

```tsx
type KvListProps = { items: { label: string; value: React.ReactNode; numeric?: boolean }[] };
<dl className="kv">{items.map(i => <Fragment key={i.label}><dt>{i.label}</dt><dd className={i.numeric ? 'num' : undefined}>{i.value}</dd></Fragment>)}</dl>
```
Label column muted, value column weight 600.

---

## 3. Pages

### 3.0 Conventions shared by every page

**Wrapper.** Every page except `/login` is rendered inside `AppShell` (`<main class="ftc-admin-main"><div class="page">…`). First child is `PageHead` (or the breadcrumb + title row on the detail page). Set `document.title` to `FixTheCity — مركز القيادة: {page}`.

**Data layer.** React Query (`@tanstack/react-query`) over `src/services/*`. Defaults: `staleTime 30 s`, `retry 1` (no retry on 401/403/404), `refetchOnWindowFocus true`. The "آخر تحديث من دقيقة" text is `formatRelative(new Date(query.dataUpdatedAt))`; re-render it every 30 s.

| Query key | Endpoint | Used by |
| --- | --- | --- |
| `['dashboard', range]` | `GET /admin/dashboard?range=today\|7d\|30d` | shell counts (7d), Overview, Incidents KPIs (7d) |
| `['insights']` | `GET /admin/insights` | Overview AI card |
| `['incidents', filters]` | `GET /admin/incidents?status=&categoryId=&department=&critical=&overdue=&q=` | Incidents, Map, Overview map preview, detail snippet neighbours |
| `['incident', id]` | `GET /admin/incidents/{id}` | detail |
| `['similar', id]` | `GET /admin/incidents/{id}/similar` | detail duplicate card |
| `['work-orders', filters]` / `['work-order', id]` | `GET /admin/work-orders?status=&department=` / `GET /admin/work-orders/{id}` | Work orders, incident WO panel, incidents panel |
| `['service-requests']` | `GET /admin/service-requests` (no filters; counts and filters are computed client-side) | Service requests |
| `['departments']` | `GET /admin/departments` | selects and WO chips (staleTime ∞) |
| `['budget', budgetEgp]` | `POST /admin/budget/optimize { budgetEgp }` (use `useMutation`/keyed query; it is a POST) | Budget |

**Mutations and what they invalidate** (always invalidate, never patch the cache by hand except the task checkbox): `PATCH /incidents/{id}` → `['incident',id]`, `['incidents']`, `['dashboard']`, `['work-orders']`; `POST /admin/incidents/{id}/triage/confirm` → `['incident',id]`, `['incidents']`; `POST /admin/work-orders` → `['incident',id]`, `['incidents']`, `['work-orders']`, `['dashboard']`; `PATCH /admin/work-orders/{id}` → `['work-order',id]`, `['work-orders']`, `['incident',…]`, `['incidents']`, `['dashboard']`; `POST …/merge` → `['incident',*]`, `['incidents']`, `['dashboard']`; `PATCH /admin/service-requests/{id}` → `['service-requests']`, `['dashboard']`; `POST /admin/budget/commit` → `['work-orders']`, `['incidents']`, `['dashboard']`.

**Standard states** (every data region implements all four):
1. *Loading* → skeleton shaped like the final content (KPI skeletons, 6 table skeleton rows, card skeleton blocks), `aria-busy="true"`.
2. *Empty* → `EmptyState` inside the same card (copy given per page).
3. *Error* → `ErrorState` (variant error) inside the same card, with `جرّب تاني` calling `refetch()`. A failed background refetch while data is on screen keeps the data and shows a `toast.error('مقدرناش نحدّث البيانات. جرّب تاني.')` once.
4. *No permission* → HTTP 403 or a client-side role check → `ErrorState variant="forbidden"` (page-level); `404` → `variant="notfound"`.

**Roles.** `staff`: sees only their department (the server filters), can act only on their department's items (server 403 otherwise; UI disables controls with a notice), never sees the Budget nav item, and `/budget` shows the forbidden state without calling the API. `admin`: everything.

**Standard texts.** Generic API failure toast: the response `detail` (it is already short Egyptian Arabic) or `حصلت مشكلة. جرّب تاني.` · 401 → sign out and go to `/login` (silent) · 403 toast `مش مسموح`.

**Success toasts (verbatim).** Status updated: `اتحدّثت الحالة. المواطنين هيشوفوا رسالتك في التتبع.` · AI confirmed: `اتأكّد التصنيف.` · Classification changed: `اتغيّر التصنيف واتأكّد.` · Work order created: `اتعمل أمر الشغل {id}.` · Work order updated: `اتحدّث أمر الشغل {id}.` · Task toggled: no toast (silent; on failure revert and `toast.error('مقدرناش نحفظ المهمة. جرّب تاني.')`) · Merged: `اتدمجت البلاغات في {id}.` · Service request updated: `اتحدّث الطلب {id}.` · Message sent: `اتبعتت الرسالة للمواطن.` · Budget committed: `اتعمل {n} أمر شغل من الخطة.`

**Numbers and dates** always through `src/lib/format.ts` (section 4). Entity ids are shown as received.

**Design-token map for text colours:** deltas bad `--ftc-urgent-deep`, good `--ftc-status-resolved`, neutral `--ftc-ink-muted`.

---

### 3.1 `/login` — Login (`Login.html`)

Standalone page, no AppShell. `<title>`: `FixTheCity — مركز القيادة: تسجيل الدخول`. If a session already exists, redirect to `/`.

**Layout.** Full-height grid `.login`: two columns `minmax(0,1.05fr) | minmax(0,1fr)`. In RTL the ink hero is on the right, the form on the left. ≤900px: single column, hero first (shorter, tags hidden).

**Hero (`<section class="login-hero" aria-label="مركز القيادة">`, ink background).**
`.top`: `.lockup` = mark (48px) + `<b>FixTheCity</b>`; `<h1>` `مركز القيادة`; `<p>` `من البلاغ لحد ما يتصلّح. افرز، وزّع، وتابع شغل الحي من مكان واحد.`; `.tags` four pills (white text, 20% white border): `فرز بالأولوية` · `أوامر شغل` · `خريطة المدينة` · `ميزانية الإصلاحات`. Then the skyline image at the bottom (`class="skyline"`, `/brand/cairo-skyline.svg`, width 390 height 150).

**Form (`<section class="login-form" aria-label="تسجيل الدخول">`).** One `<form>` max-width 420, gap 18:
1. Heading block: `<h2>` `دخول الموظفين`, `<p class="sub">` `سجّل دخولك بحساب الحي للوصول لقائمة البلاغات وأوامر الشغل.`
2. `TextField` id `email`, label `البريد الإلكتروني للشغل`, type email, `autoComplete="username"`, placeholder `name@example.com`, `dir="ltr"`.
3. Password: label `كلمة السر`, `autoComplete="current-password"`, placeholder `••••••••`, `dir="ltr"`, inside `.pw` with a toggle button (44×44, absolutely positioned at the physical right) `aria-label="إظهار كلمة السر"` (pressed state: `aria-label="إخفاء كلمة السر"`, `aria-pressed`), icon `eye-slash` while hidden, `eye` while shown, `type` switches password/text.
4. `SelectField` id `district`, label `الحي`, options `القاهرة · حي مدينة نصر أول`, `القاهرة · حي مدينة نصر ثان`, `القاهرة · حي مصر الجديدة`. Decorative: it is not sent to the API; the real district comes from the session.
5. `.row`: `<label class="chk"><input type="checkbox" checked> افضل مسجّل على الجهاز ده</label>` and a link-button `نسيت كلمة السر؟`. Checked → token in `localStorage`; unchecked → `sessionStorage`. The link toggles a `Notice tone="gold"` under the row: `كلّم مشرف النظام عشان يعيد تعيين كلمة السر.` (extension; there is no reset flow).
6. Submit `Button primary block` `دخول` (52px high, 17px). Loading: label `بندخّلك…` with spinner.
7. `.staff-note` (gold-soft box with `lock` icon): `للموظفين فقط. بلاغات المواطنين بتيجي من التطبيق أو الموقع.`

**API.** `POST /auth/staff-login { email, password }` → `StaffSession`; store token and session; `router.replace('/')`.

**Validation (inline, on submit and on blur):** empty email `اكتب البريد الإلكتروني` · malformed `البريد مش مكتوب صح` · empty password `اكتب كلمة السر`. **Server errors:** 401 → a `Notice tone="danger"` (icon `alert-triangle`) above the submit button with the backend text `البريد أو كلمة السر غلط`; network failure → same notice with `مفيش اتصال بالسيرفر. جرّب تاني.`. The form keeps its values and focus returns to the email field. No success toast (the redirect is the feedback).

---

### 3.2 `/` — Overview (`Overview.html`)

`<title>`: `FixTheCity — مركز القيادة: نظرة عامة`. Data: `GET /admin/dashboard?range={range}` (`DashboardStats`), `GET /admin/insights`, `GET /admin/incidents` (for the map preview). `range` state: `today | 7d | 30d`, default `7d`, kept in the URL (`?range=`).

**Layout (desktop ≥1201px).** Vertical stack with 20px gaps: PageHead → KPI row (4 equal columns) → `grid-b` (1.5fr | 1fr) → `grid-c` (1fr | 1.25fr) → `grid-d` (1.25fr | 1fr). ≤1200px every grid is one column; ≤1100px KPIs are 2×2.

**1. PageHead.** Title `نظرة عامة`. Subtitle `{formatLongDate(now)} · {district} · آخر تحديث {formatRelative}` → example `الأربعاء 21 أكتوبر · حي مدينة نصر أول · آخر تحديث من دقيقة` (`district` = the part of `session.district` after ` · `). Actions: chip group `role="group" aria-label="الفترة"`: `النهارده` (today) · `آخر 7 أيام` (7d) · `الشهر` (30d), single choice. Search: aria-label `ابحث في البلاغات`, placeholder `ابحث برقم البلاغ أو الشارع`; Enter → `router.push('/incidents?q=' + value)`.

**2. KPIs** (`<section class="kpis" aria-label="مؤشرات الأداء">`, four `KpiCard`):
| Label | Value | Note |
| --- | --- | --- |
| `بلاغات مفتوحة` | `open` | `<Delta openDelta/> عن {period}`; tone: `openDelta>0` bad, `<0` good, `0` mute with text `زي {period}` |
| `متأخرة عن الميعاد` | `overdue`, tone urgent | `من الـ {open} · {pct(overdue,open)}%` (mute) |
| `{resolvedLabel}` | `resolvedThisWeek` | `<Delta resolvedDelta/> عن {period}`; `>0` good, `<0` bad, `0` mute |
| `متوسط وقت الحل` | `formatDays(avgResolutionDays)` → `2.4 يوم` | `avgResolutionDeltaDays<0` → `أسرع بـ {abs} يوم` good; `>0` → `أبطأ بـ {abs} يوم` bad; `0` → `زي {period}` mute |
`period` by range: today `امبارح` · 7d `الأسبوع اللي فات` · 30d `الشهر اللي فات` (so `+14 عن الأسبوع اللي فات`, `+8 عن الأسبوع اللي فات`). `resolvedLabel` by range: today `اتحلّت النهارده` · 7d `اتحلّت الأسبوع ده` · 30d `اتحلّت الشهر ده`.

**3. Row B.**
- Card `البلاغات المفتوحة حسب النوع` (id `h-cat`), sub `إجمالي {open} بلاغ مفتوح · مرتّبة من الأكتر للأقل`. `HBarChart` from `byCategory` (already desc): label = `getCategory(categoryId).labelAr`, `danger = category.danger` (adds the `خطر` tag), value = `count`; aria-label `عدد البلاغات المفتوحة حسب النوع`. Show max 10 rows; if more, one extra row `باقي الأنواع` with the sum. Empty (no open incidents): `EmptyState icon=check title="مفيش بلاغات مفتوحة" message="كل البلاغات اتحلّت. عاش."`.
- Card `حالة البلاغات` (id `h-st`), sub `المفتوحة دلوقتي: {open}`. `StackBar` with segments received (`byStatus` received + triaged summed), assigned, in_progress; aria-label `وصل {n}، اتحوّل {n}، جاري التنفيذ {n}`; `LegendRows` for those three (chip, count, `{pct}%` of open). Then `<hr class="ftc-divider">` and `row-between`: `<StatusChip resolved "اتصلّح"/> <span class="mini">الأسبوع ده</span>` (the period word follows range: `النهارده` / `الأسبوع ده` / `الشهر ده`) and `<span class="strong num">{resolved count}</span>`. Footer sub: `كل حالة بتتقرأ بالكلمة واللون. الأرقام للبلاغات اللي لسه شغالين عليها.`

**4. Row C.**
- Card `فاتت ميعادها أو قربت` (id `h-sla`, icon `alert-triangle` in the title), sub `المطلوب منك النهارده · مرتّبة حسب الأولوية`, header action `<Tag danger>{overdueTotal} متأخرة</Tag>`. `<ul class="sla">` from `overdueList` (max 5): `<li><ScoreBadge score=priorityScore/> <span class="t"><Link href=/incidents/{incidentId}>{incidentId} · {title}</Link><span class="mini">{department}{external ? ` · جهة خارجية · ${externalHotline}` : ''} · {shortAddress(address)}</span></span><Tag danger>{formatDueLabel(hoursLate)}</Tag></li>` → `باقي 5 س`, `متأخر 6 س`, `متأخر يوم`, `متأخر يومين`. Footer link `شوف كل المتأخرة ({overdueTotal})` + `chevron-left` → `/incidents?view=overdue`. Empty: `EmptyState icon=check title="مفيش حاجة متأخرة" message="كل البلاغات جوه الميعاد."`; hide the tag and link.
- Card `الشغل على كل جهة` (id `h-dep`, padding-bottom 8), sub `الحِمل = المفتوح مقابل طاقة الفرق الأسبوعية`. Table `min-width:520px` inside `.tablewrap`, columns `الجهة` · `مفتوحة` · `متأخرة` · `متوسط الحل` · `الحِمل`. Rows from `departments`: name in `.strong`, external adds `<span class="mini" style="display:block">جهة خارجية · {hotline}</span>`; `open` (num); `overdue` → `<Tag danger>{n}</Tag>` when >0 else plain `0`; `avgResolutionDays` → `2.8 يوم`; load = `.load` with `.ftc-bar` width `loadPct%` + `<span class="mini num" style="width:32px;text-align:end">{loadPct}%</span>`.

**5. Row D.**
- Card `خريطة الحي` (id `h-map`), sub `البلاغات المفتوحة حسب الحالة · التجمّعات بتبيّن العدد`, action link `افتح الخريطة` + `chevron-left` → `/map`. Body `.mapprev` (300px): non-interactive `MapView` (interactive=false, zoom 14, center default, pins = open incidents from `['incidents', {}]`, clusters on). Clicking the preview navigates to `/map`. Loading: `Skeleton block`.
- Card `آخر الأنشطة` (id `h-act`), sub `النهارده`. `<ul class="feed">` from `activity` (8 items): `<li><span class="ic {mod}"><Icon/></span><span><b>{actor}</b> {text}{entityId ? link : ''}</span><time>{formatTime(at)}</time></li>`. Icon/modifier by item: `status==='resolved'` → `check` + `ic--ok` · `status==='received'` → `alert-triangle` + `ic--urgent` · `actor` equals `الذكاء الاصطناعي` or `text` starts with `اقتراح` → `sparkles` + `ic--ai` (render `<b>اقتراح الذكاء الاصطناعي:</b>` as the lead) · otherwise `wrench` with no modifier. If `entityId` appears inside `text`, render it as a `Link` to `/incidents/{entityId}` (or `/work-orders?open=` for `WO-`). Empty: `EmptyState icon=clock title="مفيش أنشطة النهارده"`.
- **AI weekly insight** card (Task 7; extension of the layout, placed as a full-width `ftc-notice ftc-notice--ai` row under the KPIs only when `GET /admin/insights` returns): label line `<Icon sparkles/> اقتراح الذكاء الاصطناعي` + `insights.summary`; below, chips: hotspots (`{address} · {count} بلاغ`), rising categories (`{labelAr} +{delta}`), overdue departments (`{name} متأخرة`). Closing line `ده ملخص بيتحسب من البيانات. القرار ليك.` If the insights call fails, hide the card silently.

**Interactions.** Range chips refetch `dashboard`; KPIs show `loading` skeleton only on first load, then `.is-busy`. Links go to the queue (`/incidents?view=overdue`), a single incident, or the map.

**States.** Loading: 4 KPI skeletons, two card skeletons with 5 bar lines, SLA list with 5 skeleton rows, table 5 skeleton rows, map skeleton, feed 5 skeleton rows. Error: each card shows its own `ErrorState` with retry (one failing query never blanks the page); full failure of `dashboard` shows one page-level `ErrorState`. Staff: same layout, numbers are server-scoped; no budget link anywhere.

---

### 3.3 `/incidents` — Incidents queue (`Incidents.html`)

`<title>`: `FixTheCity — مركز القيادة: البلاغات`. Data: `GET /admin/incidents` (priority desc), `GET /admin/dashboard?range=7d` for the KPIs, `GET /admin/work-orders` (only to show the selected incident's WO summary; or `GET /admin/work-orders/{id}`).

**Layout.** Stack: PageHead → KPI row (auto-fit `minmax(180px,1fr)`, class `kpis kpis--auto`) → chip row → `.inc-wrap` (flex-wrap): table card (`flex: 999 1 520px`) and side panel (`flex: 1 1 340px`). Below ~900px the panel wraps under the table.

**PageHead.** Title `قائمة البلاغات`, subtitle `مرتّبة حسب الأولوية · آخر تحديث {formatRelative}`. Search `ابحث في البلاغات` / `ابحث برقم البلاغ أو الشارع` → debounced 300 ms → `q` query param (server-side). No actions.

**KPIs** (same four as Overview, `range=7d`, same notes): `بلاغات مفتوحة` / `متأخرة عن الميعاد` (note `من الـ {open}`) / `اتحلّت الأسبوع ده` / `متوسط وقت الحل`.

**Filter row** (`.fbar`): single-choice chips `كل البلاغات` · `أولوية عالية` (client: `priority.score >= 65`) · `خطر` (server `critical=1`; extension) · `متأخرة` (server `overdue=1`) · `في خطة الميزانية` (client: `inBudgetPlan`); then pill selects (sr-only labels): `الحالة` (options `المفتوحة` default, `وصل`, `اتصنّف`, `اتحوّل`, `جاري التنفيذ`, `اتصلّح`, `اتقفل`, `كل الحالات`), `النوع` (`كل الأنواع` + 12 category labels), `الجهة` (`كل الجهات` + departments; staff: fixed to their department and disabled). View + selects are mirrored in the URL (`?view=&status=&categoryId=&department=&q=`). `المفتوحة` = `isOpenStatus` filtered client-side.

**Table** (`DataTable`, `tableClassName="inc-table"`, `minWidth 640`, `ariaLabel="البلاغات"`, clickable). Columns:
| Header | Cell |
| --- | --- |
| `الأولوية` (sortable) | `ScoreBadge(priority.score)` |
| `البلاغ` | `<Link class="ttl" href=/incidents/{id}>{title}{danger && <Tag danger>خطر</Tag>}</Link><span class="mini num">{id} · {shortAddress(location.address)}</span>`; `danger = getCategory(categoryId).danger` |
| `مواطنين` (sortable) | `linkedReports.length` |
| `مفتوح / المستهدف` (sortable by createdAt) | `{formatSpan(now-createdAt)} / {formatSpan(dueAt-createdAt)}` e.g. `19 س / 1 يوم`, `3 س / 5 أيام`; when `overdue` the cell has class `late-cell` and the text gets ` · متأخر` appended (`2 يوم / 2 يوم · متأخر`) |
| `الحالة` | `StatusChip incident` |
| `الجهة` | `{department}` + (`external` → `<span class="mini" style="display:block">جهة خارجية · {externalHotline}</span>`) |
First data row is auto-selected on desktop (≥1101px) after the first load; otherwise nothing is selected. Row click/Enter selects; the title link opens the detail page. Show at most 100 rows; if more, a muted line under the table `بنعرض أول 100 بلاغ. ضيّق البحث بالفلاتر.`

**Side panel** (`<aside class="inc-aside" aria-label="تفاصيل البلاغ">`, visible with a selection):
1. `.head`: `.thumb` 64×64 (status-received block, `image` icon in icon-muted) + `<span style="flex:1"><h2>{title}</h2><span class="mini num">{id} · {shortAddress} · {linkedReports.length} بلاغات مربوطة</span></span>`.
2. If `triage`: `.aibox`: `.lab` `<Icon sparkles/> اقتراح الذكاء الاصطناعي`; line `{category label} · {confidence}% · {SEVERITY_AI_AR}` (top option); `.mini` `الجهة المسؤولة: {department}`; `.mini` `راجعه: {lastReviewedBy}` or, when not reviewed or unconfirmed, `لسه محدّش راجعه`. (Mock text for this line was `راجعته: سارة م. · بدون تعديل`; the "no edit" part has no data, so it is dropped.)
3. `PriorityBreakdown variant="compact"` with the short labels.
4. `.wo-sum`: if `workOrderId`: `<span class="strong small">أمر الشغل {workOrderId}</span>` + `KvList` (`الفريق` team line, `الحالة` WO chip, `التسليم` `formatDayDM(dueAt)`), link `افتح أمر الشغل`; else `<span class="strong small">أمر الشغل</span><p class="mini">لسه مفيش أمر شغل للبلاغ ده</p>` + `Button secondary sm` `أنشئ أمر شغل` (→ `/incidents/{id}#work-order`).
5. `StatusChangeForm compact` titled by a `<span class="strong small">غيّر الحالة</span>`: options `اتحوّل` / `جاري التنفيذ` / `اتصلّح` (plus current), `submitLabel` `حدّث الحالة وابلّغ المواطنين`, `citizensCount = linkedReports.length`. Calls `PATCH /incidents/{id} { status, note }`.
6. Footer link button `افتح البلاغ` → detail.
Nothing selected: `EmptyState icon=clipboard title="اختار بلاغ من القائمة" message="هتشوف هنا سبب الأولوية وأمر الشغل."`.

**States.** Loading: KPI skeletons, 6 skeleton rows, panel skeleton block. Empty (filters return nothing): `EmptyState icon=search title="مفيش بلاغات بالفلاتر دي" message="غيّر الفلاتر أو امسحها." action=<Button secondary sm>امسح الفلاتر</Button>`; empty queue with no filters: `title="مفيش بلاغات مفتوحة" message="كل البلاغات اتحلّت."`. Error: `ErrorState` replaces the table card (KPIs still show if they loaded). Staff: department select locked; if a staff user selects an item of another department (cannot happen: server filters) controls would be disabled. Validation and toasts: the panel form follows 2.19 (`اكتب رسالة للمواطنين`, `اختار حالة غير الحالة الحالية`); success `اتحدّثت الحالة. المواطنين هيشوفوا رسالتك في التتبع.`

---

### 3.4 `/incidents/[id]` — Incident detail (`IncidentDetail.html`)

`<title>`: `FixTheCity — مركز القيادة: {id}`. Data: `GET /admin/incidents/{id}` (`AdminIncident`), `GET /admin/incidents/{id}/similar`, `GET /admin/work-orders/{workOrderId}` when present, `GET /admin/incidents` (cached; neighbours for the location snippet), `GET /admin/departments`.

**Layout.** Page stack: breadcrumb → title row → `.layout` grid `minmax(0,1fr) | 380px` (≤1200px one column, the action column goes below). Left `.col`: Photos card → `.two` (AI card | Details card) → Priority card → Linked reports card → Timeline card. Right `.col` (`<aside aria-label="إجراءات">`): Status form → Work order → Location → Duplicate suggestion.

**Breadcrumb** `<nav class="crumbs" aria-label="مسار الصفحة"><Link>البلاغات</Link><span aria-hidden>/</span><span class="num">{id}</span></nav>`.

**Title row.** Chips line: `StatusChip critical` (`خطر`, when `isCriticalIncident`) · `StatusChip incident` · `StatusChip priority` (`أولوية عالية · 78`). `<h1>{title}`. `.meta` (each `<span>` icon + text):
- `pin`: `{location.address}` (+ ` · {landmark}` when present)
- `clock`: open: `مفتوح من {formatWhen(createdAt)} · الميعاد {formatWhen(dueAt)} ({formatDueLabel})` → `مفتوح من أمس 15:20 · الميعاد النهارده 15:20 (باقي 5 س)`; resolved/closed: `اتصلّح {formatWhen(updatedAt)}`
- `users`: `{formatCitizens(linkedReports.length)} بلّغوا` → `7 مواطنين بلّغوا`
- id as `<b class="num">` first in the list.

**Photos card** (id `h-ph`, icon `camera`): title `الصور ({shown} من {linkedReports.length} بلاغات)` where `shown` = number of placeholders drawn (sum of `photoCount`, capped at 3). `.photos` (3 columns, 2 at ≤760): one `<figure class="photo">` per report that has `photoCount>0` (max 3), centred `image` icon (48px) on the status-received block with `<figcaption>{reporter} · {formatDateTime(createdAt)}</figcaption>` (e.g. `مواطن · 20 أكتوبر 15:20`, `بلاغ بدون اسم · 20 أكتوبر 17:05`). There are no photo URLs in the contract yet; when it adds them render the blurred copy `<img>` with `object-fit:cover` and keep the figure/caption. No photos at all: `EmptyState icon=camera title="مفيش صور في البلاغات دي"`. Under the grid always: `Notice tone="gold" icon="eye-slash"`: `الوجوه وأرقام العربيات اتغطّت تلقائيًا قبل النشر للمواطنين. الصور الأصلية ظاهرة للمشرفين بس.`

**AI card** — `AiSuggestionCard` (2.20) from `triage`. Absent `triage` → the card is not rendered and the Details card spans both columns of `.two`.

**Details card** (id `h-det`, title `تفاصيل`), `KvList`:
| Label | Value |
| --- | --- |
| `النوع` | `getCategory(categoryId).labelAr` |
| `الجهة` | non-external: `{department} (الحي)` (e.g. `الصرف الصحي (الحي)`); external: `{department} · جهة خارجية · {externalHotline}` |
| `هدف الاستجابة` | `formatWorkDays(category.targetDays)` → `يوم عمل`, `يومين عمل`, `3 أيام عمل`, `7 أيام عمل` |
| `تكلفة تقديرية` | `formatEgp(estimatedCostEgp)` → `1,800 جنيه` (class num) |
| `المعلم القريب` | `sensitivePlace` or `—` |
| `آخر مراجعة` | `{lastReviewedBy} · {formatWhen(lastReviewedAt)}` or `محدّش راجعه لسه` |
| `خطة الميزانية` (only when `inBudgetPlan`) | `<Tag gold>داخل الخطة</Tag>` |

**Priority card** (id `h-pr`, title `سبب الأولوية`, sub `الحساب ثابت وبيتعرض بالكامل. مفيش حاجة مخفية.`): `PriorityBreakdown variant="full"`; `reason = priorityReason(priority, linkedReports.length, sensitivePlace)`; `whyByKey` from `factorWhy` (section 4.4). Factor labels come from `priority.factors[].label` (already `خطورة المشكلة`, `قريب من مدرسة أو مستشفى`, `عدد المواطنين اللي بلّغوا`, `مدة الانتظار مقارنة بالمستهدف`, `منطقة محتاجة اهتمام أكتر`).

**Linked reports card** (id `h-rep`, title `البلاغات المربوطة ({n})`, sub `بنعرض "مواطن" أو "بلاغ بدون اسم". الأسماء وأرقام التليفونات مش ظاهرة في لوحة الحي.`, padding-bottom 8). Plain `ftc-table` (min-width 680, in `.tablewrap`), columns `البلاغ` · `المُبلِّغ` · `الوقت` · `من` · `الوصف` · `صور` · (empty). Rows from `linkedReports` oldest first: id (`strong num`, nowrap), `reporter`, `formatDateTime(createdAt)` (num, nowrap), `source` (`app` → `تطبيق`, `web` → `موقع`), `description`, `photoCount` (num), last cell: first row `<span class="mini">الأقدم</span>`, last row (when >1) `<Tag danger>الأحدث</Tag>`.

**Timeline card** (id `h-tl`, title `السجل الكامل`, sub `الرسائل اللي بتتكتب هنا بتظهر للمواطنين في التتبع.`): `Timeline` from `incident.timeline` oldest first. Each entry: `title = STATUS_LABEL_AR[status]`, `who = {actor} · <span class="num">{formatDateTime(at)}</span>`, `body = note`, `state = 'done'`, `ai = actor === 'الذكاء الاصطناعي'`. After the real entries add synthetic rows: if status ∈ {received, triaged} and no work order: a `current` row `في انتظار أمر شغل`, who `{session.name} · دلوقتي`, body `اختار الفريق وأنشئ أمر الشغل عشان المواطنين يشوفوا إن الشغل بدأ.`; if status is assigned or in_progress: the last real entry becomes `current`; then `pending` rows (title only, who `لسه`) for each step not reached among `جاري التنفيذ`, `اتصلّح` (assigned/received/triaged → both; in_progress → `اتصلّح`; resolved/closed → none).

**Status form card** (id `h-st`, title `غيّر الحالة`, header right: current `StatusChip`): `StatusChangeForm kind="incident"`: options `received/assigned/in_progress/resolved` (labels `وصل`, `اتحوّل`, `جاري التنفيذ`, `اتصلّح`) + `closed` (`اتقفل`) only when current is `resolved`, + the current status if not in the list; `defaultStatus` = next logical (`received|triaged→assigned`, `assigned→in_progress`, `in_progress→resolved`, `resolved→closed`); field labels `الحالة الجديدة`, `رسالة للمواطنين`, help `بتظهر في تتبع البلاغ. اكتبها قصيرة وفيها اللي هيحصل بعد كده.`; the (disabled) checkbox `ابعتها للـ {n} مواطنين على واتساب (أو SMS)`; button `حدّث الحالة وابلّغ المواطنين`. Calls `PATCH /incidents/{id} { status, note }`. Closed incident: replace the form with `Notice tone="gold"` `البلاغ اتقفل. مفيش تغييرات تانية.` Staff of another department (`session.role==='staff' && incident.department !== session.department`): `disabledReason` = `ده بلاغ جهة تانية. تقدر تشوفه بس.` (also applied to the AI and duplicate buttons).

**Work order card** (id `h-wo`, `wrench` icon, title `أمر الشغل`):
- With `workOrderId`: sub `{id} · {WO status label}`; `KvList`: `الفريق` (team line or `لسه من غير فريق`), `المشرف` (`supervisor` or `—`), `التسليم` (`{formatDayDM(dueAt)} ({formatDueLabel})`), `المهام` (`{done} من {total}`); button `Button secondary sm block` `افتح أمر الشغل` → `/work-orders?open={id}`.
- Without: sub `لسه مفيش أمر شغل للبلاغ ده`; `<form class="side-form">`: `الجهة` select (`SelectField id=dep`, departments; preselected = incident.department; disabled for staff), `الفريق المسؤول` select (`id=as`; options from `TEAMS[department]` as `{team} · {size} أفراد · متاح` or `{team} · في موقع تاني` when that team is on an `assigned`/`in_progress` work order; first option `من غير فريق (هنوزّعه بعدين)`; for an external department the select is replaced by `Notice tone="gold"` `جهة خارجية · الخط الساخن {hotline}. هنبلّغهم ونتابع.`), `ميعاد التسليم` (`TextField id=due readOnly`, value `formatDueField(dueAt)` → `الأربعاء 21 أكتوبر · 15:20`, help `محسوب من هدف الاستجابة للنوع ده: {formatWorkDays(targetDays)}.`), submit `Button primary block` `أنشئ أمر شغل`.
- Submit: `POST /admin/work-orders { incidentId, department, team?, teamSize?, supervisor?: undefined, dueAt }`; success toast `اتعمل أمر الشغل {id}.` and the card switches to the "with work order" view. `409` → toast with `البلاغ ده ليه أمر شغل بالفعل` and a refetch.
- Hidden anchor `id="work-order"` on the card (target of `#work-order` links).

**Location card** (id `h-mp`, title `الموقع`, action link `الخريطة` + `chevron-left` → `/map?focus={id}`): `.mapsnip` (220px) = non-interactive `MapView` zoom 16 centred on the incident, with `circle={lat,lng,radiusM:250}`, the incident pin (selected style), neighbours (other open incidents within 250 m from the cached list, via `haversine`) as `near` pins. Caption `.mini`: `الدايرة المنقّطة = نطاق 250 م لكشف التكرار. الدبوس الرمادي = بلاغات قريبة.`

**Duplicate card** — `DuplicateCard` (2.20) from `GET /admin/incidents/{id}/similar`. Merge → `POST /admin/incidents/{source}/merge { intoIncidentId: target }`, then `router.push('/incidents/' + target)` and toast `اتدمجت البلاغات في {target}.`

**States.** Loading: breadcrumb text skeleton + title skeleton + three card skeleton blocks left and two right. Error: page-level `ErrorState` with retry; 404 → `notfound`; 403 → `forbidden`. Sections that fail independently (`similar`, work order) show a small inline `ErrorState` or are omitted (similar: omitted silently). Validation: only the status form (messages above) and the change-classification modal (none: both selects always valid). Toasts per 3.0.

---

### 3.5 `/map` — Operations map (`Map.html`)

`<title>`: `FixTheCity — مركز القيادة: الخريطة`. Data: `GET /admin/incidents` (all statuses; pins and counts are derived client-side because `MapPin` has no department or date; if the backend returns open incidents only, also request `status=resolved` and merge). Deep link `?focus=INC-501` selects and flies to that incident; filters live in the URL (`?status=received,assigned,progress,resolved,critical&categoryId=&department=&period=7d`).

**Layout.** PageHead → filters card → `.maplayout` (`minmax(0,1fr) | 340px`; ≤1200px one column, the right column goes under the map).

**PageHead.** Title `خريطة المدينة`; subtitle `{district} · البلاغات المفتوحة والمحلولة {periodLabel} · آخر تحديث {formatRelative}` → `حي مدينة نصر أول · البلاغات المفتوحة والمحلولة آخر 7 أيام · آخر تحديث من دقيقة` (`periodLabel`: `آخر 7 أيام` / `النهارده` / `آخر 30 يوم` / `في الفترة دي`). Search `ابحث في الخريطة` / `ابحث برقم البلاغ أو الشارع`: client-side; Enter selects the first match and flies to it; no match → inline `.mini` under the box `مفيش بلاغ بالاسم ده`.

**Filters card** (`<section class="ftc-card filters" aria-label="فلاتر الخريطة">`, 4 groups):
1. `الحالة` (label id `fl-st`): multi-toggle chips with counts, all pressed by default: `وصل` · `اتحوّل` · `جاري التنفيذ` · `اتصلّح` · `خطر` (each `FilterChip` with `count`). `وصل` also covers `triaged`; `اتصلّح` also covers `closed`; `خطر` toggles the critical pins (open incidents with `isCriticalIncident`). A critical open incident is drawn as `critical` and counted under `خطر` (not also under its status).
2. `النوع` select: `كل الأنواع (12)` + 12 category labels.
3. `الجهة` select: `كل الجهات` + departments (external ones suffixed ` · جهة خارجية`).
4. `الفترة` select: `آخر 7 أيام` (default) · `النهارده` · `آخر 30 يوم` · `من تاريخ لتاريخ…`. The last option reveals two `TextField type=date` (`من تاريخ`, `لحد تاريخ`) under the select; validation `التاريخ الأخير لازم يكون بعد الأول`. Rule: all open incidents are always shown; resolved/closed ones only if `updatedAt` falls in the period.

**Map frame** (`<section class="mapframe" aria-label="الخريطة">`): dynamic `MapView` centre `30.056, 31.330`, zoom 15, clusters on, custom `.zoom` buttons (top at the inline-end), `.legend` (bottom). Pins per 2.21; clicking a pin sets the selection (URL `focus`), the pin gets the selected style, the right card updates. Keyboard: pins are focusable markers (Enter selects).

**Right column.**
- Selected card (`<section class="ftc-card sel" aria-labelledby="h-sel" style="border:2px solid var(--ftc-gold)">`): `.head` = `<span class="ftc-icon-well ftc-icon-well--danger"><Icon alert-triangle/></span>` + `<div><h2 id="h-sel">{title}</h2><span class="mini num">{id} · {location.address}</span></div>`; chips row: `StatusChip critical` (if critical) + status chip; `Notice danger` (`why`) with `priorityReason(...)` (shown for level ≥ medium); score row: `ScoreBadge lg` + `<span class="small">من 100 · الميعاد {formatWhen(dueAt)} ({formatDueLabel})</span>`; `<hr class="ftc-divider">`; `KvList` `الجهة` ({department}), `المُبلّغين` (`{n} مواطنين`), `أمر الشغل` (`{workOrderId}` or `لسه`); buttons `.btn-split`: `Button primary sm href=/incidents/{id}` `افتح البلاغ` and, without a work order, `Button secondary sm href=/incidents/{id}#work-order` `أنشئ أمر شغل` (with a work order: `افتح أمر الشغل` → `/work-orders?open=`). Nothing selected: `EmptyState icon=pin title="اضغط على دبوس" message="هتشوف هنا تفاصيل البلاغ."`.
- Summary card (id `h-sum`, title `على الخريطة دلوقتي`): `<ul class="sum">` rows `<StatusChip/> <span class="n">{count}</span>` for `وصل`, `اتحوّل`, `جاري التنفيذ`, `اتصلّح`, `خطر`; footer `.mini`: `الدبابيس القريبة من بعض بتتجمّع في دايرة سودا بالعدد. بنحتفظ بالخريطة بسيطة عشان تشتغل على النت الضعيف.`

**States.** Loading: filters card renders, map frame skeleton, right cards skeletons. Empty after filters: pill `مفيش بلاغات بالفلاتر دي` on the map. Error: `ErrorState` in place of the map frame. Staff: server-scoped data, the department select locked to their department. No toasts on this page.

---

### 3.6 `/service-requests` — Service requests (`ServiceRequests.html`)

`<title>`: `FixTheCity — مركز القيادة: طلبات الخدمات`. Data: `GET /admin/service-requests` (once, all statuses; day asc) → `AdminServiceRequest[]` (`id, serviceType, details{items,day,slot,payment,note}, location, status, timeline, department, paid, assignee, workOrderId`). Mutations: `PATCH /admin/service-requests/{id} { status?, day?, slot?, assignee?, note? }`.

**Layout.** PageHead → `.mini-kpis` (4) → `.fbar` filters → `.sr-layout` (`minmax(0,1fr) | 380px`, ≤1200 one column).

**PageHead.** Title `طلبات الخدمات`; subtitle `CityServe · رفع مخلفات كبيرة وصيانة أشجار بميعاد · {formatLongDate(now)}` → `… · الأربعاء 21 أكتوبر`. Search `ابحث في الطلبات` / `ابحث برقم الطلب أو الشارع` (client-side on id and address).

**Mini KPIs** (`KpiCard`, note tone mute unless stated):
| Label | Value | Note |
| --- | --- | --- |
| `طلبات جديدة` | count `status==='received'` | `محتاجة جدولة` |
| `متجدولة النهارده` | count `details.day === today` | `{n} جاري التنفيذ` (those in `in_progress`) |
| `مستنية تأكيد دفع` | count `payment ∈ {fawry, instapay}` and `!paid` and status not resolved | `فوري وإنستاباي` |
| `اتنفّذت الأسبوع ده` | resolved with `timeline` resolved entry in the last 7 days | `<Delta/> عن الأسبوع اللي فات` (good when >0; hide the note when the previous week has no data) |

**Filters** (`<div class="fbar" role="group" aria-label="فلاتر">`): single-choice chips `الكل ({n})` · `رفع مخلفات كبيرة ({n})` · `صيانة أشجار ({n})` · `النهارده ({n})` (counts are over the unfiltered list; labelled with the count in parentheses exactly like that); pill selects `طريقة الدفع` (`كل طرق الدفع`, `كاش مع العامل`, `فوري`, `إنستاباي`, `محفظة موبايل`) and `الحالة` (`كل الحالات`, `وصل`, `اتحوّل`, `جاري التنفيذ`, `اتصلّح`).

**Table** (card with padding 0, `DataTable` `tableClassName="sr-table"` clickable, `minWidth 640`, `ariaLabel="طلبات الخدمات"`). Columns:
| Header | Cell |
| --- | --- |
| `الطلب` | `.type`: `<span class="ftc-icon-well"><Icon trash\|tree size=18/></span><div><span class="strong num">{id}</span><span class="mini" style="display:block">{serviceTypeLabel}</span></div>` (`bulky_waste` → `رفع مخلفات كبيرة` + `trash`; `tree_maintenance` → `صيانة أشجار` + `tree`) |
| `العنوان والجهة` | `{location.address}<span class="mini" style="display:block">{department}</span>` |
| `اليوم والفترة` (nowrap) | `{formatDayDM(day, now)}<span class="mini num" style="display:block">{formatSlot(slot)}</span>` → `الخميس 22/10` / `9 ص – 12 ظ`; today shows `النهارده 21/10` |
| `الدفع` (nowrap) | `{paymentLabel}{paid && payment !== 'cash' ? ' · مدفوع' : ''}` → `كاش مع العامل`, `إنستاباي · مدفوع`, `فوري · مدفوع`, `محفظة موبايل`; unpaid non-cash adds ` · مستنية الدفع` |
| `الحالة` | `StatusChip incident` |
First row auto-selected on desktop. Row click/Enter selects.

**Detail panel** (`<aside class="ftc-card" aria-labelledby="h-sel">`):
1. `card-head`: `<h2 class="sec-title" id="h-sel">{id}</h2><p class="sec-sub">{serviceTypeLabel} · {department}</p>` + status chip.
2. `<h3 class="strong" style="margin:0 0 8px;font-size:14px">` `اللي محتاج يترفع` (tree service: `الشغل المطلوب`) + `<ul class="items">` one `<li><Icon check size=16/>{item}</li>` per `details.items`; `<p class="small" style="margin:10px 0 0"><span class="ftc-muted">ملحوظة المواطن:</span> {details.note}</p>` only if a note exists.
3. `<hr class="ftc-divider">` + `KvList`: `العنوان` ({address}), `الميعاد` (`{formatDayDM(day)} · {formatSlot(slot)}`), `الدفع` ({payment label}), `الرسم` (`حسب لائحة الحي`), `المواطن` (`مواطن`).
4. `<hr>` + capacity block `.cap`: `<div class="row-between"><span class="strong" style="font-size:14px">{weekday(day)} {slot short}</span><span class="mini num">{booked} من {CAP} طلبات</span></div>` + `<span class="ftc-bar ftc-bar--gold" role="img" aria-label="{booked} من {CAP}"><span style="width:{booked/CAP*100}%"/></span>` + `.mini`: `فاضل {formatSpots(CAP-booked)} على {assignee ?? 'العربية'}.` → `فاضل مكانين على عربية النظافة 7.`; full → `الفترة دي كاملة` in `late-cell` colour. `booked` = requests in the list with the same `day` and `slot` (and not resolved); `CAP = 6` (UI constant, one truck per slot).
5. Form (`<form class="side-form" style="margin-top:14px">`): `SelectField id=status label="الحالة"` (4 statuses, current preselected); `SelectField id=truck label="العربية أو الفريق"` (options by service type: bulky → `عربية نظافة 7 · 3 أفراد`, `عربية نظافة 4`, `فريق مخلفات البناء 1`; tree → `فريق الحدائق 1`; preselect `assignee` if set); `TextArea id=note label="رسالة للمواطن"` (required when the status changes or for `ابعت رسالة للمواطن`) + `CitizenPreview` below it; buttons: `Button primary block icon="truck"` `جدوِل العربية` (sets status to `assigned` when current is `received`/`triaged`, requires a note, calls `PATCH { assignee, status, note }`; when already assigned it only updates the assignee and the note is optional), `.btn-split`: `Button secondary sm` `وزّع على فريق` (`PATCH { assignee }`, no status change, no note needed) and `Button secondary sm` `غيّر الميعاد` (opens a `Modal` titled `غيّر الميعاد` with `TextField type=date` `اليوم`, `SelectField` `الفترة` (`9 ص – 12 ظ`, `2 م – 5 م`), optional `TextArea` `رسالة للمواطن`, actions `احفظ الميعاد` / `إلغاء`; `PATCH { day, slot, note? }`), then `Button ghost sm icon="send"` `ابعت رسالة للمواطن` (`PATCH { note }` only, note required; toast `اتبعتت الرسالة للمواطن.`).
6. `<hr>` + `<h3 class="strong" style="margin:0 0 10px;font-size:14px">` `السجل` + `Timeline`: entries from `timeline` oldest first (`title = note`, `who = {formatWhen(at)} · {actor}`, state `done`), plus a `current` row `في انتظار تحديد العربية` (who `دلوقتي`) while status is `received`.
Nothing selected: `EmptyState icon=truck title="اختار طلب من القائمة"`.

**States.** Loading: KPI skeletons, 6 table skeleton rows, panel skeleton. Empty: `EmptyState icon=truck title="مفيش طلبات بالفلاتر دي" message="غيّر الفلاتر أو امسحها." action=<Button secondary sm>امسح الفلاتر</Button>`; no requests at all: `title="مفيش طلبات خدمات" message="الطلبات الجديدة هتظهر هنا."`. Error: `ErrorState` in place of the table card. Validation: `اكتب رسالة للمواطن` (note), `اختار الفريق أو العربية` (when `جدوِل العربية`/`وزّع على فريق` has no selection), `اختار يوم` (date modal). Staff: sees requests of their department only (server); controls enabled for those.

---

### 3.7 `/work-orders` — Work orders board (`WorkOrders.html`)

`<title>`: `FixTheCity — مركز القيادة: أوامر الشغل`. Data: `GET /admin/work-orders` (all statuses; `done` ones are shown only when `resolvedAt` is within the last 7 days — extension to keep the column short), `GET /admin/departments`, drawer: `GET /admin/work-orders/{id}`. Deep link `?open=WO-318` opens the drawer.

**Layout.** PageHead → department chip row → `.board-wrap > .board` (4 columns `minmax(240px,1fr)`, horizontal scroll below ~1000px). Column order in the DOM (first = right in RTL): `اتسلّم` (open), `اتوزّع` (assigned), `شغالين عليه` (in_progress), `اتحلّت` (done).

**PageHead.** Title `أوامر الشغل`; subtitle `لوحة المتابعة · {total} أمر شغل · {lateText}` where `lateText` = `{n} متأخرين` (n≥1) or `مفيش متأخر` → `لوحة المتابعة · 11 أمر شغل · 2 متأخرين`. Search `ابحث في أوامر الشغل` / `ابحث برقم الأمر أو البلاغ` (client-side on `id`, `incidentId`, `serviceRequestId`, `title`).

**Department chips** (`role="group" aria-label="فلتر الجهة"`, single choice): `الكل` then one chip per department from `GET /admin/departments` (typically `صيانة الطرق`, `الصرف الصحي`, `هيئة النظافة والتجميل`, `إنارة الحي`, `حدائق الحي`, `شركة مياه الشرب`). Filtering is client-side on `wo.department`. Staff: the group is hidden (single department).

**Columns and cards.** `KanbanColumn` (2.23) with the cards of that status, sorted: late first, then `dueAt` asc. `WorkOrderCard` as specified. Column empty text `مفيش أوامر شغل هنا`. Clicking a card opens the drawer and sets `?open=`.

**Drawer** (`Drawer`, `ariaLabel="تفاصيل أمر الشغل {id}"`, titleId `dr-t`). Content top to bottom:
1. Header: title `{id}`, sub `{title}`, close `اقفل`.
2. Chips: `StatusChip workorder` + `Tag` for the linked incident priority (`priorityScore` present): `أولوية {level word} · {score}` (`ftc-tag-gold` for high, `ftc-tag-danger` for critical, `ftc-tag-muted` otherwise) → `أولوية عالية · 66`; external orders add `Tag ext` `جهة خارجية`.
3. `KvList`: `البلاغ` (`<Link>{incidentId}</Link> · {followers} مواطنين`, or for service requests `الطلب` `<Link>{serviceRequestId}</Link>`), `الجهة`, `الفريق` (team line), `المشرف` (`supervisor` or `—`), `التسليم` (`{formatDayWithTime(dueAt, now)}` → `النهارده 21/10 · 17:00`), `تكلفة تقديرية` (`formatEgp` → `4,500 جنيه`, class num).
4. `<hr class="ftc-divider hr0">`, `<h3 class="strong" style="margin:0 0 10px;font-size:14px">` `المهام` + `<ul class="tasks">`: each `<li class={done ? 'done' : ''}><button type="button" class="task" role="checkbox" aria-checked={done}><span class="box">{done && <Icon check size=14/>}</span>{label}</button></li>`. Clicking toggles the task: optimistic update, `PATCH /admin/work-orders/{id} { tasks }` with the full updated array; on failure revert and toast. Disabled (no click) when the order is `done`.
5. Update form: `StatusChangeForm kind="workorder" compact`: `SelectField` `الحالة` (`اتسلّم`, `اتوزّع`, `شغالين عليه`, `اتحلّت`), plus (non-external) `SelectField id=team label="الفريق"` (`من غير فريق` + `TEAMS[department]`; choosing a team on an `open` order moves the status select to `اتوزّع`), note `رسالة للمواطنين`, preview, submit `حدّث وابلّغ المواطنين`. Calls `PATCH /admin/work-orders/{id} { status, team?, teamSize?, note }`. A `done` order shows `Notice` `الأمر ده اتحلّ خلاص.` instead of the form.
6. `<h3 class="strong" style="margin:0 0 10px;font-size:14px">` `آخر تحديثات` + `Timeline` from `updates` **newest first**: `title = note`, `who = {formatWhen(at)} · {actor}`, state `done`.
7. Footer (margin-top auto): `Button secondary sm block href` `افتح البلاغ` → `/incidents/{incidentId}` (for service requests: `افتح الطلب` → `/service-requests`). The form's submit button above is the only primary button in the drawer.

**Interactions and API.** Task toggles and status updates as above. No drag-and-drop in this version. After a status update the card moves column (query invalidation) and the drawer stays open on the refreshed data.

**States.** Loading: four columns with 2 skeleton cards each; drawer body skeleton. Empty (no work orders at all): page-level `EmptyState icon=wrench title="مفيش أوامر شغل" message="أنشئ أمر شغل من صفحة البلاغ."`. Empty filtered: columns show their own empty text. Error: `ErrorState` replaces the board. Validation: `اكتب رسالة للمواطنين`, `اختار حالة غير الحالة الحالية`. Toast: `اتحدّث أمر الشغل {id}.`. Staff: only their department's orders; the form is enabled.

---

### 3.8 `/budget` — Repair budget (`Budget.html`), admin only

`<title>`: `FixTheCity — مركز القيادة: الميزانية`. Role gate: `session.role !== 'admin'` → page-level `ErrorState variant="forbidden"` with message `ميزانية الإصلاحات متاحة للمشرفين بس.` and action `Button secondary sm href=/incidents` `ارجع للبلاغات`; no API call. Data: `POST /admin/budget/optimize { budgetEgp }` → `BudgetPlan`; commit: `POST /admin/budget/commit { incidentIds }`.

**Layout.** PageHead (aligned to the bottom) → budget card → metric row (`kpis kpis--auto`, `kpi--md`) → `.plan-grid` (two `.plan-col`, `flex: 1 1 380px`; stacked on narrow screens).

**PageHead.** Title `ميزانية الإصلاحات`; subtitle `أحسن خطة إصلاح تجيب أعلى أولوية بالميزانية المتاحة · التكاليف تقديرية للمحاكاة`; action `Button primary` `حوّل الخطة لأوامر شغل` (disabled when the plan has no selected items or while the plan is loading).

**Budget card** — `BudgetSlider` (2.22): label `الميزانية المتاحة`, big value `{formatBudget}` (`300 ألف جنيه`), presets `تقشّف · 150 ألف` / `الميزانية الحالية · 300 ألف` / `بدون حد · {N} ألف`, range `50 ألف جنيه` … `600 ألف جنيه`. Initial value 300000. Each change (debounced 300 ms) → `POST /admin/budget/optimize { budgetEgp }`. `unlimitedEgp = min(600000, ceil((Σ costEgp of selected+skipped)/1000)*1000)`, known after the first response.

**Metric cards** (`KpiCard size="md"`):
| Label | Value | Sub |
| --- | --- | --- |
| `تكلفة الخطة` | `formatEgp(totalCost)` | `{selected.length} إصلاحات من {selected.length+skipped.length}` |
| `المتبقي` | `formatEgp(remaining)` | `مفيش إصلاح تاني يكفّيه` (when something is skipped) / `كل الإصلاحات داخلة` (nothing skipped) |
| `الأولوية المغطّاة` | `{round(coveredPriority/totalPriority*100)}%` in red (`style={{color:'var(--ftc-red)'}}` on the metric) | footer `<span class="cover-bar"><span style="width:{pct}%"></span></span>` |
| `مواطنين هيشوفوا حل` | `citizensServed` | `من {citizensTotal} بلّغوا` |

**Plan lists.**
- Left column (`<section aria-label="إصلاحات في الخطة">`, card): `<h2 class="sec-title"><span class="plan-dot" aria-hidden/>في الخطة ({n})</h2>` + `.plan-list` of `.plan-row.plan-row--in`: `<ScoreBadge/>` (white bg, gold-deep text via CSS) · `.t` = `<Link href=/incidents/{incidentId}>{title}</Link><span>{reason}</span>` · `<span class="cost">{formatEgp(costEgp)}</span>`. `reason` is the server's one-line Arabic reason (e.g. `أولوية 78 · قريب من مدرسة · 1,800 جنيه`); show it verbatim.
- Right column (`<section aria-label="إصلاحات خارج الخطة">`, card): `<h2 class="sec-title"><span class="plan-dot plan-dot--out" aria-hidden/>مؤجّلة ({n})</h2>`; `.plan-row--out` rows (grey score badge, muted cost) with the server's skip reason (e.g. `الميزانية مش مكفّية: محتاج 7,500 جنيه والمتبقي 2,100`); nothing skipped → `<p class="mini">كل الإصلاحات داخلة في الخطة.</p>`.
- Both lists are sorted by `priorityScore` desc (server order).

**Commit flow.** The header button opens `ConfirmModal`: title `تحويل الخطة لأوامر شغل`, body `هنعمل أمر شغل لكل إصلاح من الـ {n} إصلاحات اللي في الخطة (تكلفة {formatEgp(totalCost)}). البلاغات اللي ليها أمر شغل بالفعل مش هتتكرر.`, confirm `حوّل الخطة`, cancel `إلغاء`. Confirm → `POST /admin/budget/commit { incidentIds: selected.map(i=>i.incidentId) }` → toast `اتعمل {n} أمر شغل من الخطة.` (n = number returned) → `router.push('/work-orders')`.

**States.** Loading (first response): card renders with the slider disabled, metric skeletons, 4 skeleton rows per list. Recomputing: previous result stays with `.is-busy`. Empty (no candidates): `EmptyState icon=wallet title="مفيش بلاغات مفتوحة تتحط في خطة" message="لما يوصل بلاغات جديدة هتظهر هنا."` and the commit button disabled. Error: `ErrorState` in place of the lists + metrics (slider stays); commit failure keeps the modal closed and shows `toast.error(detail)`. Validation: none (the slider is bounded). Non-admin: forbidden state.

---

## 4. Formatting and text helpers

### 4.1 Rules

- Western digits `0-9` only. Produce them with `Intl.NumberFormat('en-US')` / explicit string building; never `toLocaleString('ar')`.
- All dates and clock times are shown in **Africa/Cairo** time, 24-hour `HH:mm`, regardless of the browser zone (this also keeps SSR and the browser identical). Use `Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', … }).formatToParts()` and read the parts.
- All helpers are pure; `now` is an injectable argument (`number` epoch ms, default `Date.now()`) so Vitest tests are deterministic.
- Arabic plural helper used throughout: `dual(n, one, two, few, many)`: 1 → `one`, 2 → `two`, 3–10 → `few(n)`, ≥11 → `many(n)`.

### 4.2 Numbers and money (`src/lib/format.ts`)

| Function | Input → Output |
| --- | --- |
| `formatNumber(n)` | `128` → `128` · `1800` → `1,800` · `1234567` → `1,234,567` |
| `formatEgp(n)` | `1800` → `1,800 جنيه` · `0` → `0 جنيه` · `7500` → `7,500 جنيه` · `162300` → `162,300 جنيه` |
| `formatThousands(n)` | `300000` → `300 ألف` · `150000` → `150 ألف` · `1500` → `1.5 ألف` · `500` → `500 جنيه` (below 1000 falls back to `formatEgp`) |
| `formatBudget(n)` | `300000` → `300 ألف جنيه` · `150000` → `150 ألف جنيه` · `612500` → `612,500 جنيه` (not a multiple of 1000 → `formatEgp`) |
| `formatDecimal(n, digits = 1)` | `2.4` → `2.4` · `3` → `3` · `0.6` → `0.6` · `2.45` → `2.5` (trailing `.0` removed) |
| `formatDays(n)` | `2.4` → `2.4 يوم` · `3` → `3 يوم` · `0.6` → `0.6 يوم` · `1` → `1 يوم` |
| `formatPercent(part, total)` | `(9, 128)` → `7%` · `(0, 0)` → `0%` · `(44, 128)` → `34%` (rounded) |
| `formatDelta(n)` | `14` → `+14` · `-3` → `−3` (U+2212) · `0` → `0` · render inside `<bdi dir="ltr">` |
| `formatCitizens(n)` | `1` → `مواطن واحد` · `7` → `7 مواطنين` · `11` → `11 مواطن` (uses `dual`: 2 → `مواطنين اتنين`, 3–10 → `N مواطنين`, ≥11 → `N مواطن`) |
| `formatWorkDays(n)` | `1` → `يوم عمل` · `2` → `يومين عمل` · `3` → `3 أيام عمل` · `7` → `7 أيام عمل` |
| `formatSpots(n)` | `1` → `مكان واحد` · `2` → `مكانين` · `4` → `4 أماكن` |
| `shortAddress(a)` | `شارع يوسف عباس، الحي السابع، مدينة نصر` → `شارع يوسف عباس` (text before the first `،`) |

### 4.3 Dates, times, durations

Fixtures for the examples: `now = 2026-10-21T10:00:00Z` (= `13:00` in Cairo, Wednesday).

| Function | Input → Output |
| --- | --- |
| `formatTime(iso)` | `2026-10-21T06:30:00Z` → `09:30` · `2026-10-20T12:20:00Z` → `15:20` |
| `formatDateTime(iso)` | `2026-10-20T12:20:00Z` → `20 أكتوبر 15:20` · `2026-10-21T06:48:00Z` → `21 أكتوبر 09:48` (always the date, no relative word) |
| `formatWhen(iso, now)` | same day → `النهارده 09:30` · previous day → `أمس 14:10` · older → `20 أكتوبر 15:20` · `2026-10-20T12:20:00Z` with the fixture → `أمس 15:20` |
| `formatLongDate(iso\|now)` | `now` → `الأربعاء 21 أكتوبر` |
| `formatDayDM(iso, now)` | tomorrow `2026-10-22` → `الخميس 22/10` · today → `النهارده 21/10` · `2026-10-19` → `الاثنين 19/10` · `2026-10-18` → `الأحد 18/10` (weekday + `d/m`, no zero padding: `2026-11-05` → `الخميس 5/11`). A bare `YYYY-MM-DD` is a Cairo calendar date, never parsed as UTC midnight |
| `formatDayWithTime(iso, now)` | `2026-10-21T05:40:00Z` → `النهارده 08:40` · `2026-10-18T…` → `الأحد 18/10` (today shows the time; other days show `formatDayDM`) |
| `formatDueField(iso)` | `2026-10-21T12:20:00Z` → `الأربعاء 21 أكتوبر · 15:20` |
| `formatSlot(slot)` | `morning` → `9 ص – 12 ظ` · `afternoon` → `2 م – 5 م` (en dash with spaces) |
| `formatSpan(ms)` | `5 h` → `5 س` · `19 h` → `19 س` · `40 min` → `40 د` · `24 h` → `1 يوم` · `48 h` → `2 يوم` · `3 d` → `3 أيام` · `5 d` → `5 أيام` · `11 d` → `11 يوم` (hours/minutes floored, minimum `1 د`; days: 1–2 → `N يوم`, 3–10 → `N أيام`, ≥11 → `N يوم`) |
| `formatDueLabel(hoursLate)` | `-4.6` → `باقي 5 س` · `-0.2` → `باقي 1 س` · `-30` → `باقي يوم` · `-50` → `باقي يومين` · `5.6` → `متأخر 6 س` · `0.3` → `متأخر 1 س` · `26` → `متأخر يوم` · `49` → `متأخر يومين` · `80` → `متأخر 3 أيام` · `300` → `متأخر 12 يوم` |
| `hoursLateOf(dueAt, now)` | `(now − dueAt) / 3_600_000` (positive = late) |
| `formatRelative(iso, now)` | `<1 min` → `دلوقتي` · 1 min → `من دقيقة` · 2 → `من دقيقتين` · 5 → `من 5 دقايق` · 11 → `من 11 دقيقة` · 1 h → `من ساعة` · 2 h → `من ساعتين` · 5 h → `من 5 ساعات` · 12 h → `من 12 ساعة` · 1 d → `امبارح` · 2 d → `من يومين` · 3–10 d → `من 3 أيام` · 11–29 d → `من 12 يوم` · 1 month → `من شهر` · 2 → `من شهرين` · more → `من 3 شهور` (same thresholds as `relativeTimeAr` in the mobile app, Western digits) |

Rules for `formatDueLabel`: late hours `r = round(h)`; if `r < 24` → `متأخر {max(1,r)} س`, else `d = floor(h/24)` and the text is `متأخر ` + `dual(d, 'يوم', 'يومين', n=>`${n} أيام`, n=>`${n} يوم`)`. Remaining hours `r = ceil(-h)`; if `r < 24` → `باقي {max(1,r)} س`, else `d = floor(r/24)` → `باقي ` + the same `dual`.
Weekday names (Sunday-first, exactly these spellings): `الأحد`, `الاثنين`, `الثلاثاء`, `الأربعاء`, `الخميس`, `الجمعة`, `السبت`. Month names: `يناير`, `فبراير`, `مارس`, `أبريل`, `مايو`, `يونيو`, `يوليو`, `أغسطس`, `سبتمبر`, `أكتوبر`, `نوفمبر`, `ديسمبر`. (Do not reuse `WEEKDAYS_AR` from the mobile `time.ts`: it uses short spoken forms like `الاتنين`.)
Required Vitest cases: every example row above, Cairo conversion across midnight (`2026-10-21T21:30:00Z` → `22 أكتوبر 00:30`, Cairo is UTC+3 on that date), `formatDueLabel` boundaries (0, 23.6, 24, 47.9, 48, 240), `formatSpan` boundaries (59 min, 60 min, 23 h 59 min, 24 h).

### 4.4 Domain text helpers (`src/lib/text.ts`)

```ts
export const SEVERITY_AI_AR: Record<Severity, string> = { low: 'خطورة بسيطة', medium: 'خطورة متوسطة', high: 'خطورة عالية', critical: 'خطورة حرجة' };
export const WORK_ORDER_LABEL_AR = { open: 'اتسلّم', assigned: 'اتوزّع', in_progress: 'شغالين عليه', done: 'اتحلّت' } as const;
export const SERVICE_TYPE_LABEL_AR = { bulky_waste: 'رفع مخلفات كبيرة', tree_maintenance: 'صيانة أشجار' } as const;
export const PAYMENT_LABEL_AR = { cash: 'كاش مع العامل', fawry: 'فوري', instapay: 'إنستاباي', wallet: 'محفظة موبايل' } as const;
export const SOURCE_LABEL_AR = { app: 'تطبيق', web: 'موقع' } as const;
export function scoreTone(score: number): 'urgent' | 'high' | 'low';        // >=85 urgent, >=65 high, else low
```

`factorWhy(factor, incident, now)` — the one-line reason under each priority factor (incident detail). `daysOpen = daysBetween(createdAt, now)` (whole days), `target = getCategory(categoryId).targetDays`, `n = linkedReports.length`:

| key | text |
| --- | --- |
| `severity` | `{SEVERITY_AI_AR[severity]}: بتتحسب {points} من {max}.` → `خطورة حرجة: بتتحسب 40 من 40.` |
| `sensitive` | points>0: `قريب من {sensitivePlace}.` · else `مفيش مدرسة أو مستشفى قريبة من الموقع.` |
| `reporters` | n=1: `بلاغ واحد بس: مفيش نقط إضافية.` · else `{n} مواطنين بلّغوا: ({n} − 1) × 3 = {(n-1)*3}، والحد الأقصى {max}.` → `7 مواطنين بلّغوا: (7 − 1) × 3 = 18، والحد الأقصى 20.` |
| `age` | `مفتوح من {formatSpanLong(now-createdAt)}، والمدة بتتحسب بالأيام الكاملة. المستهدف {formatWorkDays(target)}.` + (open and `min(15, round((daysOpen+1)/target*10)) > points`: ` لو فضل مفتوح لبكرة هيزيد {delta} نقاط.`) → `مفتوح من 19 ساعة، والمدة بتتحسب بالأيام الكاملة. المستهدف يوم عمل. لو فضل مفتوح لبكرة هيزيد 10 نقاط.` |
| `equity` | points>0: `الحي ده متصنّف منطقة محتاجة اهتمام أكتر.` · else `الحي ده مش متصنّف منطقة محتاجة اهتمام أكتر.` |
`formatSpanLong(ms)`: `<1 h` → `{m} دقيقة` · `<24 h` → `19 ساعة` / `ساعة` / `ساعتين` / `3 ساعات` (dual, hours) · else days with `dual` (`يوم`, `يومين`, `3 أيام`).

`shortFactorLabel(key, incident)` — labels for the compact breakdown: `severity` → `الخطورة: {عالية|حرجة|متوسطة|بسيطة}` · `sensitive` → `قريب من {sensitivePlace}` or `مدرسة أو مستشفى قريبة` · `reporters` → `{n} مواطنين بلّغوا` (use `formatCitizens`) · `age` → `مفتوح {formatSpan(open)} من {formatSpan(target)}` · `equity` → `منطقة محتاجة اهتمام`.

`activityIcon(item)` → `{ icon, mod }` as defined in 3.2 (resolved → `check`/`ic--ok`; received → `alert-triangle`/`ic--urgent`; AI → `sparkles`/`ic--ai`; else `wrench`/``).
`TEAMS: Record<string, { name: string; size: number }[]>` (UI constant until the backend exposes teams): `صيانة الطرق` → `فريق الطرق 1` (4), `فريق الطرق 2` (5), `فريق الطرق 3` (6) · `هيئة النظافة والتجميل` → `فريق النظافة 1` (4), `2` (5), `3` (5), `4` (5) · `إنارة الحي` → `فريق الإنارة 1` (3), `فريق الإنارة 2` (3) · `حدائق الحي` → `فريق الحدائق 1` (4) · `الصرف الصحي` → `فريق الصرف 1` (4), `فريق الصرف 2` (4). External departments have no teams. (Sizes for teams not named in the mockups are placeholders.)

---

## 5. Checklist for the reviewer

- [ ] Every page in section 3 renders loading, empty, error and (where listed) forbidden states.
- [ ] No Arabic-Indic digit anywhere; money `1,800 جنيه`; dates `الخميس 22/10`; durations `باقي 5 س` / `متأخر يومين`.
- [ ] Status words and colours identical in table, chip, map legend, pin, timeline, kanban dot.
- [ ] Every status-change form blocks an empty note with `اكتب رسالة للمواطنين` and shows the live citizen preview.
- [ ] AI card says `اقتراح الذكاء الاصطناعي`, shows `%`, has `أكّد التصنيف` / `غيّر التصنيف`; duplicates never merge without the confirm modal.
- [ ] Map: centre `30.056, 31.330`, zoom 15, five pin kinds, ink cluster bubbles, `خطر` pill on critical pins, legend and zoom buttons are RTL overlays on a `dir="ltr"` map.
- [ ] No colour outside the token list, no gradients, no dark mode.
- [ ] Tab through each page: every control reachable, gold focus ring visible, Esc closes Drawer/Modal.
- [ ] At 1280, 1440, 1100, 900, 768 and 390 px nothing overflows horizontally except intentional table/board scrolling.
