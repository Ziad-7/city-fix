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

# Pure (React Native-free) helpers from components/, kept at the same paths.
while IFS= read -r f; do
  rel=${f#src/shared/}
  check "$rel" "$f"
done < <(find src/shared/components -type f -name '*.ts' | sort)

# Services and stores: copied unchanged except the platform files
# (services/index.ts, services/api/http.ts, services/mock/db.ts, store/useSession.ts).
for f in services/interfaces.ts services/api/index.ts \
  services/mock/auth-service.ts services/mock/incident-service.ts services/mock/index.ts services/mock/seed.ts \
  services/mock/service-request-service.ts services/mock/timeline.ts services/mock/triage-service.ts \
  services/__tests__/mock-incident-service.test.ts \
  store/actions.ts store/index.ts store/useReports.ts store/useRequests.ts store/useServiceRequests.ts; do
  check "$f" "src/$f"
done

# The identity stylesheet is copied from the design pack.
if ! diff -q ../../docs/design/css/fixthecity.css src/styles/fixthecity.css >/dev/null 2>&1; then
  echo "drift: docs/design/css/fixthecity.css != apps/web/src/styles/fixthecity.css"
  status=1
fi

if [ "$status" -eq 0 ]; then echo "shared code matches apps/mobile/src"; fi
exit "$status"
