"""Authentication: shared JWT boundary plus password and phone helpers.

Tokens carry only the user id. ``current_user`` reloads the role and department scope from the
user repository (the database) on every request, so deactivated or changed staff lose access at once.
"""

import hashlib
import hmac
import os
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, Protocol

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

Role = Literal["citizen", "staff", "admin"]


def hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256 and random 16-byte salt."""
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return f"{salt.hex()}${hashed.hex()}"


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash using constant-time comparison."""
    try:
        salt_hex, hash_hex = hash_value.split("$")
        salt = bytes.fromhex(salt_hex)
        hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return hmac.compare_digest(hashed.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


PHONE_PATTERN = re.compile(r"01[0125][0-9]{8}")


def is_valid_phone(phone: str) -> bool:
    """Validate raw Egyptian phone number format: 01[0125]XXXXXXXX (no trailing newline)."""
    return PHONE_PATTERN.fullmatch(phone) is not None


def normalize_phone(phone: str) -> str:
    """Normalize Egyptian phone number to +20 format."""
    if not is_valid_phone(phone):
        raise ValueError("Invalid phone format")
    return "+20" + phone[1:]


@dataclass(frozen=True)
class User:
    id: str
    phone: str
    role: Role = "citizen"
    name: str | None = None
    department_id: str | None = None
    district: str | None = None


class UserRepository(Protocol):
    def get_or_create_citizen(self, phone: str) -> User:
        """Atomically find/create by normalized +20 phone; never grant staff roles."""
        ...

    def get_by_id(self, user_id: str) -> User | None: ...


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    demo_otp: bool = False
    token_minutes: int = 60
    issuer: str = "fixthecity-api"
    audience: str = "fixthecity-clients"

    def __post_init__(self) -> None:
        if len(self.jwt_secret.encode()) < 32:
            raise ValueError("JWT secret must contain at least 32 bytes")
        if self.token_minutes <= 0:
            raise ValueError("Token lifetime must be positive")


@dataclass(frozen=True)
class AuthContext:
    settings: AuthSettings
    users: UserRepository


def get_auth_context(request: Request) -> AuthContext:
    context: AuthContext = request.app.state.auth_context
    return context


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="لازم تسجّل دخول",
        headers={"WWW-Authenticate": "Bearer"},
    )


def issue_token(user: User, settings: AuthSettings) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": user.id,
            "iat": now,
            "exp": now + timedelta(minutes=settings.token_minutes),
            "iss": settings.issuer,
            "aud": settings.audience,
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


bearer = HTTPBearer(auto_error=False)


def current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    context: Annotated[AuthContext, Depends(get_auth_context)],
) -> User:
    if credentials is None:
        raise unauthorized()
    settings = context.settings
    try:
        claims = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.issuer,
            audience=settings.audience,
            options={"require": ["sub", "iat", "exp", "iss", "aud"]},
        )
    except jwt.InvalidTokenError:
        raise unauthorized() from None
    user = context.users.get_by_id(claims["sub"])
    if user is None:
        raise unauthorized()
    # Read current permissions from persistence, not stale token claims.
    return user


def require_role(*roles: Role) -> Callable[..., User]:
    def dependency(user: Annotated[User, Depends(current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(403, "مش مسموح")
        return user

    return dependency


def require_department(user: User, department_id: str) -> None:
    """Call with the resource's stored department, never a caller-supplied scope."""
    if user.role == "admin":
        return
    if user.role != "staff" or user.department_id != department_id:
        raise HTTPException(403, "مش مسموح")
