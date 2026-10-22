"""Database adapters for the shared authentication boundary."""

from collections.abc import Callable
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import User, UserRepository
from app.db import SessionLocal
from app.models import Profile, StaffAccount
from app.staff_auth import StaffAccount as StaffLoginAccount
from app.staff_auth import StaffDirectory

SessionFactory = Callable[[], Session]


class DatabaseUserRepository(UserRepository):
    """Load current roles and department scope from the SQL database."""

    def __init__(self, session_factory: SessionFactory = SessionLocal) -> None:
        self._session_factory = session_factory

    def get_or_create_citizen(self, phone: str) -> User:
        with self._session_factory() as db:
            profile = db.query(Profile).filter_by(phone=phone).first()
            if profile is None:
                profile = Profile(
                    id=f"citizen-{uuid4().hex}", phone=phone, role="citizen"
                )
                db.add(profile)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    profile = db.query(Profile).filter_by(phone=phone).first()
                    if profile is None:
                        raise
            else:
                db.commit()
            return self._to_user(db, profile)

    def get_by_id(self, user_id: str) -> User | None:
        with self._session_factory() as db:
            profile = db.query(Profile).filter_by(id=user_id).first()
            return self._to_user(db, profile) if profile is not None else None

    @staticmethod
    def _to_user(db: Session, profile: Profile) -> User:
        if profile.role not in ("citizen", "staff", "admin"):
            raise ValueError(f"Unsupported profile role: {profile.role}")
        account = None
        if profile.role in ("staff", "admin"):
            account = db.query(StaffAccount).filter_by(profile_id=profile.id).first()
        return User(
            id=profile.id,
            phone=profile.phone or "",
            role=profile.role,  # type: ignore[arg-type]
            name=profile.name,
            department_id=account.department_id if account else None,
            district=profile.district,
        )


class DatabaseStaffDirectory(StaffDirectory):
    """Read staff credentials without exposing password data to route code."""

    def __init__(self, session_factory: SessionFactory = SessionLocal) -> None:
        self._session_factory = session_factory

    def find_by_email(self, normalized_email: str) -> StaffLoginAccount | None:
        with self._session_factory() as db:
            account = (
                db.query(StaffAccount)
                .filter(func.lower(StaffAccount.email) == normalized_email)
                .first()
            )
            if account is None:
                return None
            profile = db.query(Profile).filter_by(id=account.profile_id).first()
            return StaffLoginAccount(
                user_id=account.profile_id,
                password_hash=account.password_hash,
                district=(profile.district if profile else None)
                or "القاهرة · حي مدينة نصر أول",
            )
