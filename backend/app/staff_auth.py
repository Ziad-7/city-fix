"""Staff-login adapter and per-process attempt limiter; router is opt-in."""

import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Protocol

from fastapi import HTTPException, Request
from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


@dataclass(frozen=True)
class StaffAccount:
    user_id: str
    password_hash: str
    district: str


class StaffDirectory(Protocol):
    def find_by_email(self, normalized_email: str) -> StaffAccount | None: ...


class LoginLimiter:
    """Local single-worker guard; replace with shared rate limiting at deployment."""

    def __init__(self, attempts: int = 5, window_seconds: int = 60) -> None:
        self.attempts = attempts
        self.window_seconds = window_seconds
        self.entries: dict[str, tuple[float, int]] = {}
        self.lock = Lock()

    def check(self, email: str) -> None:
        now = time.monotonic()
        with self.lock:
            self.entries = {
                key: value for key, value in self.entries.items() if value[0] > now
            }
            expires, count = self.entries.get(email, (now + self.window_seconds, 0))
            if count >= self.attempts or (
                email not in self.entries and len(self.entries) >= 10000
            ):
                raise HTTPException(
                    429,
                    "محاولات كتير، استنى شوية وجرّب تاني.",
                    headers={"Retry-After": str(self.window_seconds)},
                )
            self.entries[email] = (expires, count + 1)

    def clear(self, email: str) -> None:
        with self.lock:
            self.entries.pop(email, None)


@dataclass
class StaffLoginContext:
    directory: StaffDirectory
    limiter: LoginLimiter = field(default_factory=LoginLimiter)
    # Unknown accounts still perform a password hash check.
    dummy_hash: str = field(
        default_factory=lambda: password_hash.hash("not-a-real-account")
    )


def get_staff_context(request: Request) -> StaffLoginContext:
    context: StaffLoginContext | None = getattr(
        request.app.state, "staff_login_context", None
    )
    if context is None:
        raise HTTPException(503, "تسجيل دخول الموظفين مش متاح دلوقتي.")
    return context
