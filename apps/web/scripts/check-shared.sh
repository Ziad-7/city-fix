#!/usr/bin/env bash
# Fails when the website's copy of the shared mobile code has drifted from apps/mobile/src.
# Change shared logic in the mobile app first (by PR), then copy it here again.
set -euo pipefail
cd "$(dirname "$0")/.."
MOBILE=../mobile/src
status=0

check() { # check <mobile path> <web path>
  if ! diff -q "$MOBILE/$1" "$2" >/dev/null 2>&1; then
    echo "drift: apps/mobile/src/$1 != apps/web/$2"
    status=1
  fi
}

# Domain, logic and utils are copied whole (tests included).
for dir in domain logic utils; do
  while IFS= read -r f; do
    rel=${f#"$MOBILE/"}
    check "$rel" "src/shared/$rel"
  done < <(find "$MOBILE/$dir" -type f -name '*.ts' | sort)
  # nothing extra on the web side either
  while IFS= read -r f; do
    rel=${f#src/shared/}
    [ -f "$MOBILE/$rel" ] || { echo "extra: apps/web/$f has no mobile original"; status=1; }
  done < <(find "src/shared/$dir" -type f -name '*.ts' | sort)
done

# Pure (React Native-free) helpers from components/, kept at the same paths. Walk the MOBILE side, so a new pure
# helper that was never copied is reported as missing. Skipped: barrels (index.ts), *.types.ts and files that import
# react-native / react / expo-* (those belong to the native screens).
while IFS= read -r f; do
  rel=${f#"$MOBILE/"}
  case "$rel" in */index.ts|*.types.ts|*.d.ts) continue ;; esac
  if grep -qE "from ['\"](react-native|react|expo-[a-z-]+|@expo/[a-z-]+)['\"]" "$f"; then continue; fi
  if [ ! -f "src/shared/$rel" ]; then
    echo "missing: apps/mobile/src/$rel has no copy in apps/web/src/shared/$rel"
    status=1
    continue
  fi
  check "$rel" "src/shared/$rel"
done < <(find "$MOBILE/components" -type f -name '*.ts' | sort)
# ... and nothing extra on the web side.
while IFS= read -r f; do
  rel=${f#src/shared/}
  [ -f "$MOBILE/$rel" ] || { echo "extra: apps/web/$f has no mobile original"; status=1; }
done < <(find src/shared/components -type f -name '*.ts' | sort)

# Services, stores and i18n: copied unchanged except the platform files (services/index.ts, services/network.ts,
# services/api/http.ts, services/api/uploads.ts, services/mock/db.ts, store/useSession.ts, store/useOutboxSync.ts,
# notifications/os.ts).
for f in services/interfaces.ts services/api/index.ts \
  services/mock/auth-service.ts services/mock/incident-service.ts services/mock/index.ts services/mock/seed.ts \
  services/mock/service-request-service.ts services/mock/timeline.ts services/mock/triage-service.ts \
  services/mock/localize.ts services/mock/upload-service.ts services/mock/transcription-service.ts \
  services/media.ts services/sendReport.ts services/garbage-schedule.ts \
  services/__tests__/mock-incident-service.test.ts services/__tests__/mock-english.test.ts \
  services/__tests__/mock-transcription.test.ts services/__tests__/reopen.test.ts services/__tests__/garbage-schedule.test.ts \
  store/actions.ts store/index.ts store/useReports.ts store/useRequests.ts store/useServiceRequests.ts \
  store/usePrefs.ts store/useNotifications.ts store/useOutbox.ts store/outboxFlush.ts \
  i18n/index.ts i18n/labels.ts i18n/__tests__/i18n.test.ts; do
  check "$f" "src/$f"
done

# The identity stylesheet is copied from the design pack.
if ! diff -q ../../docs/design/css/cityfix.css src/styles/cityfix.css >/dev/null 2>&1; then
  echo "drift: docs/design/css/cityfix.css != apps/web/src/styles/cityfix.css"
  status=1
fi

if [ "$status" -eq 0 ]; then echo "shared code matches apps/mobile/src"; fi
exit "$status"
