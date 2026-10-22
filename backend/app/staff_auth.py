"""Staff-login directory, password check and per-process attempt limiter."""

import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Protocol

from fastapi import HTTPException, Request
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.auth import hash_password, verify_password

password_hash = PasswordHash.recommended()


def verify_staff_password(password: str, stored: str) -> bool:
    """Check Argon2 hashes (``$argon2...``) and the seeded PBKDF2 ``salt$hash`` format."""
    if stored.startswith("$"):
        try:
            return password_hash.verify(password, stored)
        except UnknownHashError:
            return False
    return verify_password(password, stored)


@dataclass(frozen=True)
class StaffAccount:
    user_id: str
    password_hash: str
    district: str
    title: str | None = None
    department_name: str | None = None  # Arabic department name shown in the session


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
            self.entries = {key: value for key, value in self.entries.items() if value[0] > now}
            expires, count = self.entries.get(email, (now + self.window_seconds, 0))
            if count >= self.attempts or (email not in self.entries and len(self.entries) >= 10000):
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
    dummy_hash: str = field(default_factory=lambda: hash_password("not-a-real-account"))


def get_staff_context(request: Request) -> StaffLoginContext:
    context: StaffLoginContext | None = getattr(request.app.state, "staff_login_context", None)
    if context is None:
        raise HTTPException(503, "تسجيل دخول الموظفين مش متاح دلوقتي.")
    return context
