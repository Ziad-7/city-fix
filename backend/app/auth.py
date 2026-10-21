"""Authentication logic."""
import hashlib
import jwt
import re
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.models import Profile, StaffAccount
from app.schemas import StaffSession


def hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256."""
    salt = b"fixthecity-salt"  # In production, use random salt
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return hashed.hex()


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash."""
    return hash_password(password) == hash_value


def create_jwt_token(
    sub: str, role: str, department: Optional[str] = None, expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT token."""
    if expires_delta is None:
        expires_delta = timedelta(days=7)

    to_encode = {
        "sub": sub,
        "role": role,
        "department": department,
        "exp": datetime.utcnow() + expires_delta,
    }
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")
    return encoded_jwt


def decode_jwt_token(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="البريد أو كلمة السر غلط") from e


def normalize_phone(phone: str) -> str:
    """
    Normalize Egyptian phone number to +201... format.
    Input can be: 01012345678, +201012345678, etc.
    """
    phone = phone.replace(" ", "").replace("-", "")
    if phone.startswith("+20"):
        return phone
    if phone.startswith("01"):
        return "+2" + phone
    if phone.startswith("1"):
        return "+20" + phone
    raise ValueError("Invalid phone format")


def is_valid_phone(phone: str) -> bool:
    """Check if phone matches Egyptian pattern."""
    normalized = normalize_phone(phone)
    return bool(re.match(r"^\+201[0125]\d{8}$", normalized))


def current_user(
    token: Optional[str] = None, db: Session = Depends(get_db)
) -> dict:
    """Extract current user from JWT token in Authorization header."""
    if not token:
        raise HTTPException(status_code=401, detail="مش مسموح")
    payload = decode_jwt_token(token)
    return payload


def require_staff(payload: dict = Depends(current_user)) -> dict:
    """Require staff or admin role."""
    if payload.get("role") not in ("staff", "admin"):
        raise HTTPException(status_code=403, detail="مش مسموح")
    return payload


def require_admin(payload: dict = Depends(current_user)) -> dict:
    """Require admin role."""
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="مش مسموح")
    return payload
