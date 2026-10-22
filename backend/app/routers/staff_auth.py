"""Staff login and session: POST /auth/staff-login, GET /auth/me (contract ``StaffSession``)."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import AuthContext, User, current_user, get_auth_context, issue_token
from app.auth_adapters import DEFAULT_DISTRICT, describe_staff
from app.db import get_db
from app.schemas import StaffLoginInput, StaffSession
from app.staff_auth import StaffLoginContext, get_staff_context, verify_staff_password

router = APIRouter(prefix="/auth", tags=["auth"])

BAD_CREDENTIALS = "البريد أو كلمة السر غلط"


def _session(user: User, title: str | None, department: str | None, district: str, token: str | None) -> StaffSession:
    """``department`` (Arabic name) is omitted for admins."""
    department = None if user.role == "admin" else (department or user.department_id)
    return StaffSession(
        user_id=user.id,
        name=user.name or "موظف",
        title=title or (f"موظف · {department}" if department else "موظف"),
        role=user.role,  # type: ignore[arg-type]
        department=department,
        district=district,
        token=token,
    )


@router.post(
    "/staff-login", response_model=StaffSession, response_model_exclude_none=True, response_model_by_alias=True
)
def staff_login(
    body: StaffLoginInput,
    auth: Annotated[AuthContext, Depends(get_auth_context)],
    staff: Annotated[StaffLoginContext, Depends(get_staff_context)],
) -> StaffSession:
    """Email + password; role and department come from the database user, never from the request."""
    email = body.email.strip().lower()
    staff.limiter.check(email)
    account = staff.directory.find_by_email(email)
    valid = verify_staff_password(body.password, account.password_hash if account else staff.dummy_hash)
    user = auth.users.get_by_id(account.user_id) if account else None
    if account is None or not valid or user is None or user.role not in ("staff", "admin"):
        raise HTTPException(status_code=401, detail=BAD_CREDENTIALS)
    staff.limiter.clear(email)
    return _session(
        user,
        account.title,
        account.department_name,
        user.district or account.district,
        issue_token(user, auth.settings),
    )


@router.get("/me", response_model=StaffSession, response_model_exclude_none=True, response_model_by_alias=True)
def get_me(user: Annotated[User, Depends(current_user)], db: Annotated[Session, Depends(get_db)]) -> StaffSession:
    """Current staff/admin session (without the token)."""
    if user.role not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="مش مسموح")
    title, department = describe_staff(db, user)
    return _session(user, title, department, user.district or DEFAULT_DISTRICT, None)
