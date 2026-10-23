"""Add hashed-phone OTP state and notification delivery tables."""

import sqlalchemy as sa

from alembic import op

revision = "0002_delivery_foundation"
down_revision = "0001_existing_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "otp_challenges",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("phone_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_otp_challenges_phone_hash", "otp_challenges", ["phone_hash"])
    op.create_table(
        "otp_throttles",
        sa.Column("phone_hash", sa.String(length=64), primary_key=True),
        sa.Column("window_started_at", sa.DateTime(), nullable=False),
        sa.Column("starts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checks", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("recipient_id", sa.String(length=50), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("event_key", "recipient_id", name="uq_notification_event_recipient"),
    )
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])
    op.create_table(
        "push_tokens",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=50), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("token", sa.String(length=256), nullable=False, unique=True),
        sa.Column("platform", sa.String(length=10), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_push_tokens_user_id", "push_tokens", ["user_id"])
    op.create_table(
        "push_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("notification_id", sa.String(length=36), sa.ForeignKey("notifications.id"), nullable=False),
        sa.Column("push_token_id", sa.String(length=36), sa.ForeignKey("push_tokens.id"), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("ticket_id", sa.String(length=100), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("receipt_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("lease_until", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("notification_id", "push_token_id", name="uq_push_delivery_notification_token"),
    )
    op.create_index("idx_push_delivery_pending", "push_deliveries", ["status", "next_attempt_at"])
    # The backend connects with its privileged service role. Keep every CityFix-owned public
    # table protected from direct anon/authenticated Data API access by default.
    for table in (
        "readable_id_counters",
        "profiles",
        "departments",
        "categories",
        "incidents",
        "reports",
        "incident_followers",
        "service_requests",
        "work_orders",
        "activity_log",
        "staff_accounts",
        "ai_suggestions",
        "budget_plans",
        "smart_bins",
        "bin_readings",
        "material_prices",
        "collectors",
        "recycling_pickups",
        "recycling_weighings",
        "bin_reports",
        "hub_weighings",
        "idempotency_keys",
        "otp_challenges",
        "otp_throttles",
        "notifications",
        "push_tokens",
        "push_deliveries",
    ):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    raise RuntimeError("Production downgrade is disabled; add a reviewed forward repair migration instead")
