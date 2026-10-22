"""Authentication endpoints."""
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Profile, StaffAccount
from app.schemas import OTPRequestInput, OTPVerifyInput, StaffLoginInput, StaffSession
from app.config import settings
from app.auth import (
    create_jwt_token,
    decode_jwt_token,
    verify_password,
    normalize_phone,
    is_valid_phone,
    current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp")
async def request_otp(body: OTPRequestInput) -> dict:
    """
    Request an OTP code.
    In demo mode, always succeeds and the code is '123456'.
    In real mode, sends via SMS or WhatsApp.
    """
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")

    # In demo mode, we just return 204
    # In real mode, we would generate and send an OTP
    return {}


@router.post("/verify")
async def verify_otp(body: OTPVerifyInput, db: Session = Depends(get_db)) -> dict:
    """
    Verify OTP code and return session with JWT token.
    Creates the citizen profile if it doesn't exist.
    """
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")

    normalized_phone = normalize_phone(body.phone)

    # In demo mode, accept code '123456'
    if settings.otp_mode == "demo":
        if body.code != "123456":
            raise HTTPException(status_code=401, detail="الكود غلط")
    else:
        # In real mode, would verify against stored OTP
        # For now, also accept '123456'
        if body.code != "123456":
            raise HTTPException(status_code=401, detail="الكود غلط")

    # Get or create citizen profile
    profile = db.query(Profile).filter_by(phone=normalized_phone).first()
    if not profile:
        profile = Profile(id=f"citizen-{normalized_phone[-8:]}", phone=normalized_phone, role="citizen")
        db.add(profile)
        db.flush()

    # Create token
    token = create_jwt_token(sub=profile.id, role="citizen")

    db.commit()

    return {
        "userId": profile.id,
        "phone": profile.phone,
        "name": profile.name,
        "token": token,
    }


@router.post("/staff-login")
async def staff_login(body: StaffLoginInput, db: Session = Depends(get_db)) -> StaffSession:
    """Staff login with email and password."""
    account = db.query(StaffAccount).filter_by(email=body.email).first()
    if not account:
        raise HTTPException(status_code=401, detail="البريد أو كلمة السر غلط")

    if not verify_password(body.password, account.password_hash):
        raise HTTPException(status_code=401, detail="البريد أو كلمة السر غلط")

    profile = db.query(Profile).filter_by(id=account.profile_id).first()
    if not profile:
        raise HTTPException(status_code=401, detail="البريد أو كلمة السر غلط")

    # Create token
    token = create_jwt_token(
        sub=profile.id,
        role=profile.role,
        department=account.department_id,
    )

    # Extract title from profile (e.g., "مشرفة فرز · حي مدينة نصر")
    title = ""
    if profile.role == "admin":
        title = "مشرفة فرز · حي مدينة نصر"
    elif profile.role == "staff":
        # Get department name
        dept = db.query(Profile).filter_by(id=account.profile_id).first()
        title = f"موظف · {account.department_id}" if account.department_id else "موظف"

    # I7: For admin, omit department key (set to None which will be excluded)
    dept_id = None if profile.role == "admin" else account.department_id

    return StaffSession(
        userId=profile.id,
        name=profile.name or "موظف",
        title=title,
        role=profile.role,
        department=dept_id,
        district=profile.district or "القاهرة · حي مدينة نصر أول",
        token=token,
    )


@router.get("/me")
async def get_me(
    db: Session = Depends(get_db),
    authorization: str = Header(None),
) -> StaffSession:
    """Get current user info without returning token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="مش مسموح")

    token = authorization[7:]
    payload = decode_jwt_token(token)

    profile = db.query(Profile).filter_by(id=payload["sub"]).first()
    if not profile:
        raise HTTPException(status_code=401, detail="مش مسموح")

    account = None
    if profile.role in ("staff", "admin"):
        account = db.query(StaffAccount).filter_by(profile_id=profile.id).first()

    title = ""
    if profile.role == "admin":
        title = "مشرفة فرز · حي مدينة نصر"
    elif profile.role == "staff" and account:
        title = f"موظف · {account.department_id}" if account.department_id else "موظف"

    return StaffSession(
        userId=profile.id,
        name=profile.name or "موظف",
        title=title,
        role=profile.role,
        department=account.department_id if account else None,
        district=profile.district or "القاهرة · حي مدينة نصر أول",
        token=token,  # Include token for consistency
    )
