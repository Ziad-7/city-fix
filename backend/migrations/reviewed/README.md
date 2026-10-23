# Reviewed operator SQL

These exports are generated from the Alembic revisions in this PR. They are supplied for operator review and execution; this task has not run SQL against a live CityFix database. Both exports passed on disposable PostgreSQL 17, including preservation of an existing profile during the baseline upgrade.

Choose **one** path after confirming the CityFix project and that the connection uses the public schema and privileged backend database owner:

| Database state | Path |
| --- | --- |
| New database with no CityFix tables, enum types, or Alembic history | Review and execute [new-database.sql](new-database.sql). |
| Compatible CityFix schema already tracked at `0001_existing_schema` | Run the read-only compatibility check below, then review and execute [existing-baseline.sql](existing-baseline.sql). |
| Existing CityFix schema with no Alembic history | Use the checked CLI workflow below. It verifies the frozen baseline before adoption and completes the upgrade. |
| Already at `0002_delivery_foundation` | Run the compatibility check; no upgrade SQL is needed. |
| Partial, incompatible, or otherwise unknown schema | Stop and prepare a reviewed forward repair. Do not stamp, reset, or run either export. |

The exports use one transaction each and preserve existing rows. They are not repeatable scripts: do not execute both, rerun one at head, or execute an export after CLI `--apply`. Never apply the historical `../001_citycycle.sql` as an additional step.

## Checked CLI workflow

Set the existing backend `DATABASE_URL` securely; do not commit it. From `backend/`, substitute the verified project reference:

```bash
python -m scripts.migrate --check --expected-project-ref REF
python -m scripts.migrate --plan --expected-project-ref REF
# Review the plan before execution. --apply adopts a compatible untracked
# baseline if necessary AND upgrades it to the current head.
python -m scripts.migrate --apply --expected-project-ref REF
python -m scripts.migrate --check --expected-project-ref REF
```

The CLI refuses incompatible columns, enum identities/labels, timestamp types, keys and indexes. Do not manually stamp a schema that has not passed the check. Device keys, provider secrets and real project credentials are not present in the exports.

## Verification SQL

Before choosing a path, inspect the active schema:

```sql
SELECT current_schema(); -- Expected: public
```

For a database that already has Alembic history, and after a successful upgrade:

```sql
SELECT version_num FROM public.alembic_version;
-- Expected after upgrade: 0002_delivery_foundation
```

Then run the CLI `--check` again to validate schema and RLS. New notification, push and OTP tables contain no demo credentials. Configure existing OTP/push services separately before enabling delivery.

## Optional additive demo seed

Seeding is a separate operator action, not part of either schema export. It checks database identity and skips existing IDs or unique-key collisions without overwriting profiles, prices or device keys:

```bash
python -m scripts.seed_citycycle_additive --dry-run --expected-project-ref REF
python -m scripts.seed_citycycle_additive --apply --expected-project-ref REF
```

Review the dry-run before applying. A second apply inserts zero rows. Do not use the destructive demo reset command on an existing database.

A larger synthetic dataset (no schema change) is described in [docs/demo-data.md](../../../docs/demo-data.md). It has its own gated CLI and an exact cleanup, and needs the project owner's confirmation before it touches any real database.
