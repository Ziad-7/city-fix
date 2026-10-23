-- Generated from the reviewed Alembic revisions.
-- ONLY after scripts.migrate --check verifies exact baseline compatibility and the
-- Alembic revision is 0001_existing_schema. For untracked existing schemas, use
-- the checked CLI --check then --apply, which adopts AND upgrades to head.
-- Do not run this export after CLI --apply, and do not stamp an unchecked schema.
-- Run with the privileged backend database owner; this preserves existing rows.
BEGIN;

-- Running upgrade 0001_existing_schema -> 0002_delivery_foundation

CREATE TABLE otp_challenges (
    id VARCHAR(36) NOT NULL, 
    phone_hash VARCHAR(64) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    consumed_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_otp_challenges_phone_hash ON otp_challenges (phone_hash);

CREATE TABLE otp_throttles (
    phone_hash VARCHAR(64) NOT NULL, 
    window_started_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    starts INTEGER DEFAULT '0' NOT NULL, 
    checks INTEGER DEFAULT '0' NOT NULL, 
    PRIMARY KEY (phone_hash)
);

CREATE TABLE notifications (
    id VARCHAR(36) NOT NULL, 
    recipient_id VARCHAR(50) NOT NULL, 
    kind VARCHAR(30) NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    body TEXT NOT NULL, 
    data JSON NOT NULL, 
    event_key VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    read_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_notification_event_recipient UNIQUE (event_key, recipient_id), 
    FOREIGN KEY(recipient_id) REFERENCES profiles (id)
);

CREATE INDEX ix_notifications_recipient_id ON notifications (recipient_id);

CREATE TABLE push_tokens (
    id VARCHAR(36) NOT NULL, 
    user_id VARCHAR(50) NOT NULL, 
    token VARCHAR(256) NOT NULL, 
    platform VARCHAR(10) NOT NULL, 
    active BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES profiles (id), 
    UNIQUE (token)
);

CREATE INDEX ix_push_tokens_user_id ON push_tokens (user_id);

CREATE TABLE push_deliveries (
    id VARCHAR(36) NOT NULL, 
    notification_id VARCHAR(36) NOT NULL, 
    push_token_id VARCHAR(36) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    ticket_id VARCHAR(100), 
    attempts INTEGER NOT NULL, 
    receipt_attempts INTEGER DEFAULT '0' NOT NULL, 
    next_attempt_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    lease_until TIMESTAMP WITHOUT TIME ZONE, 
    last_error TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_push_delivery_notification_token UNIQUE (notification_id, push_token_id), 
    FOREIGN KEY(notification_id) REFERENCES notifications (id), 
    FOREIGN KEY(push_token_id) REFERENCES push_tokens (id)
);

CREATE INDEX idx_push_delivery_pending ON push_deliveries (status, next_attempt_at);

ALTER TABLE readable_id_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE incident_followers ENABLE ROW LEVEL SECURITY;

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE staff_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

ALTER TABLE budget_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE smart_bins ENABLE ROW LEVEL SECURITY;

ALTER TABLE bin_readings ENABLE ROW LEVEL SECURITY;

ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;

ALTER TABLE recycling_pickups ENABLE ROW LEVEL SECURITY;

ALTER TABLE recycling_weighings ENABLE ROW LEVEL SECURITY;

ALTER TABLE bin_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE hub_weighings ENABLE ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE otp_challenges ENABLE ROW LEVEL SECURITY;

ALTER TABLE otp_throttles ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;

ALTER TABLE alembic_version ENABLE ROW LEVEL SECURITY;

UPDATE alembic_version SET version_num='0002_delivery_foundation' WHERE alembic_version.version_num = '0001_existing_schema';

COMMIT;

