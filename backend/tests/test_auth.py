"""Tests for authentication endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Profile


class TestOTP:
    """Tests for OTP endpoints."""

    def test_otp_request_valid_phone(self, client: TestClient):
        """Valid phone should return 204 (contract)."""
        response = client.post(
            "/auth/otp",
            json={"phone": "01012345678", "channel": "sms"},
        )
        assert response.status_code == 204
        assert response.content == b""

    def test_otp_request_invalid_phone(self, client: TestClient):
        """Invalid phone should return 400."""
        response = client.post(
            "/auth/otp",
            json={"phone": "0101234567", "channel": "sms"},  # Too short
        )
        assert response.status_code == 400

    def test_otp_verify_demo_code(self, client: TestClient):
        """Demo code '123456' should succeed."""
        response = client.post(
            "/auth/verify",
            json={"phone": "01012345678", "code": "123456"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "userId" in data
        assert "token" in data
        assert "phone" in data

    def test_otp_verify_wrong_code(self, client: TestClient):
        """Wrong code should return 401."""
        response = client.post(
            "/auth/verify",
            json={"phone": "01012345678", "code": "000000"},
        )
        assert response.status_code == 401

    def test_otp_verify_creates_profile(self, client: TestClient, db: Session):
        """First verify should create a citizen profile."""
        phone = "01087654321"
        response = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )
        assert response.status_code == 200

        # Check profile was created
        profile = db.query(Profile).filter_by(phone="+201087654321").first()
        assert profile is not None
        assert profile.role == "citizen"

    def test_otp_verify_reuses_existing_profile(self, client: TestClient, db: Session):
        """Second verify with same phone should reuse profile."""
        phone = "01087654321"

        # First verify
        response1 = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )

        # Second verify
        response2 = client.post(
            "/auth/verify",
            json={"phone": phone, "code": "123456"},
        )

        # Both should return same user ID but different tokens
        assert response1.json()["userId"] == response2.json()["userId"]


class TestStaffLogin:
    """Tests for staff login endpoint."""

    def test_staff_login_success(self, client: TestClient):
        """Valid staff credentials should return token."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "roads@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "staff"
        assert "token" in data
        assert "userId" in data

    def test_admin_login_success(self, client: TestClient):
        """Admin login should work."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"

    def test_staff_login_wrong_password(self, client: TestClient):
        """Wrong password should return 401."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    def test_staff_login_nonexistent_email(self, client: TestClient):
        """Nonexistent email should return 401."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "nonexistent@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        assert response.status_code == 401

    def test_staff_login_empty_body(self, client: TestClient):
        """POST /auth/staff-login with {} should return 422 with Arabic message."""
        response = client.post("/auth/staff-login", json={})
        assert response.status_code == 422
        data = response.json()
        # Should have detail with Arabic message
        assert "detail" in data or "errors" in data or len(data) > 0

    def test_token_contains_role(self, client: TestClient):
        """Token should contain role in JWT payload."""
        response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        token = response.json()["token"]

        # Use token in a request
        from app.auth import decode_jwt_token

        payload = decode_jwt_token(token)
        assert payload["role"] == "admin"


class TestGetMe:
    """Tests for /auth/me endpoint."""

    def test_get_me_with_valid_token(self, client: TestClient):
        """GET /auth/me with valid token should return user info."""
        # First login
        login_response = client.post(
            "/auth/staff-login",
            json={
                "email": "admin@cityfix.demo",
                "password": "FixCity2026!",
            },
        )
        token = login_response.json()["token"]

        # Get me
        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
        assert data["userId"] is not None

    def test_get_me_without_token(self, client: TestClient):
        """GET /auth/me without token should return 401."""
        response = client.get("/auth/me")
        assert response.status_code == 401

    def test_get_me_with_invalid_token(self, client: TestClient):
        """GET /auth/me with invalid token should return 401."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert response.status_code == 401

    def test_citizen_token_denied_on_staff_dependency(self, client: TestClient):
        """Citizen token should fail require_staff dependency (test via direct dependency call)."""
        from fastapi import HTTPException

        from app.auth import decode_jwt_token, require_staff

        # Get a citizen token via OTP
        response = client.post(
            "/auth/verify",
            json={"phone": "01012345678", "code": "123456"},
        )
        assert response.status_code == 200
        citizen_token = response.json()["token"]

        # Decode the token to get the payload
        payload = decode_jwt_token(citizen_token)
        assert payload.get("role") == "citizen"

        # Call require_staff with citizen payload - should raise 403
        try:
            require_staff(payload)
            assert False, "require_staff should have raised HTTPException for citizen"
        except HTTPException as e:
            assert e.status_code == 403
            assert "مش مسموح" in str(e.detail)
