-- Generated from the reviewed Alembic revisions.
-- ONLY for a new database with no CityFix tables, enum types, or Alembic history.
-- Run with the privileged backend database owner. Never use this to reset an existing database.
BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_existing_schema

CREATE TYPE incidentstatusenum AS ENUM ('RECEIVED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TYPE severityenum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE workorderstatusenum AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE');

CREATE TABLE activity_log (
    id SERIAL NOT NULL, 
    entity_type VARCHAR(50) NOT NULL, 
    entity_id VARCHAR(50) NOT NULL, 
    status VARCHAR(50), 
    note TEXT, 
    actor VARCHAR(255) NOT NULL, 
    kind VARCHAR(50), 
    at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE TABLE budget_plans (
    id VARCHAR(50) NOT NULL, 
    budget_egp INTEGER NOT NULL, 
    selected JSON NOT NULL, 
    skipped JSON NOT NULL, 
    total_cost INTEGER NOT NULL, 
    remaining INTEGER NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE TABLE departments (
    id VARCHAR(100) NOT NULL, 
    name_ar VARCHAR(255) NOT NULL, 
    external_hotline VARCHAR(20), 
    district VARCHAR(100), 
    PRIMARY KEY (id)
);

CREATE TABLE idempotency_keys (
    id SERIAL NOT NULL, 
    user_id VARCHAR(50) NOT NULL, 
    scope VARCHAR(30) NOT NULL, 
    key VARCHAR(100) NOT NULL, 
    resource_id VARCHAR(50) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_idempotency_user_scope_key UNIQUE (user_id, scope, key)
);

CREATE TABLE material_prices (
    district VARCHAR(100) NOT NULL, 
    material_id VARCHAR(30) NOT NULL, 
    price_egp_per_kg FLOAT, 
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (district, material_id)
);

CREATE TABLE profiles (
    id VARCHAR(50) NOT NULL, 
    phone VARCHAR(20), 
    name VARCHAR(255), 
    role VARCHAR(20), 
    governorate VARCHAR(100), 
    district VARCHAR(100), 
    prefs JSON, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    UNIQUE (phone)
);

CREATE TABLE readable_id_counters (
    prefix VARCHAR(10) NOT NULL, 
    last_value BIGINT NOT NULL, 
    PRIMARY KEY (prefix)
);

CREATE TABLE categories (
    id VARCHAR(50) NOT NULL, 
    label_ar VARCHAR(255) NOT NULL, 
    danger BOOLEAN, 
    default_severity VARCHAR(20), 
    department_id VARCHAR(100), 
    target_days INTEGER, 
    estimated_cost_egp INTEGER, 
    PRIMARY KEY (id), 
    FOREIGN KEY(department_id) REFERENCES departments (id)
);

CREATE TABLE collectors (
    id VARCHAR(50) NOT NULL, 
    profile_id VARCHAR(50) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    district VARCHAR(100) NOT NULL, 
    status VARCHAR(20) NOT NULL, 
    materials JSON NOT NULL, 
    vehicle VARCHAR(255), 
    review_note TEXT, 
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    UNIQUE (profile_id), 
    FOREIGN KEY(profile_id) REFERENCES profiles (id)
);

CREATE TABLE service_requests (
    id VARCHAR(50) NOT NULL, 
    citizen_id VARCHAR(50) NOT NULL, 
    service_type VARCHAR(50) NOT NULL, 
    details JSON NOT NULL, 
    lat FLOAT NOT NULL, 
    lng FLOAT NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(255), 
    status incidentstatusenum, 
    paid BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(citizen_id) REFERENCES profiles (id)
);

CREATE TABLE smart_bins (
    id VARCHAR(64) NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    district VARCHAR(100) NOT NULL, 
    department_id VARCHAR(100), 
    lat FLOAT NOT NULL, 
    lng FLOAT NOT NULL, 
    device_key_hash VARCHAR(64) NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    is_simulated BOOLEAN NOT NULL, 
    full_pct FLOAT NOT NULL, 
    heat_c FLOAT NOT NULL, 
    interval_min INTEGER NOT NULL, 
    last_seq BIGINT NOT NULL, 
    fill_pct FLOAT, 
    temp_c FLOAT, 
    battery_v FLOAT, 
    is_full BOOLEAN NOT NULL, 
    is_hot BOOLEAN NOT NULL, 
    last_seen_at TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(department_id) REFERENCES departments (id)
);

CREATE TABLE staff_accounts (
    profile_id VARCHAR(50) NOT NULL, 
    email VARCHAR(255) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    department_id VARCHAR(100), 
    PRIMARY KEY (profile_id), 
    FOREIGN KEY(profile_id) REFERENCES profiles (id), 
    UNIQUE (email), 
    FOREIGN KEY(department_id) REFERENCES departments (id)
);

CREATE TABLE bin_readings (
    id SERIAL NOT NULL, 
    bin_id VARCHAR(64) NOT NULL, 
    seq BIGINT NOT NULL, 
    recorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    fill_pct FLOAT NOT NULL, 
    distance_cm FLOAT, 
    temp_c FLOAT, 
    battery_v FLOAT, 
    rssi INTEGER, 
    firmware VARCHAR(40), 
    device_at TIMESTAMP WITHOUT TIME ZONE, 
    clock_unsynced BOOLEAN, 
    is_full BOOLEAN NOT NULL, 
    is_hot BOOLEAN NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_bin_reading_sequence UNIQUE (bin_id, seq), 
    FOREIGN KEY(bin_id) REFERENCES smart_bins (id)
);

CREATE TABLE incidents (
    id VARCHAR(50) NOT NULL, 
    category_id VARCHAR(50) NOT NULL, 
    title VARCHAR(500) NOT NULL, 
    severity severityenum, 
    status incidentstatusenum, 
    department_id VARCHAR(100), 
    estimated_cost_egp INTEGER, 
    priority_score INTEGER, 
    priority_factors JSON, 
    followers_count INTEGER, 
    lat FLOAT NOT NULL, 
    lng FLOAT NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(255), 
    sensitive_place VARCHAR(255), 
    area_underserved BOOLEAN, 
    work_order_id VARCHAR(50), 
    eta VARCHAR(255), 
    last_reviewed_by VARCHAR(255), 
    last_reviewed_at TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(category_id) REFERENCES categories (id), 
    FOREIGN KEY(department_id) REFERENCES departments (id)
);

CREATE TABLE recycling_pickups (
    id VARCHAR(50) NOT NULL, 
    citizen_id VARCHAR(50) NOT NULL, 
    items JSON NOT NULL, 
    photo_paths JSON, 
    lat FLOAT NOT NULL, 
    lng FLOAT NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(255), 
    district VARCHAR(100) NOT NULL, 
    day VARCHAR(10) NOT NULL, 
    slot VARCHAR(20) NOT NULL, 
    mode VARCHAR(10) NOT NULL, 
    note TEXT, 
    estimated_value_egp FLOAT, 
    status VARCHAR(20) NOT NULL, 
    collector_id VARCHAR(50), 
    accepted_at TIMESTAMP WITHOUT TIME ZONE, 
    paid_to_household_egp FLOAT, 
    collector_finished_at TIMESTAMP WITHOUT TIME ZONE, 
    confirmed_at TIMESTAMP WITHOUT TIME ZONE, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(citizen_id) REFERENCES profiles (id), 
    FOREIGN KEY(collector_id) REFERENCES collectors (id)
);

CREATE TABLE bin_reports (
    id SERIAL NOT NULL, 
    bin_id VARCHAR(64) NOT NULL, 
    incident_id VARCHAR(50) NOT NULL, 
    reporter_id VARCHAR(50) NOT NULL, 
    note TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(bin_id) REFERENCES smart_bins (id), 
    FOREIGN KEY(incident_id) REFERENCES incidents (id), 
    FOREIGN KEY(reporter_id) REFERENCES profiles (id)
);

CREATE TABLE hub_weighings (
    id SERIAL NOT NULL, 
    hub_id VARCHAR(64) NOT NULL, 
    seq BIGINT NOT NULL, 
    recorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    received_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    material_id VARCHAR(30) NOT NULL, 
    kg FLOAT NOT NULL, 
    pickup_id VARCHAR(50), 
    PRIMARY KEY (id), 
    CONSTRAINT uq_hub_weighing_sequence UNIQUE (hub_id, seq), 
    FOREIGN KEY(hub_id) REFERENCES smart_bins (id), 
    FOREIGN KEY(pickup_id) REFERENCES recycling_pickups (id)
);

CREATE TABLE incident_followers (
    incident_id VARCHAR(50) NOT NULL, 
    user_id VARCHAR(50) NOT NULL, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (incident_id, user_id), 
    FOREIGN KEY(incident_id) REFERENCES incidents (id), 
    FOREIGN KEY(user_id) REFERENCES profiles (id)
);

CREATE TABLE recycling_weighings (
    id VARCHAR(50) NOT NULL, 
    pickup_id VARCHAR(50) NOT NULL, 
    collector_id VARCHAR(50) NOT NULL, 
    material_id VARCHAR(30) NOT NULL, 
    kg FLOAT NOT NULL, 
    source VARCHAR(20) NOT NULL, 
    scale_id VARCHAR(100), 
    price_egp_per_kg FLOAT, 
    value_egp FLOAT, 
    client_id VARCHAR(100) NOT NULL, 
    at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    CONSTRAINT uq_weighing_client UNIQUE (pickup_id, client_id), 
    FOREIGN KEY(pickup_id) REFERENCES recycling_pickups (id), 
    FOREIGN KEY(collector_id) REFERENCES collectors (id)
);

CREATE TABLE reports (
    id VARCHAR(50) NOT NULL, 
    reporter_id VARCHAR(50) NOT NULL, 
    incident_id VARCHAR(50) NOT NULL, 
    category_id VARCHAR(50) NOT NULL, 
    description TEXT, 
    photo_paths JSON, 
    voice_note_path VARCHAR(500), 
    lat FLOAT NOT NULL, 
    lng FLOAT NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    landmark VARCHAR(255), 
    anonymous BOOLEAN, 
    blur_faces BOOLEAN, 
    severity_suggested VARCHAR(20), 
    source VARCHAR(20), 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(reporter_id) REFERENCES profiles (id), 
    FOREIGN KEY(incident_id) REFERENCES incidents (id), 
    FOREIGN KEY(category_id) REFERENCES categories (id)
);

CREATE TABLE work_orders (
    id VARCHAR(50) NOT NULL, 
    incident_id VARCHAR(50), 
    service_request_id VARCHAR(50), 
    department_id VARCHAR(100) NOT NULL, 
    team VARCHAR(255), 
    team_size INTEGER, 
    supervisor VARCHAR(255), 
    status workorderstatusenum, 
    due_at TIMESTAMP WITHOUT TIME ZONE, 
    estimated_cost_egp INTEGER, 
    tasks JSON, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    updated_at TIMESTAMP WITHOUT TIME ZONE, 
    resolved_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(incident_id) REFERENCES incidents (id), 
    FOREIGN KEY(service_request_id) REFERENCES service_requests (id), 
    FOREIGN KEY(department_id) REFERENCES departments (id)
);

CREATE TABLE ai_suggestions (
    id VARCHAR(50) NOT NULL, 
    report_id VARCHAR(50), 
    kind VARCHAR(50) NOT NULL, 
    payload JSON NOT NULL, 
    model VARCHAR(100), 
    latency_ms INTEGER, 
    accepted BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(report_id) REFERENCES reports (id)
);

CREATE INDEX idx_activity_entity ON activity_log (entity_type, entity_id);

CREATE INDEX idx_activity_at ON activity_log (at);

CREATE INDEX idx_bin_reading_received ON bin_readings (bin_id, received_at);

CREATE INDEX idx_incident_created_at ON incidents (created_at);

CREATE INDEX idx_incident_lat_lng ON incidents (lat, lng);

CREATE INDEX idx_incident_status_category ON incidents (status, category_id);

CREATE INDEX idx_pickup_collector ON recycling_pickups (collector_id);

CREATE INDEX idx_pickup_status ON recycling_pickups (status, created_at);

CREATE INDEX idx_pickup_citizen ON recycling_pickups (citizen_id, created_at);

CREATE INDEX idx_bin_report_bin ON bin_reports (bin_id, created_at);

CREATE INDEX idx_weighing_pickup ON recycling_weighings (pickup_id);

CREATE INDEX idx_weighing_collector_at ON recycling_weighings (collector_id, at);

ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;

ALTER TABLE recycling_pickups ENABLE ROW LEVEL SECURITY;

ALTER TABLE recycling_weighings ENABLE ROW LEVEL SECURITY;

ALTER TABLE bin_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE hub_weighings ENABLE ROW LEVEL SECURITY;

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

ALTER TABLE readable_id_counters ENABLE ROW LEVEL SECURITY;

INSERT INTO alembic_version (version_num) VALUES ('0001_existing_schema') RETURNING alembic_version.version_num;

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

