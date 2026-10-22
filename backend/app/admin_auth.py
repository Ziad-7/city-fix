"""Admin-route compatibility dependencies backed by the shared auth boundary."""

from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth import User, current_user


def current_staff_claims(
    user: Annotated[User, Depends(current_user)],
) -> dict[str, str]:
    """Expose the fields existing admin handlers use, sourced from the DB user."""
    return {
        "sub": user.id,
        "role": user.role,
        "department": user.department_id or "",
    }


def require_staff(
    claims: Annotated[dict[str, str], Depends(current_staff_claims)],
) -> dict[str, str]:
    if claims["role"] not in ("staff", "admin"):
        raise HTTPException(403, "مش مسموح")
    if claims["role"] == "staff" and not claims["department"]:
        raise HTTPException(403, "مش مسموح")
    return claims


def require_admin(
    claims: Annotated[dict[str, str], Depends(current_staff_claims)],
) -> dict[str, str]:
    if claims["role"] != "admin":
        raise HTTPException(403, "مش مسموح")
    return claims
