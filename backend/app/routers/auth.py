import hmac
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.auth import AuthContext, get_auth_context, issue_token
from app.schemas.auth import OtpRequest, SessionResponse, VerifyRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def require_demo(
    context: Annotated[AuthContext, Depends(get_auth_context)],
) -> AuthContext:
    if not context.settings.demo_otp:
        raise HTTPException(503, "تسجيل الدخول بالكود مش متاح دلوقتي.")
    return context


@router.post("/otp", status_code=204)
def request_code(
    body: OtpRequest, context: Annotated[AuthContext, Depends(require_demo)]
) -> Response:
    # Explicit demo mode only. No SMS/WhatsApp message is sent.
    return Response(status_code=204)


@router.post("/verify", response_model=SessionResponse)
def verify_code(
    body: VerifyRequest, context: Annotated[AuthContext, Depends(require_demo)]
) -> SessionResponse:
    if not hmac.compare_digest(body.code, "123456"):
        raise HTTPException(401, "الكود مش صحيح، جرّب تاني.")
    user = context.users.get_or_create_citizen("+2" + body.phone)
    if user.role != "citizen":
        raise HTTPException(403, "استخدم تسجيل دخول الموظفين.")
    return SessionResponse(
        user_id=user.id,
        phone=user.phone,
        name=user.name,
        token=issue_token(user, context.settings),
    )
