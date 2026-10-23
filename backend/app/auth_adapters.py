"""Database adapters for the shared authentication boundary."""

from collections.abc import Callable
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import User, UserRepository
from app.db import SessionLocal
from app.models import Department, Profile, StaffAccount
from app.staff_auth import StaffAccount as StaffLoginAccount
from app.staff_auth import StaffDirectory

SessionFactory = Callable[[], Session]

ADMIN_TITLE = "مشرفة فرز · حي مدينة نصر"
DEFAULT_DISTRICT = "القاهرة · حي مدينة نصر أول"


def describe_staff(db: Session, user: User) -> tuple[str, str | None]:
    """(title, Arabic department name) shown in a StaffSession; the name is None for admins."""
    if user.role == "admin":
        profile = db.get(Profile, user.id)
        return ((profile.prefs or {}).get("title") if profile else None) or ADMIN_TITLE, None
    department = None
    if user.department_id:
        row = db.get(Department, user.department_id)
        department = row.name_ar if row else user.department_id
    return (f"موظف · {department}" if department else "موظف"), department


def _user(profile: Profile, department_id: str | None) -> User:
    if profile.role not in ("citizen", "staff", "admin"):
        raise ValueError(f"Unsupported profile role: {profile.role}")
    return User(
        id=profile.id,
        phone=profile.phone or "",
        role=profile.role,  # type: ignore[arg-type]
        name=profile.name,
        department_id=department_id if profile.role in ("staff", "admin") else None,
        district=profile.district,
    )


def profile_to_user(db: Session, profile: Profile) -> User:
    department_id = None
    if profile.role in ("staff", "admin"):
        account = db.query(StaffAccount).filter_by(profile_id=profile.id).first()
        department_id = account.department_id if account else None
    return _user(profile, department_id)


class DatabaseUserRepository(UserRepository):
    """Load current roles and department scope from the SQL database on every call."""

    def __init__(self, session_factory: SessionFactory = SessionLocal) -> None:
        self._session_factory = session_factory

    def get_or_create_citizen(self, phone: str) -> User:
        with self._session_factory() as db:
            profile = db.query(Profile).filter_by(phone=phone).first()
            if profile is None:
                profile = Profile(id=f"citizen-{uuid4().hex[:12]}", phone=phone, role="citizen")
                db.add(profile)
                try:
                    db.commit()
                except IntegrityError:
                    db.rollback()
                    profile = db.query(Profile).filter_by(phone=phone).first()
                    if profile is None:
                        raise
            return profile_to_user(db, profile)

    def get_by_id(self, user_id: str) -> User | None:
        with self._session_factory() as db:
            # One round trip per authenticated request: profile and staff department together.
            row = db.execute(
                select(Profile, StaffAccount.department_id)
                .outerjoin(StaffAccount, StaffAccount.profile_id == Profile.id)
                .where(Profile.id == user_id)
            ).first()
            return _user(row[0], row[1]) if row is not None else None


class DatabaseStaffDirectory(StaffDirectory):
    """Read staff credentials without exposing password data to route code."""

    def __init__(self, session_factory: SessionFactory = SessionLocal) -> None:
        self._session_factory = session_factory

    def find_by_email(self, normalized_email: str) -> StaffLoginAccount | None:
        with self._session_factory() as db:
            account = db.query(StaffAccount).filter(func.lower(StaffAccount.email) == normalized_email).first()
            if account is None:
                return None
            profile = db.query(Profile).filter_by(id=account.profile_id).first()
            if profile is None:
                return None
            title, department = describe_staff(db, profile_to_user(db, profile))
            return StaffLoginAccount(
                user_id=account.profile_id,
                password_hash=account.password_hash,
                district=profile.district or DEFAULT_DISTRICT,
                title=title,
                department_name=department,
            )
