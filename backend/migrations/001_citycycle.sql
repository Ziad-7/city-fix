-- CityCycle tables (recycling pickups, collectors, price list, bin reports, hub scale).
-- Safe to run more than once. Equivalent to what the API's create_all() creates on start; run it by hand
-- (Supabase SQL editor) if you prefer reviewed DDL. Requires the existing profiles, incidents, smart_bins tables.
-- Row Level Security is enabled with no policies: only the backend (a privileged DB role) reads these tables,
-- never the Supabase anon/authenticated API.

CREATE TABLE IF NOT EXISTS material_prices (
	district VARCHAR(100) NOT NULL,
	material_id VARCHAR(30) NOT NULL,
	price_egp_per_kg FLOAT,
	updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
	PRIMARY KEY (district, material_id)
);

ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS collectors (
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

ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recycling_pickups (
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

CREATE INDEX IF NOT EXISTS idx_pickup_citizen ON recycling_pickups (citizen_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pickup_collector ON recycling_pickups (collector_id);
CREATE INDEX IF NOT EXISTS idx_pickup_status ON recycling_pickups (status, created_at);
ALTER TABLE recycling_pickups ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recycling_weighings (
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

CREATE INDEX IF NOT EXISTS idx_weighing_collector_at ON recycling_weighings (collector_id, at);
CREATE INDEX IF NOT EXISTS idx_weighing_pickup ON recycling_weighings (pickup_id);
ALTER TABLE recycling_weighings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS bin_reports (
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

CREATE INDEX IF NOT EXISTS idx_bin_report_bin ON bin_reports (bin_id, created_at);
ALTER TABLE bin_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS hub_weighings (
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

ALTER TABLE hub_weighings ENABLE ROW LEVEL SECURITY;
