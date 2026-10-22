#!/usr/bin/env bash
# Fails when the admin web's copy of the shared mobile code has drifted from apps/mobile/src.
# Change shared logic in the mobile app first (by PR), then copy it here again unchanged.
set -euo pipefail
cd "$(dirname "$0")/.."
MOBILE=../mobile/src
status=0

# docs/team/admin-web.md section 4 files, plus the two small files they import (store/usePrefs.ts, i18n/labels.ts).
for rel in domain/types.ts domain/categories.ts logic/priority.ts utils/time.ts utils/geo.ts utils/digits.ts \
  store/usePrefs.ts i18n/labels.ts; do
  if ! diff -q "$MOBILE/$rel" "src/$rel" >/dev/null 2>&1; then
    echo "drift: apps/mobile/src/$rel != apps/admin-web/src/$rel"
    status=1
  fi
done

if [ "$status" -eq 0 ]; then echo "shared code matches apps/mobile/src"; fi
exit "$status"
