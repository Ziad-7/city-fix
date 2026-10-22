# Mobile handoff: Expo Go compatibility and Android APK crash

Date: 2026-10-21. Audience: the citizen mobile app developer.

The app now opens in the user's Android Expo Go 57.0.9. **Update:** the startup crash has been traced and fixed in the repo; see [the crash analysis](2026-10-21-android-startup-crash.md). A new APK still has to be built to confirm. The original text below is kept for the record: the previously built standalone APK's startup crash is **still unresolved**: no device crash trace has been collected, and no corrected APK has been built or verified in this session.

## What happened and why

1. A previous chat completed an EAS Android APK build. The user installed it, but it closed before the phone-number sign-in screen appeared. This was a launch crash after successful installation, rather than a reported APK installation failure.
2. The user requested an Expo Go preview to try the app without installing our custom APK. We started Metro in a managed cloud workspace and exposed it through an Expo tunnel, then shared a QR code.
3. The project used SDK 58, but the user's latest Play Store installation reported support for SDK 57 (client version 57.0.9). Expo Go rejected the preview as incompatible. Updating the phone app did not resolve that mismatch.
4. We aligned the project and its dependencies with SDK 57 and restarted Metro with a cleared cache. The user confirmed the new QR code worked. This confirms that the preview opens, not that every feature or standalone release has been tested.
5. Changes were pushed to `feat/mobile-citizen-app` and merged into `main` in [PR #6](https://github.com/Ziad-7/fix-city/pull/6), merge commit `6a0319ce33a0541f26cc29ecde623f039449782a`.

Use the SDK 57 versions in `package.json` and `package-lock.json` until an intentional SDK migration is tested against the target Expo Go or development build. The SDK change addressed preview compatibility; it is not a diagnosis of the original APK crash.

## Repository changes in PR #6

| File | Change and reason |
| --- | --- |
| `apps/mobile/package.json` | Expo 58 → 57, React Native 0.88.0 → 0.86.3, React/React DOM 19.3.0 → 19.2.3. Expo Router, Expo modules, maps, screens, safe-area context, SVG, Jest and React types aligned using `expo install --fix`. |
| `apps/mobile/package.json` | Explicit SDK-compatible `expo-modules-core`, Reanimated 4.5.1 and Worklets 0.10.1 dependencies. Jest initially could not resolve modules-core; npm's existing tree/lock selected incompatible optional animation peers. A clean dependency installation and regenerated lockfile resolved this. |
| `apps/mobile/package-lock.json` | Regenerated for the SDK 57 dependency graph. Use `npm ci` for a reproducible install. |
| `apps/mobile/src/components/TabBar.tsx` | SDK 57's tab-bar props expose `navigation`, rather than SDK 58's `emitter` and `navigateToTab`. Tab presses now call `navigation.emit(...)`, then `navigation.navigate(route.name, route.params)` when not already active and not prevented. Typechecking caught the API difference. |
| `apps/mobile/app.json` | Expo CLI added the `expo-status-bar` config plugin and reformatted the localization plugin options. |
| `docs/progress-log.md` | Added compatibility and verification notes. The log's overlapping additions were resolved by retaining both our entry and the existing main-branch entries. |

Existing remote mobile review fixes and main-branch design follow-ups were preserved. No backend, authentication-service, or API-contract change was made by this compatibility fix. The demo still uses mock services by default.

## How the QR preview works

```text
Cloud workspace: Metro dev server on port 8081
    → Expo public tunnel
    → QR code containing the Expo Go project URL
    → Expo Go on the Android phone downloads and runs the development bundle
```

The QR code points to a temporary development session, not a hosted standalone APK. Metro, the tunnel and the cloud workspace must remain running. A restart can produce a different URL and requires a new QR code. Anyone with the tunnel link can access the development bundle; the user explicitly approved creating the public tunnel. That approval was for this session, not a team-wide publishing policy.

Cloud-specific setup encountered in this session:

- The configured Expo credential was reported ready and used without printing it. Do not commit tokens or runtime credentials.
- The environment allowed `api.expo.dev`, `expo.dev` and `*.on.expo.app`. Initially the tunnel host was blocked; the applied allowlist resolved that denial.
- The sandboxed command needed network permission. Expo's tunnel WebSocket client also attempted direct DNS/network access, which failed in this proxy-only environment. A temporary Node preload used `HttpsProxyAgent` with the inherited HTTPS proxy to route HTTPS/WebSocket requests through the required proxy; TLS verification remained enabled.
- Expo's default home/cache location was unwritable. `__UNSAFE_EXPO_HOME_DIRECTORY=/workspace/.expo-runtime` redirected Expo's runtime settings/cache to a writable directory. The SDK 57 tunnel was selected with `EXPO_UNSTABLE_TUNNEL_V2=1` (otherwise this CLI tried ngrok).
- Metro ran with `CI=1` and `--clear`; CI mode disables reload/watch behavior. Restart it after edits, or use a supported interactive development setup for live reload.

These proxy/cache adaptations, the generated QR images and tunnel processes were runtime-only and were not committed. They are not requirements for an ordinary local development machine. Do not reuse an old session's QR code as a permanent project link.

## Run the current code locally

From an up-to-date checkout of `main`:

```bash
cd apps/mobile
npm ci
npx expo start --clear
```

Use Expo Go supporting SDK 57. For a LAN preview, the phone must be able to reach the PC; if needed, configure a supported tunnel for your environment. Use `npx expo install <package>` for SDK-compatible additions.

Demo sign-in: a valid Egyptian mobile number and verification code `123456`. OTP is mocked; no real SMS or WhatsApp message is sent.

## What was verified

- Public preview manifest reported `sdkVersion: 57.0.0`.
- The Android development bundle was fetched successfully through the tunnel after the final dependency installation.
- The user confirmed the SDK 57 preview works on their Android phone.
- Typechecking, linting and all **89 tests in 17 suites** passed after integrating the latest mobile and main-branch changes.
- GitHub's `mobile-ci` job passed installation (`npm ci`), typechecking, linting and tests before PR #6 merged.
- `main` was synchronized locally after the merge, with a clean working directory.

An earlier `expo-doctor` run completed 19/21 checks; config-schema and React Native Directory requests failed because of network/API access. We did not claim a fully passing Doctor run. Dependency alignment was separately confirmed by `expo install --check`.

## Remaining work: reproduce the standalone APK crash

Historical build reference: EAS build `fe133744-b43d-47f1-a44e-66d08c1e5277` from the previous chat. Retrieve the original artifact from the authorized EAS project/build history when reproducing; the previous artifact download could not be retrieved in this cloud investigation. Verify its source revision and build configuration rather than assuming it contains the current SDK 57 code.

Recommended next steps for the mobile developer:

1. Reproduce with the **original crashing APK** on the user's Android phone if available. Record phone model, Android version, APK/build ID and the exact startup behavior. Those device details were not established in this chat.
2. Connect the phone by USB and enable USB debugging, or start an Android emulator in Android Studio's Device Manager. Install the original APK (dragging it onto the emulator is sufficient).
3. Open Android Studio's Logcat, select the device and filter for package `com.fixthecity.mobile`. Start capture before launching the app. Keep the full crash trace, including `FATAL EXCEPTION`, `Caused by`, native fatal signals and any JavaScript exception preceding the process exit.
4. If using platform tools directly, run `adb devices`, start `adb logcat -v threadtime > cityfix-startup.log`, reproduce the crash, then stop capture. Keep the relevant trace with the bug report and remove unrelated personal data before sharing.
5. Diagnose from the trace. Native module/configuration failures, JavaScript startup errors and device-specific problems remain possibilities, not established causes. Expo Go uses its own native runtime, so a successful preview does not prove the standalone binary is healthy.
6. Once the cause is identified, fix it, build a new standalone APK from the intended current commit, and verify a cold launch through sign-in on the real phone. Include the exact commit, EAS build ID, Android version and result in the follow-up report.

Android Studio alone is enough for the emulator and Logcat workflow. **Expo Orbit is optional:** it helps select devices and install/launch local APKs or EAS builds; it does not replace the Android SDK/emulator or diagnose the crash itself. A real phone with SDK platform tools (`adb`) is another option without the full Android Studio application.

A standalone release APK normally embeds its JavaScript bundle and does not depend on this cloud Metro server. Development builds can require Metro. Installing an old APK after a GitHub merge still runs the old packaged code; rebuild it to test the new revision.

References: [Expo Orbit](https://docs.expo.dev/build/orbit/), [runtime debugging and native logs](https://docs.expo.dev/debugging/runtime-issues/), [SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/).
