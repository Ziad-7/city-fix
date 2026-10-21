# FixTheCity design pack

The visual identity and screen designs for FixTheCity: the citizen mobile app, the citizen website and the Command Center (admin web). Arabic-first, right-to-left, in the colours of the Egyptian flag.

**The rule:** everyone follows [`identity.html`](identity.html) and [`css/fixthecity.css`](css/fixthecity.css). [`tokens.json`](tokens.json) is the source of truth for every value; if a value changes, change it there first, then update the CSS, the Tailwind theme and `apps/mobile/src/theme/tokens.ts`.

## Folder map

```
docs/design/
├── index.html            design hub: links to everything
├── identity.html         the visual identity guide (colour, type, logo, components, rules)
├── brand-book.md         brand idea, voice, "Made for Egypt" rules
├── tokens.json           design tokens (source of truth)
├── css/fixthecity.css    shared stylesheet: --ftc-* variables and .ftc-* classes
├── assets/               logo mark, Arabic/English lockups, Cairo skyline (SVG)
└── screens/
    ├── mobile/           10 phone screens (390px)
    ├── web/              10 citizen website screens
    └── admin/            8 Command Center screens
```

## How to open

- Locally, after cloning: `open docs/design/index.html` (or double-click the file). No build step; fonts load from Google Fonts.
- Online, public preview of the `main` branch (the repo is public): <https://raw.githack.com/Ziad-7/fix-city/main/docs/design/index.html>

## Pages

- [Design hub](index.html) · [preview](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/index.html)
- [Identity guide](identity.html) · [preview](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/identity.html)
- [Brand book](brand-book.md) · [tokens.json](tokens.json) · [fixthecity.css](css/fixthecity.css)

## Screens

### Mobile app

| Screen | الشاشة | File | Preview |
| --- | --- | --- | --- |
| Sign in | تسجيل الدخول | [screens/mobile/Login.html](screens/mobile/Login.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Login.html) |
| Home | الرئيسية | [screens/mobile/Main.html](screens/mobile/Main.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Main.html) |
| Category | نوع المشكلة | [screens/mobile/Category.html](screens/mobile/Category.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Category.html) |
| New report | بلاغ جديد | [screens/mobile/Report.html](screens/mobile/Report.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Report.html) |
| Success | تسلم إيدك | [screens/mobile/Success.html](screens/mobile/Success.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Success.html) |
| Track | متابعة البلاغ | [screens/mobile/Track.html](screens/mobile/Track.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Track.html) |
| Services | خدمات المدينة | [screens/mobile/Services.html](screens/mobile/Services.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Services.html) |
| My requests | طلباتي | [screens/mobile/Requests.html](screens/mobile/Requests.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Requests.html) |
| Map (CityPulse) | الخريطة | [screens/mobile/Map.html](screens/mobile/Map.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Map.html) |
| Profile | حسابي | [screens/mobile/Profile.html](screens/mobile/Profile.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/mobile/Profile.html) |

### Citizen website

| Screen | الشاشة | File | Preview |
| --- | --- | --- | --- |
| Sign in | تسجيل الدخول | [screens/web/SignIn.html](screens/web/SignIn.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/SignIn.html) |
| Home | الرئيسية | [screens/web/Home.html](screens/web/Home.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Home.html) |
| Category | نوع المشكلة | [screens/web/Category.html](screens/web/Category.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Category.html) |
| New report | بلاغ جديد | [screens/web/Report.html](screens/web/Report.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Report.html) |
| Success | تسلم إيدك | [screens/web/Success.html](screens/web/Success.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Success.html) |
| My requests | طلباتي | [screens/web/Requests.html](screens/web/Requests.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Requests.html) |
| Track | متابعة البلاغ | [screens/web/Track.html](screens/web/Track.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Track.html) |
| Services | خدمات المدينة | [screens/web/Services.html](screens/web/Services.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Services.html) |
| Map (CityPulse) | الخريطة | [screens/web/Map.html](screens/web/Map.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Map.html) |
| Profile | حسابي | [screens/web/Profile.html](screens/web/Profile.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/web/Profile.html) |

### Command Center (admin)

| Screen | الشاشة | File | Preview |
| --- | --- | --- | --- |
| Login | تسجيل الدخول | [screens/admin/Login.html](screens/admin/Login.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/Login.html) |
| Overview | نظرة عامة | [screens/admin/Overview.html](screens/admin/Overview.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/Overview.html) |
| Incidents | البلاغات | [screens/admin/Incidents.html](screens/admin/Incidents.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/Incidents.html) |
| Incident detail | تفاصيل البلاغ | [screens/admin/IncidentDetail.html](screens/admin/IncidentDetail.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/IncidentDetail.html) |
| Map | الخريطة | [screens/admin/Map.html](screens/admin/Map.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/Map.html) |
| Service requests | طلبات الخدمات | [screens/admin/ServiceRequests.html](screens/admin/ServiceRequests.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/ServiceRequests.html) |
| Work orders | أوامر الشغل | [screens/admin/WorkOrders.html](screens/admin/WorkOrders.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/WorkOrders.html) |
| Budget | الميزانية | [screens/admin/Budget.html](screens/admin/Budget.html) | [open](https://raw.githack.com/Ziad-7/fix-city/main/docs/design/screens/admin/Budget.html) |

Preview links follow the `main` branch, so a screen shows up there only after it is merged.
