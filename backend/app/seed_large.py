"""Large, synthetic, clearly labelled demo dataset (about 19k rows at scale 1.0).

Nothing here runs by itself. It is reachable only through
  * ``seed_large_local`` (SQLite + ``SEED_ON_START`` + ``SEED_SCALE=large``, or the local demo reset), and
  * ``scripts/seed_large_demo.py`` (explicit CLI: dry run by default, confirmation gate, additive only).

Every primary key carries the ``DEMOL`` marker (``INC-DEMOL-0042``, ``demol-citizen-0007``) so cleanup can remove
exactly the rows this module created. The suffix is non-numeric on purpose: ``logic.ids.next_id`` skips it, so real
id sequences never move. No schema change, no write to ``readable_id_counters``, no prices invented (they are read
from ``material_prices``; the local-only DEMO price list is reused from ``seed_citycycle``).
"""

from __future__ import annotations

import hashlib
import math
import random
import secrets
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from itertools import accumulate
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.orm import Session

from app.helpers import now_utc
from app.logic.domain import DEFAULT_TASKS, TASKS_BY_CATEGORY, UNDERSERVED_DISTRICTS
from app.logic.priority import compute_priority
from app.logic.recycling import estimate_value
from app.logic.status import INCIDENT_STATUSES, OPEN_STATUSES
from app.logic.timeline import incident_timeline_entry, service_timeline_entry
from app.models import (
    ActivityLog,
    AISuggestion,
    BinReading,
    BinReport,
    Category,
    Collector,
    Department,
    HubWeighing,
    Incident,
    IncidentFollower,
    IncidentStatusEnum,
    MaterialPriceRow,
    Notification,
    Profile,
    PushToken,
    RecyclingPickup,
    Report,
    ServiceRequest,
    SeverityEnum,
    SmartBin,
    Weighing,
    WorkOrder,
    WorkOrderStatusEnum,
)
from app.recycling_schemas import MATERIAL_IDS
from app.seed import TEAMS
from app.seed_citycycle import DEMO_PRICES
from app.seed_large_data import (
    AI_ALTERNATIVES,
    CATEGORY_MIX,
    DEPT_STAFF,
    DESCRIPTIONS,
    DISTRICTS,
    FAMILY_NAMES,
    FIRST_NAMES,
    LANDMARKS,
    PICKUP_NOTES,
    SENSITIVE_PLACES,
    SR_ITEMS,
    SR_NOTES,
    STREETS,
    SUPERVISORS,
    TITLE_TEMPLATES,
    VEHICLES,
)

MARK = "DEMOL"
DEFAULT_SEED = 20261023
CAIRO = ZoneInfo("Africa/Cairo")
ANON_ID = "demol-anonymous"
SEVERITIES = ("low", "medium", "high", "critical")
_ARABIC_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

# table -> SQL LIKE patterns of the primary keys this module creates (the one source of truth for cleanup).
SELECTORS: dict[str, tuple[str, ...]] = {
    "profiles": ("demol-%",),
    "incidents": ("INC-DEMOL-%",),
    "reports": ("FTC-DEMOL-%",),
    "work_orders": ("WO-DEMOL-%",),
    "service_requests": ("SRV-DEMOL-%",),
    "ai_suggestions": ("AS-DEMOL-%",),
    "collectors": ("COL-DEMOL-%",),
    "recycling_pickups": ("RCY-DEMOL-%",),
    "recycling_weighings": ("WGH-DEMOL-%",),
    "smart_bins": ("BIN-DEMOL-%", "HUB-DEMOL-%"),
    "notifications": ("demol-ntf-%",),
}
ROOT_TABLES = {
    "profiles": "profiles",
    "collectors": "collectors",
    "smart_bins": "smart_bins",
    "incidents": "incidents",
    "service_requests": "service_requests",
    "recycling_pickups": "recycling_pickups",
    "notifications": "notifications",
    "material_prices": "material_prices",
}
# Rows are flushed model by model in FK order (a single flush does not order unrelated instances on PostgreSQL).
FLUSH_ORDER = (
    MaterialPriceRow,
    Profile,
    Collector,
    SmartBin,
    Incident,
    Report,
    AISuggestion,
    ServiceRequest,
    WorkOrder,
    IncidentFollower,
    BinReport,
    RecyclingPickup,
    Weighing,
    Notification,
    ActivityLog,
    BinReading,
)


class DemoSeedError(RuntimeError):
    """Preflight failed or the database is not ready for the demo dataset."""


@dataclass(frozen=True)
class LargeOptions:
    scale: float = 1.0  # multiplies every count; tests use 0.15
    seed: int = DEFAULT_SEED
    link_demo_citizen: str | None = None  # local only: this citizen gets reports, requests, pickups, notifications
    link_demo_collector: str | None = None  # local only: this collector gets jobs
    open_pickups: bool = False  # create "requested" pickups (every verified collector sees them: local only)
    local_prices: bool = False  # insert DEMO_PRICES for demo districts without a price list (SQLite only)
    notifications: bool = False  # notifications for the linked citizen / collector (local only)


@dataclass
class Reference:
    """Read-only rows the generator depends on."""

    categories: dict[str, Category]
    departments: dict[str, Department]
    prices: dict[str, dict[str, float | None]]  # district -> material -> price (after local_prices)
    missing_price_districts: list[str] = field(default_factory=list)
    citizen_profile: str | None = None
    collector_id: str | None = None
    collector_profile: str | None = None
    collector_name: str | None = None
    collector_joined: datetime | None = None


@dataclass
class Unit:
    """Smallest atomic graph: inserted together or skipped together (keyed by its root row)."""

    table: str
    root_id: str
    rows: list


