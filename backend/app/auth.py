"""Shared auth boundary. Persistence is supplied by the database owner."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal, Protocol

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

Role = Literal["citizen", "staff", "admin"]


@dataclass(frozen=True)
class User:
    id: str
    phone: str
    role: Role = "citizen"
    name: str | None = None
    department_id: str | None = None


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
        detail="الجلسة مش صالحة، سجّل دخول تاني.",
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
            raise HTTPException(403, "مش مسموح لك بالعملية دي.")
        return user

    return dependency


def require_department(user: User, department_id: str) -> None:
    """Call with the resource's stored department, never a caller-supplied scope."""
    if user.role == "admin":
        return
    if user.role != "staff" or user.department_id != department_id:
        raise HTTPException(403, "مش مسموح لك بالعملية دي.")
