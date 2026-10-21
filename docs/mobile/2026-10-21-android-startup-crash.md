# Android startup crash: root cause and fix

- **Date:** 2026-10-21 · **Build:** EAS `fe133744-b43d-47f1-a44e-66d08c1e5277` (SDK 58 era, R8-minified release)
- **Reproduced by:** Abood, on an Android 17 (API 37) x86_64 emulator in Android Studio. Crash about 200 ms after launch, every time.
- **Status:** fix in the repo; **needs a new EAS build to confirm** (Android/Maven downloads are blocked in Claude's sandbox, so it couldn't be built there).

## What crashed

```
java.lang.RuntimeException: Unable to get provider androidx.startup.InitializationProvider
Caused by: java.lang.RuntimeException: Failed to create an instance of class androidx.work.impl.WorkDatabase
  at androidx.work.WorkManagerInitializer...
  at androidx.startup.InitializationProvider.onCreate
```

It dies in Android's startup provider, before `MainActivity` and before any JavaScript runs. That's why no screen ever appeared, and why Expo Go (a different native app) works.

## Why

1. `react-native-maps` adds `androidx.work:work-runtime:2.9.1` to the Android build (`node_modules/react-native-maps/android/build.gradle`).
2. WorkManager initialises itself at app launch through `androidx.startup`, and creates its Room database by reflection: it loads the generated class `WorkDatabase_Impl` and calls its no-argument constructor.
3. The crashing APK was a release build minified with R8. R8 removed or renamed that generated class or its constructor, so the reflective lookup failed and the app crashed.

## Fix (in `apps/mobile`)

| Change | Why |
| --- | --- |
| `expo-build-properties` plugin in `app.json` with `extraProguardRules` keeping `RoomDatabase` subclass constructors and `androidx.work.**` | R8 can no longer strip what WorkManager needs. Verified with `expo prebuild`: the rules land in `android/app/proguard-rules.pro`. |
| The SDK 57 template leaves minification **off** by default (`android.enableMinifyInReleaseBuilds` = false) | A fresh SDK 57 build shouldn't minify at all; the rules make it safe if minifying is turned on later. |
| `app.config.js` reads `GOOGLE_MAPS_API_KEY` into `android.config.googleMaps.apiKey` (verified in the prebuilt manifest) | Prevents the *next* crash: the map tab crashes in a standalone build without a Maps key. |
| `eas.json` with `preview` (APK) and `production` (bundle) profiles | Builds are now reproducible from the repo. |

## How to verify

1. Create a Google Maps Android API key (Google Cloud console, "Maps SDK for Android"), restricted to package `com.fixthecity.mobile`, and add it: `eas env:create --name GOOGLE_MAPS_API_KEY --value <key> --environment preview`.
2. `cd apps/mobile && eas build --platform android --profile preview`.
3. Install on the same emulator: `adb install -r <apk>`, launch, and check:
   - the sign-in screen appears;
   - `adb logcat -b crash` is empty;
   - sign in (`01012345678` / `123456`), open the map tab: pins show, no crash;
   - send a report with a photo and location (camera and location permissions).
4. Record the result (build ID, commit, device, Android version) in `docs/progress-log.md`.
