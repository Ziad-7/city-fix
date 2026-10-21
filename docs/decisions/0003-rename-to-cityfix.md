# 0003 — Rename the product to CityFix

- **Date:** 2026-10-21
- **Status:** Accepted

## Decision

- The product is called **CityFix** in English and **سيتي فيكس** in Arabic (it was FixTheCity / فيكس ذا سيتي).
- Logo lockups: English "City" in `ink` + "Fix" in `red`; Arabic "سيتي" in `ink` + "فيكس" in `red`. The mark (red pin with a check and the gold dot) does not change. Files: `docs/design/assets/cityfix-*.svg`.
- Everything people see uses the new name: app name, screens, design pack, docs.

## What stays (on purpose)

- **Technical IDs:** Android/iOS package `com.fixthecity.mobile`, Expo slug `fixthecity`, link scheme `fixthecity://`. Changing them would create a new EAS project and install as a separate app; existing builds and installs keep working.
- **Readable IDs** `FTC-…` for reports (part of the API contract and seed data) and the internal CSS variable prefix `--ftc-`.
- The GitHub repo name `fix-city`.
- History: older progress-log entries and review documents keep the old name.
