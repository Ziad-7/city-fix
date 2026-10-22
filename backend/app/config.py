"""Configuration from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-secret-change-in-production-now!!"


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Database
    database_url: str = "sqlite:///./fixthecity.db"

    # JWT (must be >= 32 bytes for HS256)
    jwt_secret: str = DEFAULT_JWT_SECRET

    # Session lifetime in minutes (default 7 days)
    token_minutes: int = 7 * 24 * 60

    # OTP_MODE=demo uses fixed code "123456". Real SMS/WhatsApp delivery is not implemented.
    otp_mode: str = "demo"

    # Seed the database on startup if it's empty
    seed_on_start: bool = True

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


settings = Settings()


def validate_settings(cfg: Settings | None = None) -> None:
    """Refuse to run outside demo mode with the built-in dev JWT secret."""
    cfg = cfg or settings
    if cfg.otp_mode != "demo" and cfg.jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be set to a real secret when OTP_MODE is not 'demo'")
