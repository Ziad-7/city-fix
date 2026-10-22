"""In-memory ``UserRepository`` for exercising the auth boundary without a database."""

from threading import Lock
from uuid import uuid4

from app.auth import User


class MemoryUsers:
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
