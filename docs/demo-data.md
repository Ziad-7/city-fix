# Large demo dataset: runbook

A synthetic, clearly labelled dataset that makes the admin and citizen apps look lived in: many citizens, reports, smart bins, pickups and collectors. Code: `backend/app/seed_large.py`, CLI: `backend/scripts/seed_large_demo.py`. No schema change and nothing runs automatically in production.

## 1. What it is

Every primary key carries the marker `DEMOL` (`INC-DEMOL-0042`, `BIN-DEMOL-007`, `demol-citizen-0007`). Names, streets and landmarks are invented; no profile has a phone number, so none of them can sign in. Bins are named "تجريبي: ..." and have `is_simulated = true`. Prices are never invented: the generator reads the database's own `material_prices`.

| Table | Rows at scale 1.0 (approx) |
|---|---|
| profiles | 326 (300 citizens, 1 anonymous, 25 collectors) |
| incidents / reports / followers | 700 / 1,130 / 1,800 |
| work orders / AI suggestions | 680 / 40 |
| service requests | 120 |
| collectors / pickups / weighings | 25 / 300 / 380 |
| smart bins / readings / bin reports | 60 (52 street bins, 8 hubs) / 9,400 / 20 |
| activity log | 7,400 |

About 20k rows in total. Incidents span 90 days (about 20% open, about 40% of those overdue), with duplicate groups, garbage hotspots and full bins that have a linked incident. Re-running with the same seed gives the same ids and content (timestamps are relative to the run time).

## 2. Local use (SQLite only)

```bash
cd backend
DATABASE_URL=sqlite:///./demo_large.db LOCAL_SCHEMA_BOOTSTRAP=true SEED_ON_START=true SEED_SCALE=large \
  DEMO_RESET_ENABLED=true OTP_MODE=demo uv run uvicorn app.main:app --port 8000
```

`SEED_SCALE=large` only has an effect on SQLite with `SEED_ON_START`, and `POST /admin/demo/reset` keeps it locally. On top of the data above, the local mode links the demo citizen (`citizen-001`) and demo collector (`COL-1`) to reports, requests, pickups and notifications, adds requested pickups, and fills the price list for the demo districts. `*.db` is git-ignored.

## 3. Rehearse on a disposable local Postgres first

Create a throwaway database on your own machine, run `python -m scripts.migrate --apply --expected-project-ref local`, seed the base fixture, then:

```bash
export DATABASE_URL=postgresql://postgres@localhost:5432/cityfix_rehearsal
python -m scripts.seed_large_demo --expected-project-ref local                     # dry run, writes nothing
python -m scripts.seed_large_demo --expected-project-ref local --apply             # refused: no confirmation
CITYFIX_DEMO_SEED_CONFIRM=local python -m scripts.seed_large_demo --expected-project-ref local --apply
python -m scripts.seed_large_demo --expected-project-ref local --cleanup           # plan
CITYFIX_DEMO_SEED_CONFIRM=local python -m scripts.seed_large_demo --expected-project-ref local --cleanup --apply
```

`--expected-project-ref sqlite` does the same against a SQLite file. The Postgres test `tests/test_seed_large.py` runs when `CITYFIX_TEST_POSTGRES_URL` points at a disposable server.

## 4. Real database (only with the owner's written OK)

1. Confirm with the project owner which database is meant. Prefer a staging or demo project. Do not run this on the live municipal database without their approval.
2. Dry run and review the counts: `python -m scripts.seed_large_demo --expected-project-ref REF`.
3. `export CITYFIX_DEMO_SEED_CONFIRM=REF`, then add `--apply`. It writes in transactions of about 200 units (one connection, 60 s statement timeout, 5 s lock timeout); about 20 seconds in total. If it stops, run it again with the same `--scale` and `--seed`: finished chunks are skipped and the rest is generated around the first run's clock, so ids and timestamps line up. With other options it refuses (exit 2); run `--cleanup --apply` first.
4. Spot-check the admin app, then `unset CITYFIX_DEMO_SEED_CONFIRM`.

Gates, in order: `--expected-project-ref` must match the `DATABASE_URL` host (same check as the migration tool), writes need `CITYFIX_DEMO_SEED_CONFIRM` equal to the ref, and the base data (all 12 categories, their departments, `sanitation`, `parks`) must exist. In real-database mode the CLI never creates `requested` pickups (so no real collector is sent to a fake address), notifications, push rows, price rows or logins. It only inserts; it never updates or deletes a row it did not create.

What real users will see while the data is present: demo incidents on the public map and in `/incidents` (this response grows to about 1.6 MB), demo bins named "تجريبي:", duplicate suggestions that may point at demo incidents, and dashboards and insights that include the demo rows. Remove the data to get the real numbers back.

## 5. Freshness

Bin telemetry goes "offline" about two hours after the run and incidents age. Right before a demo, run `--cleanup --apply` and then `--apply` (about a minute).

## 6. Cleanup

`--cleanup` is a dry run that lists counts; `--cleanup --apply` deletes exactly the rows with the `DEMOL` keys plus the rows that only exist for them (activity log, followers, readings, bin reports, status notifications and their push deliveries). It refuses with exit code 3 and deletes nothing if a real row points at demo data (for example a real report joined to a demo incident, a real pickup assigned to a demo collector, or a demo incident that staff merged into a real one, which moves its reports, followers and work order onto the real incident); resolve those rows by hand and run it again. Status notifications addressed to demo profiles, and those about demo incidents and pickups (including ones sent to real followers of a demo incident), are deleted with the demo rows. Exit codes: 0 ok, 1 database error (re-run), 2 refused by a gate, 3 cleanup blocked.

## 7. Never

Do not use `POST /admin/demo/reset` or `scripts/reset_demo.py` on a real database: they delete every row.
