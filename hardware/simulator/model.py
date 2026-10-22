"""Shared simulator value objects and provisional wire validation."""
from dataclasses import dataclass
from datetime import datetime, timezone
import math
import time
from typing import Any


class Clock:
    def monotonic(self) -> float: raise NotImplementedError
    def utc_now(self) -> datetime: raise NotImplementedError


class SystemClock(Clock):
    def monotonic(self) -> float: return time.monotonic()
    def utc_now(self) -> datetime: return datetime.now(timezone.utc)


@dataclass(frozen=True)
class Policy:
    interval_min: float = 30
    full_pct: float = 80
    heat_c: float = 60

    def __post_init__(self):
        if not finite(self.interval_min) or not 0 < self.interval_min <= 1440: raise ValueError("invalid intervalMin")
        if not finite(self.full_pct) or not 0 <= self.full_pct <= 100: raise ValueError("invalid fullPct")
        if not finite(self.heat_c) or not -40 <= self.heat_c <= 125: raise ValueError("invalid heatC")


@dataclass(frozen=True)
class Sensors:
    fill_pct: float = 20
    temp_c: float = 25
    battery_v: float = 3.9

    def __post_init__(self):
        for v, lo, hi, label in ((self.fill_pct, 0, 100, "fillPct"), (self.temp_c, -40, 125, "tempC"), (self.battery_v, 0, 6, "batteryV")):
            if not finite(v) or not lo <= v <= hi: raise ValueError(f"invalid {label}")


def finite(value): return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_reading(reading: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(reading, dict): raise ValueError("reading must be an object")
    required = {"seq", "at", "fillPct"}
    allowed = required | {"distanceCm", "tempC", "batteryV", "rssi", "fw"}
    if not required <= reading.keys() or not reading.keys() <= allowed: raise ValueError("invalid reading fields")
    seq = reading["seq"]
    if not isinstance(seq, int) or isinstance(seq, bool) or not 1 <= seq <= 9007199254740991: raise ValueError("invalid seq")
    ranges = {"fillPct": (0,100), "distanceCm": (0,200), "tempC": (-40,125), "batteryV": (0,6)}
    for key, (lo, hi) in ranges.items():
        if key in reading and (not finite(reading[key]) or not lo <= reading[key] <= hi): raise ValueError(f"invalid {key}")
    if "rssi" in reading and (not isinstance(reading["rssi"], int) or isinstance(reading["rssi"], bool) or not -127 <= reading["rssi"] <= 0): raise ValueError("invalid rssi")
    if "fw" in reading and (not isinstance(reading["fw"], str) or not reading["fw"] or len(reading["fw"]) > 40): raise ValueError("invalid fw")
    at = reading["at"]
    if at is not None:
        if not isinstance(at, str): raise ValueError("invalid at")
        try:
            parsed = datetime.fromisoformat(at.replace("Z", "+00:00"))
            if parsed.tzinfo is None: raise ValueError()
        except ValueError as exc: raise ValueError("invalid at") from exc
    return dict(reading)
