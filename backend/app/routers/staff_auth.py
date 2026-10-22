"""Proposed staff login; not registered by the default demo application."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pwdlib.exceptions import UnknownHashError
from pydantic import Field

from app.auth import AuthContext, get_auth_context, issue_token
from app.schemas.auth import ApiModel
from app.schemas.citizen import InputModel
from app.staff_auth import StaffLoginContext, get_staff_context, password_hash

router = APIRouter(prefix="/auth", tags=["staff auth (proposed)"])


class StaffLogin(InputModel):
    email: str = Field(
        min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
    )
    password: str = Field(min_length=1, max_length=1024, strict=True)


class StaffSession(ApiModel):
    user_id: str
    name: str | None = None
    role: Literal["staff", "admin"]
    department_id: str | None = None
    district: str
    token: str


@router.post(
    "/staff-login", response_model=StaffSession, response_model_exclude_none=True
)
def login(
    body: StaffLogin,
    auth: Annotated[AuthContext, Depends(get_auth_context)],
    staff: Annotated[StaffLoginContext, Depends(get_staff_context)],
) -> StaffSession:
    email = body.email.lower()
    staff.limiter.check(email)
    account = staff.directory.find_by_email(email)
    try:
        valid = password_hash.verify(
            body.password, account.password_hash if account else staff.dummy_hash
        )
    except UnknownHashError:
        valid = False
    user = auth.users.get_by_id(account.user_id) if account else None
    if not valid or user is None or user.role not in ("staff", "admin"):
        raise HTTPException(401, "البريد أو كلمة السر مش صح.")
    assert account is not None
    staff.limiter.clear(email)
    return StaffSession(
        user_id=user.id,
        name=user.name,
        role=user.role,
        department_id=user.department_id,
        district=account.district,
        token=issue_token(user, auth.settings),
    )
