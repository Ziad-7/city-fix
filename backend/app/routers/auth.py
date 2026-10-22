"""Citizen phone + one-time-code authentication: POST /auth/otp, POST /auth/verify.

Staff login and ``GET /auth/me`` live in ``app.routers.staff_auth``.
"""

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth import AuthContext, get_auth_context, is_valid_phone, issue_token, normalize_phone
from app.schemas import OTPRequestInput, OTPVerifyInput

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_CODE = "123456"


def require_demo(context: Annotated[AuthContext, Depends(get_auth_context)]) -> AuthContext:
    """Real SMS/WhatsApp delivery is not implemented: only explicit demo mode (OTP_MODE=demo) works."""
    if not context.settings.demo_otp:
        raise HTTPException(status_code=503, detail="تسجيل الدخول بالكود مش متاح دلوقتي.")
    return context


@router.post("/otp", status_code=204)
def request_otp(body: OTPRequestInput, context: Annotated[AuthContext, Depends(require_demo)]) -> Response:
    """Request an OTP code. Demo mode: nothing is sent, the code is always 123456."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    return Response(status_code=204)


@router.post("/verify")
def verify_otp(body: OTPVerifyInput, context: Annotated[AuthContext, Depends(require_demo)]) -> dict:
    """Verify the OTP and return a citizen session; the first verify creates the profile."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    if not hmac.compare_digest(body.code.encode(), DEMO_CODE.encode()):
        raise HTTPException(status_code=401, detail="الكود غلط")
    user = context.users.get_or_create_citizen(normalize_phone(body.phone))
    if user.role != "citizen":
        raise HTTPException(status_code=403, detail="استخدم تسجيل دخول الموظفين")
    out = {"userId": user.id, "phone": user.phone, "token": issue_token(user, context.settings)}
    if user.name:
        out["name"] = user.name
    return out
