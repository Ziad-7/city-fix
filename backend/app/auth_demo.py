"""Local auth harness, not the production app owned by the teammate."""

import os
import secrets
from threading import Lock
from uuid import uuid4

from fastapi import FastAPI

from app.auth import AuthContext, AuthSettings, User
from app.routers.auth import router


class MemoryUsers:
    """Process-local demo adapter; resets on restart; never use for deployment."""

    def __init__(self) -> None:
        self.users: dict[str, User] = {}
        self.lock = Lock()

    def get_or_create_citizen(self, phone: str) -> User:
        with self.lock:
            for user in self.users.values():
                if user.phone == phone:
                    return user
            user = User(id=str(uuid4()), phone=phone)
            self.users[user.id] = user
            return user

    def get_by_id(self, user_id: str) -> User | None:
        return self.users.get(user_id)


def create_app() -> FastAPI:
    if os.getenv("OTP_MODE") != "demo":
        raise RuntimeError("Local harness requires explicit OTP_MODE=demo")
    app = FastAPI(title="FixTheCity local auth demo")
    app.state.auth_context = AuthContext(
        AuthSettings(jwt_secret=secrets.token_urlsafe(48), demo_otp=True),
        MemoryUsers(),
    )
    app.include_router(router)
    return app
