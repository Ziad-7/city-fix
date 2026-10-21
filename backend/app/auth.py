"""Authentication logic."""
import hashlib
import hmac
import jwt
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.models import Profile, StaffAccount
from app.schemas import StaffSession


def hash_password(password: str) -> str:
    """Hash password with PBKDF2-SHA256 and random 16-byte salt."""
    salt = os.urandom(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
    return f"{salt.hex()}${hashed.hex()}"


def verify_password(password: str, hash_value: str) -> bool:
    """Verify password against hash using constant-time comparison."""
    try:
        salt_hex, hash_hex = hash_value.split("$")
        salt = bytes.fromhex(salt_hex)
        hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100000)
        return hmac.compare_digest(hashed.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


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
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret, algorithm="HS256")
    return encoded_jwt


def decode_jwt_token(token: str) -> dict:
    """Decode and verify JWT token."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return payload
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="لازم تسجّل دخول") from e


def is_valid_phone(phone: str) -> bool:
    """Validate raw Egyptian phone number format: 01[0125]XXXXXXXX."""
    return bool(re.match(r"^01[0125]\d{8}$", phone))


def normalize_phone(phone: str) -> str:
    """Normalize Egyptian phone number to +20 format."""
    if not is_valid_phone(phone):
        raise ValueError("Invalid phone format")
    return "+20" + phone[1:]


def current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
) -> dict:
    """Extract current user from Authorization: Bearer <token> header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="لازم تسجّل دخول")

    token = authorization[7:]
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
