"""Frozen baseline schema at b18f7d8, including reviewed CityCycle DDL."""

from alembic import op

revision = "0001_existing_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE incidentstatusenum AS ENUM ('RECEIVED', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')"
    )
    op.execute("CREATE TYPE severityenum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')")
    op.execute("CREATE TYPE workorderstatusenum AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE')")
    op.execute(
        "\nCREATE TABLE activity_log (\n\tid SERIAL NOT NULL, \n\tentity_type VARCHAR(50) NOT NULL, \n\tentity_id VARCHAR(50) NOT NULL, \n\tstatus VARCHAR(50), \n\tnote TEXT, \n\tactor VARCHAR(255) NOT NULL, \n\tkind VARCHAR(50), \n\tat TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE budget_plans (\n\tid VARCHAR(50) NOT NULL, \n\tbudget_egp INTEGER NOT NULL, \n\tselected JSON NOT NULL, \n\tskipped JSON NOT NULL, \n\ttotal_cost INTEGER NOT NULL, \n\tremaining INTEGER NOT NULL, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE departments (\n\tid VARCHAR(100) NOT NULL, \n\tname_ar VARCHAR(255) NOT NULL, \n\texternal_hotline VARCHAR(20), \n\tdistrict VARCHAR(100), \n\tPRIMARY KEY (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE idempotency_keys (\n\tid SERIAL NOT NULL, \n\tuser_id VARCHAR(50) NOT NULL, \n\tscope VARCHAR(30) NOT NULL, \n\tkey VARCHAR(100) NOT NULL, \n\tresource_id VARCHAR(50) NOT NULL, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_idempotency_user_scope_key UNIQUE (user_id, scope, key)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE material_prices (\n\tdistrict VARCHAR(100) NOT NULL, \n\tmaterial_id VARCHAR(30) NOT NULL, \n\tprice_egp_per_kg FLOAT, \n\tupdated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (district, material_id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE profiles (\n\tid VARCHAR(50) NOT NULL, \n\tphone VARCHAR(20), \n\tname VARCHAR(255), \n\trole VARCHAR(20), \n\tgovernorate VARCHAR(100), \n\tdistrict VARCHAR(100), \n\tprefs JSON, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tUNIQUE (phone)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE readable_id_counters (\n\tprefix VARCHAR(10) NOT NULL, \n\tlast_value BIGINT NOT NULL, \n\tPRIMARY KEY (prefix)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE categories (\n\tid VARCHAR(50) NOT NULL, \n\tlabel_ar VARCHAR(255) NOT NULL, \n\tdanger BOOLEAN, \n\tdefault_severity VARCHAR(20), \n\tdepartment_id VARCHAR(100), \n\ttarget_days INTEGER, \n\testimated_cost_egp INTEGER, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(department_id) REFERENCES departments (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE collectors (\n\tid VARCHAR(50) NOT NULL, \n\tprofile_id VARCHAR(50) NOT NULL, \n\tname VARCHAR(255) NOT NULL, \n\tdistrict VARCHAR(100) NOT NULL, \n\tstatus VARCHAR(20) NOT NULL, \n\tmaterials JSON NOT NULL, \n\tvehicle VARCHAR(255), \n\treview_note TEXT, \n\tjoined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tUNIQUE (profile_id), \n\tFOREIGN KEY(profile_id) REFERENCES profiles (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE service_requests (\n\tid VARCHAR(50) NOT NULL, \n\tcitizen_id VARCHAR(50) NOT NULL, \n\tservice_type VARCHAR(50) NOT NULL, \n\tdetails JSON NOT NULL, \n\tlat FLOAT NOT NULL, \n\tlng FLOAT NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(255), \n\tstatus incidentstatusenum, \n\tpaid BOOLEAN, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(citizen_id) REFERENCES profiles (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE smart_bins (\n\tid VARCHAR(64) NOT NULL, \n\tname VARCHAR(255) NOT NULL, \n\tdistrict VARCHAR(100) NOT NULL, \n\tdepartment_id VARCHAR(100), \n\tlat FLOAT NOT NULL, \n\tlng FLOAT NOT NULL, \n\tdevice_key_hash VARCHAR(64) NOT NULL, \n\tis_active BOOLEAN NOT NULL, \n\tis_simulated BOOLEAN NOT NULL, \n\tfull_pct FLOAT NOT NULL, \n\theat_c FLOAT NOT NULL, \n\tinterval_min INTEGER NOT NULL, \n\tlast_seq BIGINT NOT NULL, \n\tfill_pct FLOAT, \n\ttemp_c FLOAT, \n\tbattery_v FLOAT, \n\tis_full BOOLEAN NOT NULL, \n\tis_hot BOOLEAN NOT NULL, \n\tlast_seen_at TIMESTAMP WITHOUT TIME ZONE, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(department_id) REFERENCES departments (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE staff_accounts (\n\tprofile_id VARCHAR(50) NOT NULL, \n\temail VARCHAR(255) NOT NULL, \n\tpassword_hash VARCHAR(255) NOT NULL, \n\tdepartment_id VARCHAR(100), \n\tPRIMARY KEY (profile_id), \n\tFOREIGN KEY(profile_id) REFERENCES profiles (id), \n\tUNIQUE (email), \n\tFOREIGN KEY(department_id) REFERENCES departments (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE bin_readings (\n\tid SERIAL NOT NULL, \n\tbin_id VARCHAR(64) NOT NULL, \n\tseq BIGINT NOT NULL, \n\trecorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\treceived_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tfill_pct FLOAT NOT NULL, \n\tdistance_cm FLOAT, \n\ttemp_c FLOAT, \n\tbattery_v FLOAT, \n\trssi INTEGER, \n\tfirmware VARCHAR(40), \n\tdevice_at TIMESTAMP WITHOUT TIME ZONE, \n\tclock_unsynced BOOLEAN, \n\tis_full BOOLEAN NOT NULL, \n\tis_hot BOOLEAN NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_bin_reading_sequence UNIQUE (bin_id, seq), \n\tFOREIGN KEY(bin_id) REFERENCES smart_bins (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE incidents (\n\tid VARCHAR(50) NOT NULL, \n\tcategory_id VARCHAR(50) NOT NULL, \n\ttitle VARCHAR(500) NOT NULL, \n\tseverity severityenum, \n\tstatus incidentstatusenum, \n\tdepartment_id VARCHAR(100), \n\testimated_cost_egp INTEGER, \n\tpriority_score INTEGER, \n\tpriority_factors JSON, \n\tfollowers_count INTEGER, \n\tlat FLOAT NOT NULL, \n\tlng FLOAT NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(255), \n\tsensitive_place VARCHAR(255), \n\tarea_underserved BOOLEAN, \n\twork_order_id VARCHAR(50), \n\teta VARCHAR(255), \n\tlast_reviewed_by VARCHAR(255), \n\tlast_reviewed_at TIMESTAMP WITHOUT TIME ZONE, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tupdated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(category_id) REFERENCES categories (id), \n\tFOREIGN KEY(department_id) REFERENCES departments (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE recycling_pickups (\n\tid VARCHAR(50) NOT NULL, \n\tcitizen_id VARCHAR(50) NOT NULL, \n\titems JSON NOT NULL, \n\tphoto_paths JSON, \n\tlat FLOAT NOT NULL, \n\tlng FLOAT NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(255), \n\tdistrict VARCHAR(100) NOT NULL, \n\tday VARCHAR(10) NOT NULL, \n\tslot VARCHAR(20) NOT NULL, \n\tmode VARCHAR(10) NOT NULL, \n\tnote TEXT, \n\testimated_value_egp FLOAT, \n\tstatus VARCHAR(20) NOT NULL, \n\tcollector_id VARCHAR(50), \n\taccepted_at TIMESTAMP WITHOUT TIME ZONE, \n\tpaid_to_household_egp FLOAT, \n\tcollector_finished_at TIMESTAMP WITHOUT TIME ZONE, \n\tconfirmed_at TIMESTAMP WITHOUT TIME ZONE, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(citizen_id) REFERENCES profiles (id), \n\tFOREIGN KEY(collector_id) REFERENCES collectors (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE bin_reports (\n\tid SERIAL NOT NULL, \n\tbin_id VARCHAR(64) NOT NULL, \n\tincident_id VARCHAR(50) NOT NULL, \n\treporter_id VARCHAR(50) NOT NULL, \n\tnote TEXT, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(bin_id) REFERENCES smart_bins (id), \n\tFOREIGN KEY(incident_id) REFERENCES incidents (id), \n\tFOREIGN KEY(reporter_id) REFERENCES profiles (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE hub_weighings (\n\tid SERIAL NOT NULL, \n\thub_id VARCHAR(64) NOT NULL, \n\tseq BIGINT NOT NULL, \n\trecorded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\treceived_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tmaterial_id VARCHAR(30) NOT NULL, \n\tkg FLOAT NOT NULL, \n\tpickup_id VARCHAR(50), \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_hub_weighing_sequence UNIQUE (hub_id, seq), \n\tFOREIGN KEY(hub_id) REFERENCES smart_bins (id), \n\tFOREIGN KEY(pickup_id) REFERENCES recycling_pickups (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE incident_followers (\n\tincident_id VARCHAR(50) NOT NULL, \n\tuser_id VARCHAR(50) NOT NULL, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (incident_id, user_id), \n\tFOREIGN KEY(incident_id) REFERENCES incidents (id), \n\tFOREIGN KEY(user_id) REFERENCES profiles (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE recycling_weighings (\n\tid VARCHAR(50) NOT NULL, \n\tpickup_id VARCHAR(50) NOT NULL, \n\tcollector_id VARCHAR(50) NOT NULL, \n\tmaterial_id VARCHAR(30) NOT NULL, \n\tkg FLOAT NOT NULL, \n\tsource VARCHAR(20) NOT NULL, \n\tscale_id VARCHAR(100), \n\tprice_egp_per_kg FLOAT, \n\tvalue_egp FLOAT, \n\tclient_id VARCHAR(100) NOT NULL, \n\tat TIMESTAMP WITHOUT TIME ZONE NOT NULL, \n\tPRIMARY KEY (id), \n\tCONSTRAINT uq_weighing_client UNIQUE (pickup_id, client_id), \n\tFOREIGN KEY(pickup_id) REFERENCES recycling_pickups (id), \n\tFOREIGN KEY(collector_id) REFERENCES collectors (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE reports (\n\tid VARCHAR(50) NOT NULL, \n\treporter_id VARCHAR(50) NOT NULL, \n\tincident_id VARCHAR(50) NOT NULL, \n\tcategory_id VARCHAR(50) NOT NULL, \n\tdescription TEXT, \n\tphoto_paths JSON, \n\tvoice_note_path VARCHAR(500), \n\tlat FLOAT NOT NULL, \n\tlng FLOAT NOT NULL, \n\taddress VARCHAR(500) NOT NULL, \n\tlandmark VARCHAR(255), \n\tanonymous BOOLEAN, \n\tblur_faces BOOLEAN, \n\tseverity_suggested VARCHAR(20), \n\tsource VARCHAR(20), \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(reporter_id) REFERENCES profiles (id), \n\tFOREIGN KEY(incident_id) REFERENCES incidents (id), \n\tFOREIGN KEY(category_id) REFERENCES categories (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE work_orders (\n\tid VARCHAR(50) NOT NULL, \n\tincident_id VARCHAR(50), \n\tservice_request_id VARCHAR(50), \n\tdepartment_id VARCHAR(100) NOT NULL, \n\tteam VARCHAR(255), \n\tteam_size INTEGER, \n\tsupervisor VARCHAR(255), \n\tstatus workorderstatusenum, \n\tdue_at TIMESTAMP WITHOUT TIME ZONE, \n\testimated_cost_egp INTEGER, \n\ttasks JSON, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tupdated_at TIMESTAMP WITHOUT TIME ZONE, \n\tresolved_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(incident_id) REFERENCES incidents (id), \n\tFOREIGN KEY(service_request_id) REFERENCES service_requests (id), \n\tFOREIGN KEY(department_id) REFERENCES departments (id)\n)\n\n"
    )
    op.execute(
        "\nCREATE TABLE ai_suggestions (\n\tid VARCHAR(50) NOT NULL, \n\treport_id VARCHAR(50), \n\tkind VARCHAR(50) NOT NULL, \n\tpayload JSON NOT NULL, \n\tmodel VARCHAR(100), \n\tlatency_ms INTEGER, \n\taccepted BOOLEAN, \n\tcreated_at TIMESTAMP WITHOUT TIME ZONE, \n\tPRIMARY KEY (id), \n\tFOREIGN KEY(report_id) REFERENCES reports (id)\n)\n\n"
    )
    op.execute("CREATE INDEX idx_activity_entity ON activity_log (entity_type, entity_id)")
    op.execute("CREATE INDEX idx_activity_at ON activity_log (at)")
    op.execute("CREATE INDEX idx_bin_reading_received ON bin_readings (bin_id, received_at)")
    op.execute("CREATE INDEX idx_incident_created_at ON incidents (created_at)")
    op.execute("CREATE INDEX idx_incident_lat_lng ON incidents (lat, lng)")
    op.execute("CREATE INDEX idx_incident_status_category ON incidents (status, category_id)")
    op.execute("CREATE INDEX idx_pickup_collector ON recycling_pickups (collector_id)")
    op.execute("CREATE INDEX idx_pickup_status ON recycling_pickups (status, created_at)")
    op.execute("CREATE INDEX idx_pickup_citizen ON recycling_pickups (citizen_id, created_at)")
    op.execute("CREATE INDEX idx_bin_report_bin ON bin_reports (bin_id, created_at)")
    op.execute("CREATE INDEX idx_weighing_pickup ON recycling_weighings (pickup_id)")
    op.execute("CREATE INDEX idx_weighing_collector_at ON recycling_weighings (collector_id, at)")
    op.execute("ALTER TABLE material_prices ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE collectors ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE recycling_pickups ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE recycling_weighings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE bin_reports ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE hub_weighings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE readable_id_counters ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    raise RuntimeError("Production downgrade is disabled; add a reviewed forward repair migration instead")
