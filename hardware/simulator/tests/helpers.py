from datetime import datetime, timezone

from model import Policy, Sensors


class FakeClock:
    def __init__(self):
        self.now = 0.0
        self.utc = datetime(2026, 10, 22, tzinfo=timezone.utc)

    def monotonic(self):
        return self.now

    def utc_now(self):
        return self.utc

    def advance(self, seconds: float):
        from datetime import timedelta
        self.now += seconds
        self.utc += timedelta(seconds=seconds)


def reading(seq, **extra):
    result = {"seq": seq, "at": "2026-10-22T00:00:00Z", "fillPct": 20}
    result.update(extra)
    return result


def append(store, fill=20, temp=25, flags=(False, False)):
    return store.append({"at": "2026-10-22T00:00:00Z", "fillPct": fill, "tempC": temp,
                         "distanceCm": 100 - .95 * fill, "batteryV": 3.9, "rssi": -85,
                         "fw": "sim-0.1.0"}, Sensors(fill, temp, 3.9), flags)
