"""One-shot bounded Expo sender; invoke externally from an approved scheduler."""

import argparse
import sys

from app.config import settings
from app.db import SessionLocal
from app.push import ExpoPushSender, dispatch_pending, poll_receipts


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Dispatch pending CityFix push deliveries")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--receipts", action="store_true")
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= 100:
        parser.error("--limit must be between 1 and 100")
    if not settings.push_enabled:
        print(
            "Push dispatch is disabled; set PUSH_ENABLED=true after configuring an approved invocation", file=sys.stderr
        )
        return 2
    db = SessionLocal()
    try:
        sender = ExpoPushSender(settings.expo_token)
        result = (
            poll_receipts(db, limit=args.limit, sender=sender)
            if args.receipts
            else dispatch_pending(db, limit=args.limit, sender=sender)
        )
        print("Push batch complete: " + ", ".join(f"{key}={value}" for key, value in sorted(result.items())))
        return 0
    except Exception:
        db.rollback()
        print("Push batch failed; check database and Expo configuration", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
