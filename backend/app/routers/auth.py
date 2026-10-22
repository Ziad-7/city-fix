"""Authentication endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.auth import (
    create_jwt_token,
    current_user,
    is_valid_phone,
    normalize_phone,
    verify_password,
)
from app.config import settings
from app.db import get_db
from app.models import Department, Profile, StaffAccount
from app.schemas import OTPRequestInput, OTPVerifyInput, StaffLoginInput, StaffSession

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_TITLE = "مشرفة فرز · حي مدينة نصر"
DEFAULT_DISTRICT = "القاهرة · حي مدينة نصر أول"


@router.post("/otp", status_code=204)
async def request_otp(body: OTPRequestInput) -> Response:
    """Request an OTP code. Demo mode (OTP_MODE=demo): nothing is sent, the code is always 123456."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    return Response(status_code=204)


@router.post("/verify")
async def verify_otp(body: OTPVerifyInput, db: Session = Depends(get_db)) -> dict:
    """Verify the OTP and return a citizen session; the first verify creates the profile."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    phone = normalize_phone(body.phone)

    # Real SMS delivery is a stretch goal: only demo mode has an OTP "store" (the fixed code).
    if settings.otp_mode != "demo":
        raise HTTPException(status_code=400, detail="الكود غلط")
    if body.code != "123456":
        raise HTTPException(status_code=401, detail="الكود غلط")

    profile = db.query(Profile).filter_by(phone=phone).first()
    if not profile:
        profile = Profile(id=f"citizen-{uuid.uuid4().hex[:12]}", phone=phone, role="citizen")
        db.add(profile)
        db.commit()

    token = create_jwt_token(sub=profile.id, role="citizen")
    out = {"userId": profile.id, "phone": profile.phone, "token": token}
    if profile.name:
        out["name"] = profile.name
    return out


def staff_session(db: Session, profile: Profile, account: StaffAccount | None, token: str | None) -> StaffSession:
    """StaffSession; ``department`` (Arabic name) is omitted for admins."""
    dept_name = None
    if profile.role == "staff" and account and account.department_id:
        dept = db.get(Department, account.department_id)
        dept_name = dept.name_ar if dept else account.department_id
    if profile.role == "admin":
        title = (profile.prefs or {}).get("title") or ADMIN_TITLE
    else:
        title = f"موظف · {dept_name}" if dept_name else "موظف"
    return StaffSession(
        user_id=profile.id,
        name=profile.name or "موظف",
        title=title,
        role=profile.role,
        department=dept_name,
        district=profile.district or DEFAULT_DISTRICT,
        token=token,
    )


@router.post(
    "/staff-login", response_model=StaffSession, response_model_exclude_none=True, response_model_by_alias=True
)
async def staff_login(body: StaffLoginInput, db: Session = Depends(get_db)):
    """Staff login with email and password."""
    bad = HTTPException(status_code=401, detail="البريد أو كلمة السر غلط")
    account = db.query(StaffAccount).filter_by(email=body.email).first()
    if not account or not verify_password(body.password, account.password_hash):
        raise bad
    profile = db.get(Profile, account.profile_id)
    if not profile:
        raise bad
    token = create_jwt_token(sub=profile.id, role=profile.role, department=account.department_id)
    return staff_session(db, profile, account, token)


@router.get("/me", response_model=StaffSession, response_model_exclude_none=True, response_model_by_alias=True)
async def get_me(payload: dict = Depends(current_user), db: Session = Depends(get_db)):
    """Current staff/admin session (without the token)."""
    if payload.get("role") not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="مش مسموح")
    profile = db.get(Profile, payload["sub"])
    if not profile:
        raise HTTPException(status_code=401, detail="لازم تسجّل دخول")
    account = db.query(StaffAccount).filter_by(profile_id=profile.id).first()
    return staff_session(db, profile, account, None)
