"""Configuration from environment variables."""

from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-secret-change-in-production-now!!"


def normalize_database_url(url: str) -> str:
    """Map ``postgres://`` and ``postgresql://`` to ``postgresql+psycopg://`` (the driver we ship)."""
    url = url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Database
    database_url: str = "sqlite:///./fixthecity.db"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Accept a plain ``postgresql://`` URL (as Supabase shows it) and use the psycopg 3 driver."""
        return normalize_database_url(value)

    # JWT (must be >= 32 bytes for HS256)
    jwt_secret: str = DEFAULT_JWT_SECRET

    # Session lifetime in minutes (default 7 days)
    token_minutes: int = 7 * 24 * 60

    # OTP_MODE=demo uses fixed code "123456". Real delivery uses Twilio Verify.
    otp_mode: str = "demo"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_verify_service_sid: str = ""

    # Optional server-side Expo access token; it is unrelated to a registered device push token.
    expo_token: str = ""
    push_enabled: bool = False

    # Optional local-only convenience; migrations own production schema changes.
    local_schema_bootstrap: bool = False
    seed_on_start: bool = False
    # "large" adds the synthetic large dataset on top of the local fixture (SQLite + SEED_ON_START only).
    seed_scale: Literal["default", "large"] = "default"

    # Destructive demo reset endpoint is disabled unless explicitly enabled.
    demo_reset_enabled: bool = False

    # CORS origins (comma-separated)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # CORS origin regex pattern (allow any localhost port)
    cors_origin_regex: str = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"

    # API version
    version: str = "0.1.0"

    # CityBrain provider configuration (keys remain server-side).
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_photo_analysis_enabled: bool = False

    # Supabase private Storage; the service-role key must never reach a client.
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_media_bucket: str = "report-media"

    # Without Supabase Storage, /uploads/sign can hand out a local stub URL that accepts and DISCARDS the file.
    # Unset (default): allowed only on SQLite (local dev/tests); on any other database it answers 503 so a
    # production-like deployment never silently loses uploads. Set true/false to force either way.
    allow_local_upload_stub: bool | None = None

    @field_validator("allow_local_upload_stub", mode="before")
    @classmethod
    def _blank_is_unset(cls, value):
        """An empty ``ALLOW_LOCAL_UPLOAD_STUB=`` line (as in .env.example) means unset."""
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @property
    def local_upload_stub_allowed(self) -> bool:
        if self.allow_local_upload_stub is not None:
            return self.allow_local_upload_stub
        return self.database_url.startswith("sqlite")


settings = Settings()


def validate_settings(cfg: Settings | None = None) -> None:
    """Refuse to run outside demo mode with the built-in dev JWT secret."""
    cfg = cfg or settings
    if cfg.otp_mode != "demo" and cfg.jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set to a real secret when OTP_MODE is not 'demo'")
    if cfg.otp_mode not in {"demo", "twilio", "real"}:
        raise RuntimeError("OTP_MODE must be 'demo' or 'twilio'")
