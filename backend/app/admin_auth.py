"""Dict-claims dependencies for the route handlers, backed by the shared auth boundary.

The claims are never read from the token: ``current_user`` reloads role and department scope
from the database on every request.
"""

from typing import Annotated

from fastapi import Depends, HTTPException

from app.auth import User, current_user


def current_claims(
    user: Annotated[User, Depends(current_user)],
) -> dict[str, str]:
    """Fields the handlers use (``sub``, ``role``, ``department``), sourced from the DB user."""
    return {
        "sub": user.id,
        "role": user.role,
        "department": user.department_id or "",
    }


current_staff_claims = current_claims


def is_staff(claims: dict) -> bool:
    return claims.get("role") in ("staff", "admin")


def require_staff(
    claims: Annotated[dict[str, str], Depends(current_claims)],
) -> dict[str, str]:
    if claims["role"] not in ("staff", "admin"):
        raise HTTPException(403, "مش مسموح")
    if claims["role"] == "staff" and not claims["department"]:
        raise HTTPException(403, "مش مسموح")  # staff without a department fail closed
    return claims


def require_admin(
    claims: Annotated[dict[str, str], Depends(current_claims)],
) -> dict[str, str]:
    if claims["role"] != "admin":
        raise HTTPException(403, "مش مسموح")
    return claims
