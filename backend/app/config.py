"""Configuration from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    # Database
    database_url: str = "sqlite:///./fixthecity.db"

    # JWT (must be >= 32 bytes for HS256)
    jwt_secret: str = "dev-secret-change-in-production-now!!"

    # OTP mode: "demo" uses fixed code "123456", "real" sends via SMS/WhatsApp
    otp_mode: str = "demo"

    # Seed the database on startup if it's empty
    seed_on_start: bool = True

    # CORS origins (comma-separated)
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # CORS origin regex pattern (allow any localhost port)
    cors_origin_regex: str = r"^http://(localhost|127\.0\.0\.1)(:\d+)?$"

    # API version
    version: str = "0.1.0"


settings = Settings()
