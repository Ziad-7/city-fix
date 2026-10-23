"""Citizen phone + one-time-code authentication: POST /auth/otp, POST /auth/verify.

Staff login and ``GET /auth/me`` live in ``app.routers.staff_auth``.
"""

import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.auth import AuthContext, get_auth_context, is_valid_phone, issue_token, normalize_phone
from app.db import get_db
from app.otp import (
    OTPProviderError,
    active_challenge_id,
    check_rate_limit,
    consume_challenge,
    create_challenge,
    lock_challenge_generation,
    phone_key,
)
from app.schemas import OTPRequestInput, OTPVerifyInput

router = APIRouter(prefix="/auth", tags=["auth"])

DEMO_CODE = "123456"


def provider_error(exc: OTPProviderError) -> HTTPException:
    detail = "محاولة كتير، جرّب تاني بعد شوية" if exc.status_code == 429 else "تسجيل الدخول بالكود مش متاح دلوقتي."
    headers = {"Retry-After": "600"} if exc.status_code == 429 else None
    return HTTPException(exc.status_code, detail=detail, headers=headers)


@router.post("/otp", status_code=204)
def request_otp(
    body: OTPRequestInput,
    request: Request,
    context: Annotated[AuthContext, Depends(get_auth_context)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Request an OTP code using the configured explicit demo or real provider mode."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    if context.settings.demo_otp:
        return Response(status_code=204)
    provider = getattr(request.app.state, "otp_provider", None)
    if provider is None:
        raise HTTPException(503, detail="تسجيل الدخول بالكود مش متاح دلوقتي.")
    phone = normalize_phone(body.phone)
    digest = phone_key(phone, context.settings.jwt_secret)
    try:
        check_rate_limit(db, digest, "start")
        lock_challenge_generation(db, digest)
        provider.start(phone, body.channel)
        create_challenge(db, digest)
    except OTPProviderError as exc:
        db.rollback()
        raise provider_error(exc) from exc
    return Response(status_code=204)


@router.post("/verify")
def verify_otp(
    body: OTPVerifyInput,
    request: Request,
    context: Annotated[AuthContext, Depends(get_auth_context)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Verify the OTP and return a citizen session; the first verify creates the profile."""
    if not is_valid_phone(body.phone):
        raise HTTPException(status_code=400, detail="رقم الموبايل مش صحيح")
    phone = normalize_phone(body.phone)
    if context.settings.demo_otp:
        if not hmac.compare_digest(body.code.encode(), DEMO_CODE.encode()):
            raise HTTPException(status_code=401, detail="الكود غلط")
    else:
        provider = getattr(request.app.state, "otp_provider", None)
        if provider is None:
            raise HTTPException(503, detail="تسجيل الدخول بالكود مش متاح دلوقتي.")
        digest = phone_key(phone, context.settings.jwt_secret)
        try:
            check_rate_limit(db, digest, "check")
            challenge_id = active_challenge_id(db, digest)
            if challenge_id is None or not provider.check(phone, body.code):
                raise HTTPException(status_code=401, detail="الكود غلط")
            if not consume_challenge(db, challenge_id):
                raise HTTPException(status_code=401, detail="الكود غلط")
        except OTPProviderError as exc:
            raise provider_error(exc) from exc
    user = context.users.get_or_create_citizen(phone)
    if user.role != "citizen":
        raise HTTPException(status_code=403, detail="استخدم تسجيل دخول الموظفين")
    out = {"userId": user.id, "phone": user.phone, "token": issue_token(user, context.settings)}
    if user.name:
        out["name"] = user.name
    return out