def _naive(dt: datetime) -> datetime:
    """Stored timestamps are naive UTC (TIMESTAMP WITHOUT TIME ZONE), truncated to whole seconds."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(UTC).replace(tzinfo=None)
    return dt.replace(microsecond=0)


def _hours(h: float) -> timedelta:
    return timedelta(hours=h)


def _adigits(value: int) -> str:
    return str(value).translate(_ARABIC_DIGITS)


# --------------------------------------------------------------------------- reference data
def load_reference(db: Session, opts: LargeOptions | None = None) -> Reference:
    """Read categories, departments and prices; raise DemoSeedError when the base data is missing."""
    opts = opts or LargeOptions()
    categories = {c.id: c for c in db.query(Category).all()}
    wanted = [cid for cid, _ in CATEGORY_MIX]
    missing = [cid for cid in wanted if cid not in categories]
    if missing:
        raise DemoSeedError(f"missing categories: {', '.join(missing)}")
    departments = {d.id: d for d in db.query(Department).all()}
    needed = {categories[cid].department_id for cid in wanted} | {"sanitation", "parks"}
    lacking = sorted(d for d in needed if d not in departments)
    if lacking:
        raise DemoSeedError(f"missing departments: {', '.join(lacking)}")
    prices: dict[str, dict[str, float | None]] = {}
    for row in db.query(MaterialPriceRow).all():
        prices.setdefault(row.district, {})[row.material_id] = row.price_egp_per_kg
    ref = Reference(categories=categories, departments=departments, prices=prices)
    if opts.local_prices:
        for d in DISTRICTS:
            if d[1] not in prices:
                ref.prices[d[1]] = dict(DEMO_PRICES)
                ref.missing_price_districts.append(d[1])
    if opts.link_demo_citizen:
        if db.get(Profile, opts.link_demo_citizen) is None:
            raise DemoSeedError(f"citizen {opts.link_demo_citizen} not found")
        ref.citizen_profile = opts.link_demo_citizen
    if opts.link_demo_collector:
        col = db.get(Collector, opts.link_demo_collector)
        if col is None:
            raise DemoSeedError(f"collector {opts.link_demo_collector} not found")
        ref.collector_id, ref.collector_profile = col.id, col.profile_id
        ref.collector_name = (col.name or "").split(" ")[0] or "الجامع"
        ref.collector_joined = col.joined_at.replace(tzinfo=UTC) if col.joined_at else None
    return ref


# --------------------------------------------------------------------------- generator
@dataclass
class _IncSpec:
    category: str
    district: tuple
    lat: float
    lng: float
    address: str
    landmark: str | None
    sensitive: str | None
    severity: str
    created: datetime
    status: str
    kind: str = "normal"  # normal | dup | hot | bin
    bin_id: str | None = None
    bin_name: str | None = None


@dataclass
class _IncBundle:
    spec: _IncSpec
    incident: Incident
    reports: list[Report]
    followers: list[IncidentFollower]
    activity: list[ActivityLog]
    suggestion: AISuggestion | None
    work_order: WorkOrder | None
    wo_activity: list[ActivityLog]
    bin_reports: list[BinReport]
    times: dict[str, datetime]


class _Pool:
    """Zipf-like draws from a fixed, shuffled list of ids (a few heavy users, a long tail)."""

    def __init__(self, ids: list[str], rng: random.Random, exponent: float = 0.5):
        self.ids = list(ids)
        rng.shuffle(self.ids)
        self.cum = list(accumulate(1 / ((i + 1) ** exponent) for i in range(len(self.ids))))
        self.rng = rng

    def draw(self) -> str:
        return self.rng.choices(self.ids, cum_weights=self.cum)[0]

    def distinct(self, n: int) -> list[str]:
        out: list[str] = []
        for _ in range(n * 6):
            pick = self.draw()
            if pick not in out:
                out.append(pick)
            if len(out) == n:
                break
        return out


class _Generator:
    def __init__(self, now: datetime, ref: Reference, opts: LargeOptions):
        if opts.scale <= 0:
            raise DemoSeedError("scale must be positive")
        self.now = now.astimezone(UTC).replace(microsecond=0)
        self.ref = ref
        self.opts = opts
        self.rng = random.Random(opts.seed)
        self.s = opts.scale
        self.dist_cum = list(accumulate(d[6] for d in DISTRICTS))
        self.nasr = DISTRICTS[0]
        self.profile_events: dict[str, list[tuple]] = {}  # recipient -> (kind, resource, status, at)

    # ----- small helpers
    def count(self, base: float, minimum: int = 1) -> int:
        return max(minimum, round(base * self.s))

    def district(self) -> tuple:
        return self.rng.choices(DISTRICTS, cum_weights=self.dist_cum)[0]

    def point(self, d: tuple, sigma: float | None = None) -> tuple[float, float]:
        nasr = d[0] == "nasr-1"
        sigma = sigma or (0.0035 if nasr else 0.004)
        clip = 0.010 if nasr else 0.02
        dlat = max(-clip, min(clip, self.rng.gauss(0, sigma)))
        dlng = max(-clip, min(clip, self.rng.gauss(0, sigma)))
        return round(d[3] + dlat, 6), round(d[4] + dlng, 6)

    def offset(self, lat: float, lng: float, meters: float, bearing: float) -> tuple[float, float]:
        """Move a point by ``meters`` (1 deg lat = 111 km, 1 deg lng = 96 km at 30 N)."""
        return round(lat + meters * math.cos(bearing) / 111_000, 6), round(lng + meters * math.sin(bearing) / 96_000, 6)

    def place(self, d: tuple) -> tuple[str, str]:
        street = self.rng.choice(STREETS[d[1]])
        return street, f"{street}، {d[1]}"

    def ago(self, days: float) -> datetime:
        return (self.now - timedelta(days=days)).replace(microsecond=0)

    def names(self, n: int) -> list[str]:
        pairs = [(f, fam) for f in FIRST_NAMES for fam in FAMILY_NAMES]
        self.rng.shuffle(pairs)
        return [f"{f} {fam}" for f, fam in pairs[:n]]

    # ----- profiles
    def profiles(self) -> tuple[list[Unit], list[str]]:
        n = self.count(300, 5)
        units: list[Unit] = []
        names = self.names(n)
        ids = []
        for i in range(n):
            d = self.district()
            pid = f"demol-citizen-{i + 1:04d}"
            ids.append(pid)
            units.append(
                Unit(
                    "profiles",
                    pid,
                    [
                        Profile(
                            id=pid,
                            phone=None,
                            name=names[i],
                            role="citizen",
                            governorate=d[2],
                            district=d[1],
                            prefs={},
                            created_at=_naive(self.ago(self.rng.uniform(1, 180))),
                        )
                    ],
                )
            )
        units.append(
            Unit(
                "profiles",
                ANON_ID,
                [
                    Profile(
                        id=ANON_ID,
                        phone=None,
                        name="بلاغ بدون اسم",
                        role="citizen",
                        prefs={},
                        created_at=_naive(self.ago(180)),
                    )
                ],
            )
        )
        return units, ids

    # ----- collectors
    def collectors(self) -> tuple[list[Unit], list[dict]]:
        n = self.count(25, 4)
        n_susp = max(1, round(3 * self.s))
        n_pend = max(1, round(5 * self.s))
        statuses = ["verified"] * (n - n_susp - n_pend) + ["pending"] * n_pend + ["suspended"] * n_susp
        names = self.names(n)
        n_nasr = max(2, round(n * 0.32))
        units: list[Unit] = []
        infos: list[dict] = []
        for i in range(n):
            status = statuses[i]
            d = self.nasr if i < n_nasr else self.district()
            cid, pid = f"COL-DEMOL-{i + 1:02d}", f"demol-collector-{i + 1:02d}"
            if status == "suspended":
                joined = self.ago(self.rng.uniform(70, 120))
            elif status == "verified" and self.rng.random() < 0.7:
                joined = self.ago(self.rng.uniform(62, 120))
            else:
                joined = self.ago(self.rng.uniform(5, 60))
            note = None
            if status == "suspended":
                note = "اتوقف مؤقتًا لحد مراجعة الأوزان"
            elif status == "pending" and self.rng.random() < 0.5:
                note = "مستني صورة البطاقة"
            profile = Profile(
                id=pid, phone=None, name=names[i], role="citizen", governorate=d[2], district=d[1], prefs={},
                created_at=_naive(joined),
            )  # fmt: skip
            collector = Collector(
                id=cid,
                profile_id=pid,
                name=names[i],
                district=d[1],
                status=status,
                materials=sorted(self.rng.sample(MATERIAL_IDS, self.rng.randint(2, 5))),
                vehicle=self.rng.choice(VEHICLES),
                review_note=note,
                joined_at=_naive(joined),
            )
            units.append(Unit("collectors", cid, [profile, collector]))
            infos.append({"id": cid, "name": names[i], "first": names[i].split(" ")[0], "district": d[1],
                          "status": status, "joined": joined})  # fmt: skip
        return units, infos

    # ----- smart bins
    def _bin_series(self, status: str, kind: str, n: int, last: datetime, rate: float, f_end: float, base: float):
        """Hourly readings, oldest first, built backwards from the latest one so the end state is exact."""
        rng = self.rng
        fills = [f_end]
        cur_base = base
        for k in range(1, n):
            t = (last - _hours(k)).astimezone(CAIRO)
            step = rate * (1.5 if 8 <= t.hour < 22 else 1.0)
            x = fills[-1] - step
            if rate > 0 and x < cur_base:
                x = rng.uniform(82, 98)  # the previous cycle's peak: the bin was emptied in between
                cur_base = rng.uniform(3, 10)
            fills.append(x)
        fills.reverse()
        flat = kind == "flat"
        rows = []
        for i, fill in enumerate(fills):
            at = last - _hours(n - 1 - i)
            hour = at.astimezone(CAIRO).hour
            noise = 0 if flat or i == n - 1 else rng.uniform(-0.6, 0.6)
            temp = max(24.0, min(38.0, 31 + 5 * math.sin(2 * math.pi * (hour - 9) / 24) + rng.gauss(0, 0.8)))
            rows.append({"at": at, "fill": round(max(0.0, min(100.0, fill + noise)), 1), "temp": round(temp, 1)})
        if status == "heat":
            for row in rows[-2:]:
                row["temp"] = round(rng.uniform(61, 70), 1)
        start_v = rng.uniform(3.9, 4.05)
        end_v = rng.uniform(3.10, 3.25) if status == "low_battery" else rng.uniform(3.55, 3.95)
        for i, row in enumerate(rows):
            row["batt"] = round(start_v + (end_v - start_v) * i / max(1, n - 1) + rng.uniform(-0.005, 0.005), 3)
        if status == "low_battery":
            rows[-1]["batt"] = round(end_v, 3)
        return rows

    def bins(self) -> tuple[list[Unit], list[dict]]:
        n_hub = self.count(8, 1)
        n_street = self.count(52, 5)
        total = n_hub + n_street
        n_full = max(1, round(total * 0.15))
        n_heat = max(1, round(total * 0.05))
        n_low = max(1, round(total * 0.10))
        n_off = max(1, round(total * 0.15))
        statuses = (
            ["full"] * n_full + ["heat"] * n_heat + ["low_battery"] * n_low + ["offline"] * n_off
            + ["normal"] * (total - n_full - n_heat - n_low - n_off)
        )  # fmt: skip
        self.rng.shuffle(statuses)
        normal_idx = [i for i, st in enumerate(statuses) if st == "normal"]
        flat_idx = set(normal_idx[: min(3, max(1, len(normal_idx) // 4))])
        recent_idx = set(normal_idx[len(flat_idx) : len(flat_idx) + min(2, max(1, len(normal_idx) // 5))])
        offline_idx = [i for i, st in enumerate(statuses) if st == "offline"]
        never_seen = set(offline_idx[: min(2, len(offline_idx))])
        seen_names: dict[tuple, int] = {}
        units: list[Unit] = []
        infos: list[dict] = []
        for i in range(total):
            hub = i >= n_street
            bid = f"HUB-DEMOL-{i - n_street + 1:02d}" if hub else f"BIN-DEMOL-{i + 1:03d}"
            d = self.district()
            street = self.rng.choice(STREETS[d[1]])
            lat, lng = self.point(d)
            label = f"نقطة تجميع {d[1]}" if hub else f"صندوق {street}"
            seen_names[(d[1], label)] = seen_names.get((d[1], label), 0) + 1
            if seen_names[(d[1], label)] > 1:
                label = f"{label} {_adigits(seen_names[(d[1], label)])}"
            status = statuses[i]
            kind = "flat" if i in flat_idx else ("recent" if i in recent_idx else "normal")
            rate = -0.04 if kind == "flat" else self.rng.uniform(1.0, 4.5)
            base = self.rng.uniform(3, 10)
            if status == "full":
                f_end = self.rng.uniform(84, 99)
            elif kind == "flat":
                f_end = self.rng.uniform(30, 50)
            elif kind == "recent":
                f_end = base + 1.2 * rate
            else:
                f_end = self.rng.uniform(min(10 + 7.5 * rate, 70), 72)
            row = SmartBin(
                id=bid,
                name=f"تجريبي: {label}",
                district=d[1],
                department_id="sanitation",
                lat=lat,
                lng=lng,
                device_key_hash=hashlib.sha256(secrets.token_bytes(32)).hexdigest(),
                is_active=True,
                is_simulated=True,
                full_pct=80,
                heat_c=60,
                interval_min=60,
                last_seq=0,
                created_at=_naive(self.ago(self.rng.uniform(30, 120))),
            )
            rows: list = [row]
            info = {"id": bid, "name": row.name, "lat": lat, "lng": lng, "district": d[1], "status": status}
            if i not in never_seen:
                if status == "offline":
                    last = self.now - timedelta(days=self.rng.uniform(1, 4))
                    n_read = 120
                else:
                    last = self.now - timedelta(minutes=self.rng.uniform(5, 40))
                    n_read = 168
                last = last.replace(microsecond=0)
                series = self._bin_series(status, kind, n_read, last, rate, f_end, base)
                for seq, r in enumerate(series, start=1):
                    received = r["at"] + timedelta(seconds=self.rng.randint(2, 20))
                    rows.append(
                        BinReading(
                            bin_id=bid, seq=seq, recorded_at=_naive(r["at"]), received_at=_naive(received),
                            fill_pct=r["fill"], distance_cm=round(100 * (1 - r["fill"] / 100), 1), temp_c=r["temp"],
                            battery_v=r["batt"], rssi=self.rng.randint(-105, -60), firmware="demo-sim",
                            device_at=_naive(r["at"]), clock_unsynced=False, is_full=r["fill"] >= 80,
                            is_hot=r["temp"] >= 60,
                        )
                    )  # fmt: skip
                latest = rows[-1]
                row.last_seq = latest.seq
                row.fill_pct, row.temp_c, row.battery_v = latest.fill_pct, latest.temp_c, latest.battery_v
                row.is_full, row.is_hot = latest.is_full, latest.is_hot
                row.last_seen_at = latest.received_at
                info["fill"] = latest.fill_pct
            units.append(Unit("smart_bins", bid, rows))
            infos.append(info)
        return units, infos

    # ----- incidents
    def _severity(self, cat: Category) -> str:
        idx = SEVERITIES.index(cat.default_severity or "low")
        roll = self.rng.random()
        if roll < 0.20:
            idx = min(idx + 1, 3)
        elif roll < 0.30:
            idx = max(idx - 1, 0)
        if SEVERITIES[idx] == "critical" and not cat.danger and self.rng.random() > 0.25:
            idx = 2
        return SEVERITIES[idx]

    def _status_for_age(self, age_days: float, force_open: bool) -> str:
        if age_days < 1:
            weights = {"received": 60, "triaged": 40}
        elif age_days < 3:
            weights = {"received": 10, "triaged": 16, "assigned": 22, "in_progress": 22, "resolved": 30}
        elif age_days < 7:
            weights = {"received": 5, "triaged": 8, "assigned": 14, "in_progress": 13, "resolved": 48, "closed": 12}
        elif age_days < 14:
            weights = {"received": 0, "triaged": 3, "assigned": 8, "in_progress": 9, "resolved": 68, "closed": 12}
        elif age_days < 30:
            weights = {"received": 0, "triaged": 0, "assigned": 2, "in_progress": 2, "resolved": 76, "closed": 18}
        else:
            weights = {"received": 0, "triaged": 0, "assigned": 1, "in_progress": 1, "resolved": 77, "closed": 19}
        items = [(k, w) for k, w in weights.items() if not force_open or k in OPEN_STATUSES]
        return self.rng.choices([k for k, _ in items], weights=[w for _, w in items])[0]

    def _created(self, age_days: float) -> datetime:
        """A moment ``age_days`` ago, biased to waking hours, at least 40 minutes before now."""
        for _ in range(20):
            t = self.now - timedelta(days=age_days, seconds=self.rng.uniform(0, 86400))
            hour = t.astimezone(CAIRO).hour
            if self.rng.random() < (0.35 if hour < 6 else 1.0):
                break
        return min(t, self.now - timedelta(minutes=40)).replace(microsecond=0)

    def _spec(self, category: str, d: tuple, lat: float, lng: float, street: str, address: str, created: datetime,
              force_open: bool, kind: str, **extra) -> _IncSpec:  # fmt: skip
        cat = self.ref.categories[category]
        age = (self.now - created).total_seconds() / 86400
        sensitive = self.rng.choice(SENSITIVE_PLACES) if self.rng.random() < 0.10 else None
        landmark = sensitive or (self.rng.choice(LANDMARKS) if self.rng.random() < 0.5 else None)
        return _IncSpec(
            category=category, district=d, lat=lat, lng=lng, address=address, landmark=landmark, sensitive=sensitive,
            severity=self._severity(cat), created=created, status=self._status_for_age(age, force_open), kind=kind,
            **extra,
        )  # fmt: skip

    def incident_specs(self, bin_infos: list[dict]) -> list[_IncSpec]:
        rng = self.rng
        total = self.count(700, 20)
        specs: list[_IncSpec] = []
        mix_ids = [c for c, _ in CATEGORY_MIX]
        mix_cum = list(accumulate(w for _, w in CATEGORY_MIX))

        # garbage hotspots: dense clusters of garbage reports inside the last 25 days
        centres = [
            (self.nasr, 0.0, -0.008), (self.nasr, 0.009, 0.004), (self.nasr, -0.008, 0.009),
            (DISTRICTS[5], 0.0, 0.0), (DISTRICTS[4], 0.0, 0.0), (DISTRICTS[9], 0.0, 0.0), (DISTRICTS[13], 0.0, 0.0),
        ]  # fmt: skip
        for d, dlat, dlng in centres[: max(3, round(7 * self.s))]:
            clat, clng = round(d[3] + dlat, 6), round(d[4] + dlng, 6)
            street, address = self.place(d)
            for _ in range(rng.randint(4, 8)):
                lat, lng = self.offset(clat, clng, min(300, abs(rng.gauss(0, 140))), rng.uniform(0, 2 * math.pi))
                specs.append(
                    self._spec(
                        "garbage", d, lat, lng, street, address, self._created(rng.uniform(0.3, 25)), False, "hot"
                    )
                )

        # duplicate groups: 2-3 open reports of one category 30-200 m apart
        for _ in range(self.count(25, 3)):
            d = self.district()
            category = rng.choices(mix_ids, cum_weights=mix_cum)[0]
            street, address = self.place(d)
            clat, clng = self.point(d)
            first = self._created(rng.uniform(0.3, 5))
            for k in range(rng.choice((2, 2, 3))):
                lat, lng = self.offset(clat, clng, rng.uniform(30, 200) if k else 0, rng.uniform(0, 2 * math.pi))
                created = min(first + timedelta(hours=rng.uniform(1, 70)), self.now - timedelta(minutes=40))
                specs.append(
                    self._spec(category, d, lat, lng, street, address, created.replace(microsecond=0), True, "dup")
                )

        # full smart bins: one open garbage incident each, at the bin
        for info in bin_infos:
            if info["status"] != "full":
                continue
            d = next(x for x in DISTRICTS if x[1] == info["district"])
            created = self._created(rng.uniform(0.3, 3))
            specs.append(
                self._spec("garbage", d, info["lat"], info["lng"], info["name"], info["name"], created, True, "bin",
                           bin_id=info["id"], bin_name=info["name"])
            )  # fmt: skip

        # everything else: a rising daily volume over 90 days, a little lower on Fridays
        rest = max(0, total - len(specs))
        weights = []
        for a in range(90):
            day = (self.now - timedelta(days=a, hours=12)).astimezone(CAIRO)
            w = 1 + 0.6 * (1 - a / 90) ** 2
            w *= 0.6 if a < 7 else 1.0  # duplicate groups and bin incidents already add the recent rise
            w *= 0.7 if day.weekday() == 4 else 1.0
            weights.append(w)
        scale = rest / sum(weights)
        done, running = 0, 0.0
        for a, w in enumerate(weights):
            running += w * scale
            n_day = round(running) - done
            done += n_day
            for _ in range(n_day):
                d = self.district()
                street, address = self.place(d)
                lat, lng = self.point(d)
                category = rng.choices(mix_ids, cum_weights=mix_cum)[0]
                specs.append(
                    self._spec(category, d, lat, lng, street, address, self._created(a + 0.0), False, "normal")
                )  # fmt: skip
        specs.sort(key=lambda sp: (sp.created, sp.category, sp.lat))
        return specs

    def _timeline(self, spec: _IncSpec, target_days: int) -> dict[str, datetime]:
        rng = self.rng
        k = INCIDENT_STATUSES.index(spec.status)
        offs = {"received": 0.0}
        offs["triaged"] = rng.uniform(0.5, 6)
        offs["assigned"] = max(offs["triaged"] + 0.5, rng.uniform(6, 36))
        offs["in_progress"] = max(offs["assigned"] + 0.5, rng.uniform(12, 72))
        offs["resolved"] = max(offs["in_progress"] + 1.0, target_days * 24 * rng.uniform(0.4, 1.6))
        offs["closed"] = offs["resolved"] + rng.uniform(24, 72)
        chain = list(INCIDENT_STATUSES[: k + 1])
        limit = (self.now - spec.created).total_seconds() / 3600 - 10 / 60
        last = offs[chain[-1]]
        factor = min(1.0, limit / last) if last > 0 else 1.0
        times: dict[str, datetime] = {}
        prev = spec.created
        for st in chain:
            t = spec.created + _hours(offs[st] * factor)
            if st != "received":
                t = max(t, prev + timedelta(seconds=60))
            times[st] = t.replace(microsecond=0)
            prev = times[st]
        return times

    def incident_bundles(self, specs: list[_IncSpec], citizen_ids: list[str]) -> list[_IncBundle]:
        rng = self.rng
        pool = _Pool(citizen_ids, rng, 0.5)
        bundles: list[_IncBundle] = []
        report_n = 0
        ai_n = 0
        wo_n = 0
        teams_by_dept: dict[str, list[dict]] = {}
        for t in TEAMS:
            teams_by_dept.setdefault(t["department"], []).append(t)
        for idx, spec in enumerate(specs, start=1):
            cat = self.ref.categories[spec.category]
            dept = self.ref.departments[cat.department_id]
            iid = f"INC-DEMOL-{idx:04d}"
            status = spec.status
            times = self._timeline(spec, cat.target_days)
            street = spec.address.split("،")[0] if spec.kind != "bin" else spec.address
            template = rng.choice(TITLE_TEMPLATES)
            title = (
                f"{cat.label_ar} · {street}"
                if spec.kind in ("bin", "hot")
                else template.format(label=cat.label_ar, street=street, n=_adigits(rng.randint(1, 60)))
            )
            end = times.get("resolved", self.now - timedelta(minutes=5))
            # reporters
            n_rep = 1
            while rng.random() < 0.38 and n_rep < 8:
                n_rep += 1
            if spec.kind == "bin":
                n_rep = rng.randint(1, 3)
            reporters = pool.distinct(n_rep)
            reports: list[Report] = []
            for i, rid in enumerate(reporters):
                anonymous = spec.kind != "bin" and rng.random() < 0.15
                if i == 0:
                    at = spec.created
                else:
                    cap = max(0.02, min(72.0, (end - spec.created).total_seconds() / 3600))
                    at = spec.created + _hours(rng.uniform(0.01, cap))
                lat, lng = self.offset(spec.lat, spec.lng, rng.uniform(0, 15), rng.uniform(0, 2 * math.pi))
                report_n += 1
                desc = (
                    f"الحاوية الذكية {spec.bin_name} ممتلئة"
                    if spec.kind == "bin"
                    else rng.choice(DESCRIPTIONS[spec.category])
                )
                reports.append(
                    Report(
                        id=f"FTC-DEMOL-{report_n:05d}",
                        reporter_id=ANON_ID if anonymous else rid,
                        incident_id=iid,
                        category_id=spec.category,
                        description=desc,
                        photo_paths=[],
                        voice_note_path=None,
                        lat=lat,
                        lng=lng,
                        address=spec.address,
                        landmark=spec.landmark,
                        anonymous=anonymous,
                        blur_faces=False,
                        severity_suggested=spec.severity if rng.random() < 0.30 else None,
                        source="app" if rng.random() < 0.70 else "web",
                        created_at=_naive(at.replace(microsecond=0)),
                    )
                )
            reports.sort(key=lambda r: (r.created_at, r.id))
            follower_ids = []
            for r in reports:
                if r.reporter_id != ANON_ID and r.reporter_id not in follower_ids:
                    follower_ids.append(r.reporter_id)
            extra = rng.choices(range(7), weights=[50, 20, 12, 8, 5, 3, 2])[0]
            for other in pool.distinct(extra):
                if other not in follower_ids:
                    follower_ids.append(other)
            if not follower_ids:
                follower_ids.append(pool.draw())
            latest_ok = _naive(self.now - timedelta(minutes=5))
            followers = [
                IncidentFollower(
                    incident_id=iid,
                    user_id=uid,
                    created_at=min(
                        latest_ok,
                        reports[min(i, len(reports) - 1)].created_at
                        + timedelta(minutes=rng.randint(0, 600) if i >= len(reports) else 0),
                    ),
                )
                for i, uid in enumerate(follower_ids)
            ]
            priority = compute_priority(
                {
                    "severity": spec.severity,
                    "near_sensitive_place": bool(spec.sensitive),
                    "reporters": len(reports),
                    "days_open": max(0, (self.now - spec.created).days),
                    "target_days": cat.target_days,
                    "area_underserved": spec.district[1] in UNDERSERVED_DISTRICTS,
                }
            )
            last_at = times[status]
            reviewed_by = DEPT_STAFF.get(cat.department_id) if status != "received" else None
            incident = Incident(
                id=iid,
                category_id=spec.category,
                title=title,
                severity=SeverityEnum(spec.severity),
                status=IncidentStatusEnum(status),
                department_id=cat.department_id,
                estimated_cost_egp=cat.estimated_cost_egp,
                priority_score=priority["score"],
                priority_factors=priority["factors"],
                followers_count=len(followers),
                lat=spec.lat,
                lng=spec.lng,
                address=spec.address,
                landmark=spec.landmark,
                sensitive_place=spec.sensitive,
                area_underserved=spec.district[1] in UNDERSERVED_DISTRICTS,
                work_order_id=None,
                eta="خلال ٣ أيام" if status in OPEN_STATUSES else None,
                last_reviewed_by=reviewed_by,
                last_reviewed_at=_naive(times["triaged"]) if reviewed_by else None,
                created_at=_naive(spec.created),
                updated_at=_naive(last_at),
            )
            activity = []
            for st, at in times.items():
                entry = incident_timeline_entry(st, cat.label_ar, spec.severity, dept.name_ar, at)
                activity.append(
                    ActivityLog(
                        entity_type="incident", entity_id=iid, status=st, note=entry["note"], actor=entry["actor"],
                        kind="status_change", at=_naive(at),
                    )
                )  # fmt: skip
            suggestion = None
            if status == "received" or (status == "triaged" and rng.random() < 0.30):
                ai_n += 1
                confirmed = status != "received" and reviewed_by is not None
                alts = AI_ALTERNATIVES[spec.category]
                suggestion = AISuggestion(
                    id=f"AS-DEMOL-{ai_n:04d}",
                    report_id=reports[0].id,
                    kind="triage",
                    payload={
                        "options": [
                            {"categoryId": spec.category, "confidence": 0.85 if confirmed else 0.82},
                            {"categoryId": alts[0], "confidence": 0.10 if confirmed else 0.11},
                            {"categoryId": alts[1], "confidence": 0.05},
                        ],
                        "severity": spec.severity,
                        "summary": f"تصنيف آلي{' مؤكد' if confirmed else ''}: {cat.label_ar}",
                        "source": "fallback",
                        "confirmed": confirmed,
                    },
                    model="fallback",
                    created_at=_naive(spec.created + timedelta(minutes=10 if confirmed else 5)),
                )
            work_order, wo_activity = None, []
            if status in ("assigned", "in_progress", "resolved", "closed"):
                wo_n += 1
                work_order, wo_activity = self._work_order(wo_n, iid, spec, cat, dept, times, teams_by_dept)
                incident.work_order_id = work_order.id
            bin_reports = []
            if spec.kind == "bin":
                for r in reports:
                    bin_reports.append(
                        BinReport(
                            bin_id=spec.bin_id, incident_id=iid, reporter_id=r.reporter_id, note=None,
                            created_at=r.created_at,
                        )
                    )  # fmt: skip
            bundles.append(
                _IncBundle(spec, incident, reports, followers, activity, suggestion, work_order, wo_activity,
                           bin_reports, times)
            )  # fmt: skip
        return bundles

    def _work_order(self, n: int, iid: str, spec: _IncSpec, cat: Category, dept: Department, times: dict,
                    teams_by_dept: dict) -> tuple[WorkOrder, list[ActivityLog]]:  # fmt: skip
        rng = self.rng
        status = spec.status
        if status == "assigned":
            wo_status = "open" if rng.random() < 0.10 else "assigned"
        elif status == "in_progress":
            wo_status = "in_progress"
        else:
            wo_status = "done"
        team_pool = teams_by_dept.get(dept.name_ar)
        team = size = None
        if team_pool and wo_status != "open":
            chosen = rng.choice(team_pool)
            team, size = chosen["name"], chosen["size"]
        if dept.external_hotline and dept.id in ("water", "electricity"):
            supervisor = f"بلّغنا الشركة · الخط الساخن {dept.external_hotline}"
        else:
            supervisor = rng.choice(SUPERVISORS)
        labels = TASKS_BY_CATEGORY.get(cat.id, DEFAULT_TASKS)
        done_count = {"open": 0, "assigned": 0, "in_progress": 2, "done": len(labels)}[wo_status]
        tasks = [{"label": label, "done": i < done_count} for i, label in enumerate(labels)]
        assigned_at = times["assigned"]
        resolved_at = times.get("resolved")
        wo = WorkOrder(
            id=f"WO-DEMOL-{n:04d}",
            incident_id=iid,
            department_id=dept.id,
            team=team,
            team_size=size,
            supervisor=supervisor,
            status=WorkOrderStatusEnum(wo_status),
            due_at=_naive(spec.created + timedelta(days=cat.target_days)),
            estimated_cost_egp=cat.estimated_cost_egp,
            tasks=tasks,
            created_at=_naive(assigned_at),
            updated_at=_naive(times[status]),
            resolved_at=_naive(resolved_at) if wo_status == "done" and resolved_at else None,
        )
        notes = {
            "open": f"اتسلّم أمر الشغل · {supervisor}",
            "assigned": f"اتوزّع على {team or dept.name_ar} · {supervisor}",
            "in_progress": f"الفريق بدأ الشغل · {supervisor}",
            "done": f"اتحلّت والصور اترفعت · {supervisor}",
        }
        stamps = [("open", assigned_at)]
        if wo_status != "open":
            stamps.append(("assigned", assigned_at + timedelta(minutes=5)))
        if wo_status in ("in_progress", "done"):
            stamps.append(("in_progress", times["in_progress"]))
        if wo_status == "done":
            stamps.append(("done", times["resolved"]))
        log = [
            ActivityLog(
                entity_type="work_order", entity_id=wo.id, status=st, note=notes[st], actor=supervisor or "النظام",
                kind="status_change", at=_naive(at),
            )
            for st, at in stamps
        ]  # fmt: skip
        return wo, log

    def link_citizen(self, bundles: list[_IncBundle]) -> None:
        """Local demo citizen becomes the origin reporter of 12 incidents of mixed status (2 in duplicate groups)."""
        cid = self.ref.citizen_profile
        if not cid:
            return
        picked: list[_IncBundle] = []

        def take(pred, count: int) -> None:
            for b in bundles:
                if count > 0 and len(picked) < 12 and b not in picked and pred(b):
                    picked.append(b)
                    count -= 1

        in_nasr = lambda b: b.spec.district[0] == "nasr-1"  # noqa: E731
        take(lambda b: in_nasr(b) and b.spec.kind == "dup" and b.spec.status in OPEN_STATUSES, 2)
        wanted = [("received", 1), ("triaged", 1), ("assigned", 1), ("in_progress", 2), ("resolved", 4), ("closed", 1)]
        for status, count in wanted:
            take(lambda b, st=status: in_nasr(b) and b.spec.kind == "normal" and b.spec.status == st, count)
        for b in picked:
            first = b.reports[0]
            first.reporter_id, first.anonymous = cid, False
            if all(f.user_id != cid for f in b.followers):
                b.followers.append(
                    IncidentFollower(incident_id=b.incident.id, user_id=cid, created_at=first.created_at)
                )
                b.incident.followers_count = len(b.followers)
            for st, at in b.times.items():
                self.profile_events.setdefault(cid, []).append(("incident_status", b.incident.id, st, at))

    def incident_units(self, bundles: list[_IncBundle]) -> list[Unit]:
        units = []
        for b in bundles:
            rows: list = [b.incident, *b.reports, *b.followers, *b.activity, *b.bin_reports]
            if b.suggestion:
                rows.append(b.suggestion)
            if b.work_order:
                rows.extend([b.work_order, *b.wo_activity])
            units.append(Unit("incidents", b.incident.id, rows))
        return units

    # ----- service requests
    def service_units(self, citizen_ids: list[str], start_wo: int) -> list[Unit]:
        rng = self.rng
        pool = _Pool(citizen_ids, rng, 0.4)
        total = self.count(120, 6)
        order = INCIDENT_STATUSES
        status_w = [("received", 25), ("triaged", 10), ("assigned", 25), ("in_progress", 10), ("resolved", 25),
                    ("closed", 5)]  # fmt: skip
        reserved = ["assigned", "resolved", "received"] if self.ref.citizen_profile else []
        units: list[Unit] = []
        wo_n = start_wo
        teams = {t["department"]: t for t in TEAMS}
        for idx in range(1, total + 1):
            sid = f"SRV-DEMOL-{idx:04d}"
            status = reserved.pop(0) if reserved else rng.choices([s for s, _ in status_w], [w for _, w in status_w])[0]
            citizen = self.ref.citizen_profile if idx <= 3 and self.ref.citizen_profile else pool.draw()
            stype = "bulky_waste" if rng.random() < 0.65 else "tree_maintenance"
            d = self.district()
            street, address = self.place(d)
            lat, lng = self.point(d)
            if self.ref.citizen_profile and citizen == self.ref.citizen_profile:
                d, (_, address) = self.nasr, self.place(self.nasr)
                lat, lng = self.point(self.nasr)
            age = rng.uniform(3, 30) if status in ("resolved", "closed") else rng.uniform(0.1, 6)
            created = self._created(age)
            payment = (
                rng.choice(["cash", "fawry", "instapay", "wallet"])
                if stype == "bulky_waste"
                else rng.choice([None, "cash", "fawry"])
            )
            closed_status = status in ("resolved", "closed")
            if closed_status:
                day = (created + timedelta(days=rng.randint(1, 2))).astimezone(CAIRO).date()
            else:
                base = (self.now + timedelta(days=rng.randint(1, 9))).astimezone(CAIRO).date()
                while stype == "bulky_waste" and base.weekday() in (4, 5):
                    base += timedelta(days=1)
                day = base
            details = {"items": rng.sample(SR_ITEMS[stype], rng.randint(1, 2)), "day": day.isoformat(),
                       "slot": rng.choice(["morning", "afternoon"])}  # fmt: skip
            if payment:
                details["payment"] = payment
            if rng.random() < 0.3:
                details["note"] = rng.choice(SR_NOTES)
            k = order.index(status)
            gaps = [0.0, rng.uniform(0.5, 4), rng.uniform(4, 20), rng.uniform(20, 36), rng.uniform(36, 72),
                    rng.uniform(72, 120)]  # fmt: skip
            limit = (self.now - created).total_seconds() / 3600 - 10 / 60
            factor = min(1.0, limit / gaps[k]) if gaps[k] > 0 else 1.0
            times: dict[str, datetime] = {}
            prev = created
            for st, g in zip(order[: k + 1], gaps, strict=False):
                t = created + _hours(g * factor)
                if st != "received":
                    t = max(t, prev + timedelta(seconds=60))
                times[st] = t.replace(microsecond=0)
                prev = times[st]
            sr = ServiceRequest(
                id=sid, citizen_id=citizen, service_type=stype, details=details, lat=lat, lng=lng, address=address,
                landmark=rng.choice(LANDMARKS) if rng.random() < 0.3 else None,
                status=IncidentStatusEnum(status),
                paid=bool(payment and payment != "cash" and status in ("assigned", "in_progress", "resolved", "closed")),
                created_at=_naive(created),
            )  # fmt: skip
            rows: list = [sr]
            for st, at in times.items():
                entry = service_timeline_entry(st, at)
                rows.append(
                    ActivityLog(
                        entity_type="service_request", entity_id=sid, status=st, note=entry["note"],
                        actor=entry["actor"], kind="status_change", at=_naive(at),
                    )
                )  # fmt: skip
            if status in ("assigned", "in_progress", "resolved") and rng.random() < 0.40:
                wo_n += 1
                dept_id = "sanitation" if stype == "bulky_waste" else "parks"
                dept = self.ref.departments[dept_id]
                team = teams.get(dept.name_ar)
                wo_status = {"assigned": "assigned", "in_progress": "in_progress", "resolved": "done"}[status]
                tasks = [{"label": t, "done": wo_status == "done"} for t in DEFAULT_TASKS]
                supervisor = rng.choice(SUPERVISORS)
                wo = WorkOrder(
                    id=f"WO-DEMOL-{wo_n:04d}", incident_id=None, service_request_id=sid, department_id=dept_id,
                    team=team["name"] if team else None, team_size=team["size"] if team else None,
                    supervisor=supervisor, status=WorkOrderStatusEnum(wo_status),
                    due_at=_naive(created + timedelta(days=3)),
                    estimated_cost_egp=None, tasks=tasks, created_at=_naive(times["assigned"]),
                    updated_at=_naive(times[status]),
                    resolved_at=_naive(times["resolved"]) if wo_status == "done" else None,
                )  # fmt: skip
                rows.append(wo)
                rows.append(
                    ActivityLog(
                        entity_type="work_order", entity_id=wo.id, status="open", note=f"اتسلّم أمر الشغل · {supervisor}",
                        actor=supervisor, kind="status_change", at=_naive(times["assigned"]),
                    )
                )  # fmt: skip
            units.append(Unit("service_requests", sid, rows))
        return units

    # ----- recycling pickups
    def _items(self) -> list[dict]:
        rng = self.rng
        weights = {"pet_plastic": 30, "paper_cardboard": 25, "metal_cans": 12, "glass": 10, "e_waste": 6,
                   "cooking_oil": 8, "organics": 9}  # fmt: skip
        ranges = {"pet_plastic": (1, 8), "paper_cardboard": (2, 20), "metal_cans": (0.5, 5), "glass": (1, 10),
                  "e_waste": (1, 6), "cooking_oil": (1, 5), "organics": (2, 15)}  # fmt: skip
        chosen: list[str] = []
        for _ in range(rng.choice((1, 1, 2, 2, 3))):
            pick = rng.choices(MATERIAL_IDS, weights=[weights[m] for m in MATERIAL_IDS])[0]
            if pick not in chosen:
                chosen.append(pick)
        return [{"materialId": m, "estimatedKg": round(rng.uniform(*ranges[m]) * 2) / 2 or 0.5} for m in chosen]

    def pickup_units(self, citizen_ids: list[str], collectors: list[dict]) -> list[Unit]:
        rng = self.rng
        pool = _Pool(citizen_ids, rng, 0.5)
        total = self.count(300, 12)
        ref, opts = self.ref, self.opts
        local = opts.open_pickups
        mix = (
            [("completed", 50), ("weighed", 10), ("accepted", 10), ("requested", 15), ("cancelled", 15)]
            if local
            else [("completed", 65), ("weighed", 10), ("accepted", 10), ("cancelled", 15)]
        )
        # reserved rows for the linked local citizen / collector: (status, citizen, force collector)
        reserved: list[tuple[str, str | None, bool]] = []
        if ref.citizen_profile:
            n_c = max(3, round(8 * self.s))
            reserved += [("completed", ref.citizen_profile, True)] * max(1, n_c - 2)
            reserved += [("weighed", ref.citizen_profile, True), ("requested", ref.citizen_profile, False)]
        if ref.collector_id:
            n_k = max(3, round(23 * self.s))
            reserved += [("completed", None, True)] * max(1, n_k - 5)
            reserved += [("weighed", None, True)] * 2 + [("accepted", None, True)] * 2
        specs = []
        for i in range(total):
            if i < len(reserved):
                status, citizen, force = reserved[i]
                d = self.nasr
            else:
                status, citizen, force = rng.choices([s for s, _ in mix], [w for _, w in mix])[0], None, False
                d = self.district()
            citizen = citizen or pool.draw()
            age = {
                "completed": 1.5 + 58 * rng.random() ** 1.3,
                "weighed": rng.uniform(0.4, 3),
                "accepted": rng.uniform(0.4, 2),
                "requested": rng.uniform(0.05, 2.5),
                "cancelled": rng.uniform(0.2, 60),
            }[status]
            if force and ref.collector_joined:
                age = min(age, (self.now - ref.collector_joined).total_seconds() / 86400 - 2)
            specs.append((self._created(age), status, citizen, force, d))
        specs.sort(key=lambda sp: (sp[0], sp[1], sp[2]))
        verified = [c for c in collectors if c["status"] == "verified"]
        susp = [c for c in collectors if c["status"] == "suspended"]
        units: list[Unit] = []
        wgh_n = 0
        for idx, (created, status, citizen, force, d) in enumerate(specs, start=1):
            pid = f"RCY-DEMOL-{idx:04d}"
            street, address = self.place(d)
            lat, lng = self.point(d)
            items = self._items()
            prices = ref.prices.get(d[1], {})
            mode = "paid" if rng.random() < 0.60 else "free"
            # time chain relative to created, so everything provably happens before ``now``
            acc_off = rng.uniform(10, 240) / 60
            weigh_off = acc_off + rng.uniform(0.5, 3)
            fin_off = weigh_off + len(items) * 5 / 60 + rng.uniform(5, 40) / 60
            conf_off = fin_off + rng.uniform(0.5, 24)
            span = {"requested": 0, "cancelled": rng.uniform(0.2, 20), "accepted": acc_off, "weighed": fin_off,
                    "completed": conf_off}[status]  # fmt: skip
            created = min(created, self.now - _hours(span) - timedelta(minutes=5)).replace(microsecond=0)
            collector = None
            if status in ("accepted", "weighed", "completed"):
                if force and ref.collector_id:
                    collector = {"id": ref.collector_id, "first": ref.collector_name, "district": d[1]}
                else:
                    pool_c = [c for c in verified if c["joined"] <= created - timedelta(days=1)]
                    if status == "completed" and created < self.now - timedelta(days=20):
                        pool_c += [c for c in susp if c["joined"] <= created - timedelta(days=1)]
                    near = [c for c in pool_c if c["district"] == d[1]]
                    pick_from = (near if near and rng.random() < 0.7 else pool_c) or verified
                    collector = rng.choice(pick_from)
            acc_at = created + _hours(acc_off)
            row = RecyclingPickup(
                id=pid, citizen_id=citizen, items=items, photo_paths=[], lat=lat, lng=lng, address=address,
                landmark=rng.choice(LANDMARKS) if rng.random() < 0.3 else None, district=d[1],
                day=(created + timedelta(days=rng.randint(0, 3))).astimezone(CAIRO).date().isoformat(),
                slot=rng.choice(["morning", "afternoon"]), mode=mode,
                note=rng.choice(PICKUP_NOTES) if rng.random() < 0.25 else None,
                estimated_value_egp=estimate_value(items, prices), status=status,
                collector_id=collector["id"] if collector else None,
                accepted_at=_naive(acc_at) if collector else None, created_at=_naive(created),
            )  # fmt: skip
            rows: list = [row]
            logs: list[tuple[str, str, str, datetime]] = [
                ("requested", "سيتي سايكل", "طلبك وصل وبندوّر على جامع قريب", created)
            ]
            if status == "cancelled":
                logs.append(("cancelled", "مواطن", "المواطن لغى الطلب", created + _hours(span)))
            if collector:
                first = collector["first"]
                logs.append(("accepted", first, "الجامع قبل طلبك وجاي لك", acc_at))
            weighings = []
            if status in ("weighed", "completed"):
                base_at = created + _hours(weigh_off)
                total_value = 0.0
                for i, it in enumerate(items):
                    wgh_n += 1
                    kg = round(it["estimatedKg"] * rng.uniform(0.8, 1.15), 1) or 0.1
                    price = prices.get(it["materialId"])
                    value = round(price * kg, 2) if price is not None else None
                    total_value += value or 0.0
                    src_ble = rng.random() < 0.30
                    weighings.append(
                        Weighing(
                            id=f"WGH-DEMOL-{wgh_n:05d}", pickup_id=pid, collector_id=collector["id"],
                            material_id=it["materialId"], kg=kg, source="scale_ble" if src_ble else "manual",
                            scale_id=f"SCALE-DEMOL-{rng.randint(1, 5):02d}" if src_ble else None,
                            price_egp_per_kg=price, value_egp=value, client_id=f"demol-{pid}-{i + 1}",
                            at=_naive(base_at + timedelta(minutes=5 * i)),
                        )
                    )  # fmt: skip
                logs.append(("weighed", collector["first"], "الجامع بدأ يوزن الخامات", base_at))
                finished = status == "completed" or rng.random() < 0.5
                if finished:
                    fin_at = created + _hours(fin_off)
                    row.collector_finished_at = _naive(fin_at)
                    logs.append(("weighed", collector["first"], "الجامع خلّص، ومستني تأكيدك للوزن", fin_at))
                    if mode == "paid" and total_value > 0:
                        row.paid_to_household_egp = round(total_value * rng.uniform(0.85, 1.0))
                if status == "completed":
                    conf_at = created + _hours(conf_off)
                    row.confirmed_at = _naive(conf_at)
                    logs.append(("completed", "مواطن", "اتأكد الوزن، شكرًا إنك بتدوّر", conf_at))
            rows.extend(weighings)
            for st, actor, note, at in logs:
                rows.append(
                    ActivityLog(entity_type="recycling_pickup", entity_id=pid, status=st, note=note, actor=actor,
                                kind="status_change", at=_naive(at))
                )  # fmt: skip
            if citizen == ref.citizen_profile:
                for st, _, _, at in logs:
                    self.profile_events.setdefault(citizen, []).append(("pickup_status", pid, st, at))
            if collector and ref.collector_id and collector["id"] == ref.collector_id and ref.collector_profile:
                for st, _, _, at in logs[1:]:
                    self.profile_events.setdefault(ref.collector_profile, []).append(("pickup_status", pid, st, at))
            units.append(Unit("recycling_pickups", pid, rows))
        return units

    # ----- local-only extras
    def price_units(self) -> list[Unit]:
        units = []
        for district in self.ref.missing_price_districts:
            rows = [
                MaterialPriceRow(
                    district=district, material_id=m, price_egp_per_kg=DEMO_PRICES[m],
                    updated_at=_naive(self.ago(1)),
                )
                for m in MATERIAL_IDS
            ]  # fmt: skip
            units.append(Unit("material_prices", district, rows))
        return units

    def notification_units(self) -> list[Unit]:
        if not self.opts.notifications:
            return []
        units: list[Unit] = []
        n = 0
        cutoff = self.now - timedelta(days=21)
        for recipient in sorted(self.profile_events):
            cap = 30 if recipient == self.ref.citizen_profile else 10
            events = sorted(
                (e for e in self.profile_events[recipient] if e[3] >= cutoff and e[2] not in ("requested", "received")),
                key=lambda e: (e[3], e[1], e[2]),
                reverse=True,
            )[:cap]
            for kind, resource, status, at in sorted(events, key=lambda e: (e[3], e[1], e[2])):
                n += 1
                key_name = "incidentId" if kind == "incident_status" else "pickupId"
                nid = f"demol-ntf-{n:05d}"
                units.append(
                    Unit(
                        "notifications",
                        nid,
                        [
                            Notification(
                                id=nid, recipient_id=recipient, kind=kind,
                                title="تحديث على بلاغك" if kind == "incident_status" else "تحديث على طلبك",
                                body="حالة البلاغ اتحدثت." if kind == "incident_status" else "حالة طلب التدوير اتحدثت.",
                                data={key_name: resource}, event_key=f"demol:{resource}:{status}:{int(at.timestamp())}",
                                created_at=_naive(at), read_at=_naive(at + timedelta(hours=2)) if n % 5 < 3 else None,
                            )
                        ],
                    )
                )  # fmt: skip
        return units

    # ----- everything
    def build(self) -> list[Unit]:
        units: list[Unit] = []
        units += self.price_units()
        profile_units, citizens = self.profiles()
        units += profile_units
        collector_units, collectors = self.collectors()
        units += collector_units
        bin_units, bin_infos = self.bins()
        units += bin_units
        specs = self.incident_specs(bin_infos)
        bundles = self.incident_bundles(specs, citizens)
        self.link_citizen(bundles)
        units += self.incident_units(bundles)
        wo_count = sum(1 for b in bundles if b.work_order)
        units += self.service_units(citizens, wo_count)
        units += self.pickup_units(citizens, collectors)
        units += self.notification_units()
        return units


def build_dataset(now: datetime, ref: Reference, opts: LargeOptions) -> list[Unit]:
    """Pure generation: the same (now, reference, options) always gives the same rows (but device keys)."""
    return _Generator(now, ref, opts).build()


# --------------------------------------------------------------------------- database access
def _existing_roots(db: Session) -> dict[str, set[str]]:
    from app.models import Base

    tables = Base.metadata.tables
    found: dict[str, set[str]] = {}
    for table, patterns in SELECTORS.items():
        col = tables[table].c.id
        rows = db.execute(select(col).where(or_(*[col.like(p) for p in patterns]))).scalars().all()
        found[table] = set(rows)
    return found


def _counts(units: list[Unit]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for unit in units:
        for row in unit.rows:
            counts[row.__tablename__] = counts.get(row.__tablename__, 0) + 1
    return dict(sorted(counts.items()))


def _pending(db: Session, units: list[Unit]) -> tuple[list[Unit], int]:
    existing = _existing_roots(db)
    todo, present = [], 0
    for unit in units:
        if unit.table == "material_prices":
            todo.append(unit)  # only built for districts without a price list
        elif unit.root_id in existing.get(ROOT_TABLES[unit.table], set()):
            present += 1
        else:
            todo.append(unit)
    return todo, present


def plan(db: Session, opts: LargeOptions, now: datetime | None = None) -> dict:
    """Dry run: what ``apply`` would insert. Reads only."""
    ref = load_reference(db, opts)
    units = build_dataset(now or now_utc(), ref, opts)
    todo, present = _pending(db, units)
    samples: dict[str, list[str]] = {}
    for unit in todo:
        bucket = samples.setdefault(unit.table, [])
        if len(bucket) < 3:
            bucket.append(unit.root_id)
    return {
        "mode": "dry-run",
        "scale": opts.scale,
        "seed": opts.seed,
        "counts": _counts(todo),
        "unitsPresent": present,
        "unitsToAdd": len(todo),
        "sampleIds": samples,
    }


def _begin(db: Session) -> None:
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SET LOCAL statement_timeout = '60s'"))
        db.execute(text("SET LOCAL lock_timeout = '5s'"))


def _insert(db: Session, units: list[Unit]) -> None:
    rows = [row for unit in units for row in unit.rows]
    for model in FLUSH_ORDER:
        batch = [row for row in rows if isinstance(row, model)]
        if batch:
            db.add_all(batch)
            db.flush()


def apply(db: Session, opts: LargeOptions, now: datetime | None = None, chunk_units: int = 200,
          pause_ms: int = 0) -> dict:  # fmt: skip
    """Insert the units that are not there yet. Chunked, resumable, idempotent; never updates or deletes."""
    ref = load_reference(db, opts)
    units = build_dataset(now or now_utc(), ref, opts)
    todo, present = _pending(db, units)
    started = time.monotonic()
    inserted: dict[str, int] = {}
    chunks = 0
    i = 0
    while i < len(todo):
        phase = todo[i].table
        size = 5 if phase == "smart_bins" else chunk_units
        chunk = []
        while i < len(todo) and todo[i].table == phase and len(chunk) < size:
            chunk.append(todo[i])
            i += 1
        try:
            _begin(db)
            _insert(db, chunk)
            db.commit()
        except Exception:
            db.rollback()
            raise
        for table, n in _counts(chunk).items():
            inserted[table] = inserted.get(table, 0) + n
        chunks += 1
        if pause_ms:
            time.sleep(pause_ms / 1000)
    return {
        "mode": "apply",
        "scale": opts.scale,
        "seed": opts.seed,
        "counts": dict(sorted(inserted.items())),
        "unitsPresent": present,
        "unitsToAdd": len(todo),
        "transactions": chunks,
        "seconds": round(time.monotonic() - started, 2),
    }


# --------------------------------------------------------------------------- cleanup
def _like(col, patterns: tuple[str, ...]):
    return or_(*[col.like(p) for p in patterns])


def _ids(db: Session, table: str) -> list[str]:
    from app.models import Base

    col = Base.metadata.tables[table].c.id
    return list(db.execute(select(col).where(_like(col, SELECTORS[table]))).scalars().all())


def _blockers(db: Session, ids: dict[str, list[str]]) -> dict[str, dict]:
    """Real rows that point into demo rows. Cleanup refuses to run while any exist."""
    inc, sr, pk = ids["incidents"], ids["service_requests"], ids["recycling_pickups"]
    col, prof, binz = ids["collectors"], ids["profiles"], ids["smart_bins"]

    def chunked(values):
        for start in range(0, len(values), 500):
            yield values[start : start + 500]

    checks = {
        "reports": (Report, lambda m, v: m.incident_id.in_(v), inc, Report.id.notlike("FTC-DEMOL-%")),
        "work_orders": (WorkOrder, lambda m, v: or_(m.incident_id.in_(v), m.service_request_id.in_(v)), inc + sr,
                        WorkOrder.id.notlike("WO-DEMOL-%")),
        "recycling_pickups": (RecyclingPickup, lambda m, v: or_(m.collector_id.in_(v), m.citizen_id.in_(v)),
                              col + prof, RecyclingPickup.id.notlike("RCY-DEMOL-%")),
        "recycling_weighings": (Weighing, lambda m, v: or_(m.pickup_id.in_(v), m.collector_id.in_(v)), pk + col,
                                Weighing.id.notlike("WGH-DEMOL-%")),
        "bin_reports": (BinReport, lambda m, v: m.bin_id.in_(v), binz,
                        or_(BinReport.incident_id.notlike("INC-DEMOL-%"), BinReport.reporter_id.notlike("demol-%"))),
        "hub_weighings": (HubWeighing, lambda m, v: or_(m.hub_id.in_(v), m.pickup_id.in_(v)), binz + pk, None),
        "collectors": (Collector, lambda m, v: m.profile_id.in_(v), prof, Collector.id.notlike("COL-DEMOL-%")),
        "push_tokens": (PushToken, lambda m, v: m.user_id.in_(v), prof, None),
    }  # fmt: skip
    out: dict[str, dict] = {}
    for name, (model, cond, values, extra) in checks.items():
        count, sample = 0, []
        for part in chunked(values):
            q = db.query(model).filter(cond(model, part))
            if extra is not None:
                q = q.filter(extra)
            count += q.count()
            if len(sample) < 5:
                sample += [str(getattr(r, "id", "")) for r in q.limit(5 - len(sample)).all()]
        if count:
            out[name] = {"count": count, "sample": sample[:5]}
    return out


def _delete_in(db: Session, table, column, values: list, extra=None) -> int:
    total = 0
    for start in range(0, len(values), 1000):
        stmt = delete(table).where(column.in_(values[start : start + 1000]))
        if extra is not None:
            stmt = stmt.where(extra)
        _begin(db)
        total += db.execute(stmt).rowcount or 0
        db.commit()
    return total


def cleanup(db: Session, *, apply: bool = False) -> dict:
    """Remove exactly the rows this module created (dry run unless ``apply``); refuse if real rows depend on them."""
    from app.models import Base

    t = Base.metadata.tables
    ids = {name: _ids(db, name) for name in SELECTORS}
    blockers = _blockers(db, ids)
    inc, sr, pk, binz = ids["incidents"], ids["service_requests"], ids["recycling_pickups"], ids["smart_bins"]
    act = t["activity_log"]
    ntf = t["notifications"]
    ntf_ids = list(ids["notifications"])
    for prefix in ("incident:INC-DEMOL-", "pickup:RCY-DEMOL-"):
        ntf_ids += db.execute(select(ntf.c.id).where(ntf.c.event_key.like(prefix + "%"))).scalars().all()
    ntf_ids = sorted(set(ntf_ids))
    wo_ids = ids["work_orders"]
    activity_filter = or_(
        (act.c.entity_type == "incident") & act.c.entity_id.in_(inc or [""]),
        (act.c.entity_type == "service_request") & act.c.entity_id.in_(sr or [""]),
        (act.c.entity_type == "recycling_pickup") & act.c.entity_id.in_(pk or [""]),
        (act.c.entity_type == "work_order") & act.c.entity_id.in_(wo_ids or [""]),
    )
    counts = {name: len(values) for name, values in ids.items()}
    counts["notifications"] = len(ntf_ids)
    counts["activity_log"] = db.execute(select(func.count()).select_from(act).where(activity_filter)).scalar_one()
    counts["incident_followers"] = (
        db.query(IncidentFollower).filter(IncidentFollower.incident_id.like("INC-DEMOL-%")).count()
    )
    counts["bin_readings"] = db.query(BinReading).filter(BinReading.bin_id.in_(binz or [""])).count()
    counts["bin_reports"] = db.query(BinReport).filter(BinReport.bin_id.in_(binz or [""])).count()
    result = {"mode": "cleanup-apply" if apply else "cleanup-dry-run", "counts": dict(sorted(counts.items())),
              "blockers": blockers}  # fmt: skip
    if blockers:
        result["refused"] = True
        return result
    if not apply:
        return result
    deleted: dict[str, int] = {}
    steps = [
        ("push_deliveries", t["push_deliveries"], t["push_deliveries"].c.notification_id, ntf_ids),
        ("notifications", ntf, ntf.c.id, ntf_ids),
        ("ai_suggestions", t["ai_suggestions"], t["ai_suggestions"].c.id, ids["ai_suggestions"]),
        ("bin_reports", t["bin_reports"], t["bin_reports"].c.bin_id, binz),
        ("incident_followers", t["incident_followers"], t["incident_followers"].c.incident_id, inc),
        ("reports", t["reports"], t["reports"].c.id, ids["reports"]),
    ]
    for name, table, column, values in steps:
        deleted[name] = _delete_in(db, table, column, values)
    # activity rows are matched per entity type so a real row with a colliding id is never touched
    for entity_type, values in (
        ("incident", inc),
        ("service_request", sr),
        ("recycling_pickup", pk),
        ("work_order", wo_ids),
    ):
        deleted["activity_log"] = deleted.get("activity_log", 0) + _delete_in(
            db, act, act.c.entity_id, values, act.c.entity_type == entity_type
        )
    for name in ("work_orders", "incidents", "service_requests", "recycling_weighings", "recycling_pickups",
                 "collectors"):  # fmt: skip
        deleted[name] = _delete_in(db, t[name], t[name].c.id, ids[name])
    deleted["bin_readings"] = _delete_in(db, t["bin_readings"], t["bin_readings"].c.bin_id, binz)
    deleted["smart_bins"] = _delete_in(db, t["smart_bins"], t["smart_bins"].c.id, binz)
    deleted["profiles"] = _delete_in(db, t["profiles"], t["profiles"].c.id, ids["profiles"])
    result["deleted"] = deleted
    return result


# --------------------------------------------------------------------------- local hook
def seed_large_local(db: Session) -> dict:
    """SQLite only: add the large set on top of the local fixture, linked to the demo citizen and collector."""
    if db.get_bind().dialect.name != "sqlite":
        raise RuntimeError("seed_large_local is for disposable SQLite databases only")
    opts = LargeOptions(
        link_demo_citizen="citizen-001" if db.get(Profile, "citizen-001") else None,
        link_demo_collector="COL-1" if db.get(Collector, "COL-1") else None,
        open_pickups=True,
        local_prices=True,
        notifications=True,
    )
    return apply(db, opts)


__all__ = [
    "DEFAULT_SEED",
    "MARK",
    "DemoSeedError",
    "LargeOptions",
    "Reference",
    "Unit",
    "apply",
    "build_dataset",
    "cleanup",
    "load_reference",
    "plan",
    "seed_large_local",
]
