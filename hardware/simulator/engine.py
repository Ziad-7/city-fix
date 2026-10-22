"""Single-worker simulator sampling, threshold, and retry state machine."""
from collections import deque
import threading
from datetime import timezone

try:
    from .model import Policy, Sensors
except ImportError:
    from model import Policy, Sensors


class Simulator:
    def __init__(self, store, transport, clock):
        self.store, self.transport, self.clock = store, transport, clock
        state = store.load_state()
        self.sensors = state['sensors']
        self.flags = state['flags']
        self.policy = state['policy']
        self.online = state['online']
        self.record_lock = threading.Lock()
        self.tick_lock = threading.Lock()
        self.control_lock = threading.Lock()
        self.auto_fill = False
        self.next_sample = clock.monotonic() + self.policy.interval_min * 60
        self.next_auto = clock.monotonic() + 5
        self.retry_failures = 0
        self.retry_at = None
        self.force = False
        self.send_now = False
        self.started = False
        self.lock = threading.RLock()
        self.worker_healthy = True
        self.worker_error = None
        self.runtime_events = deque(maxlen=10)

    def start(self):
        if self.started:
            return
        self.started = True
        self.record(self.sensors)
        if self.online:
            self.request_send()

    def record(self, sensors: Sensors, at="__clock__"):
        if not isinstance(sensors, Sensors):
            raise ValueError("invalid sensors")
        with self.record_lock:
            with self.lock:
                old_flags, policy = self.flags, self.policy
            flags = (sensors.fill_pct >= policy.full_pct, sensors.temp_c >= policy.heat_c)
            edge = any(not previous and current for previous, current in zip(old_flags, flags))
            timestamp = self.clock.utc_now().astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if at == "__clock__" else at
            wire = {
                "at": timestamp,
                "fillPct": sensors.fill_pct,
                "distanceCm": round(100 - .95 * sensors.fill_pct, 2),
                "tempC": sensors.temp_c,
                "batteryV": sensors.battery_v,
                "rssi": -85,
                "fw": "sim-0.1.0",
            }
            # The durable append completes before publishing the sample in memory.
            seq = self.store.append(wire, sensors, flags)
            with self.lock:
                self.sensors = sensors
                self.flags = flags
                if edge and self.online and self.retry_at is None:
                    self.force = True
            return seq

    def set_network(self, online: bool):
        # Serialize persistence and publication without holding the state lock over SQLite I/O.
        with self.control_lock:
            self.store.set_network(online)
            with self.lock:
                self.online = online
                if online:
                    self.retry_at = None
                    self.force = True

    def set_auto_fill(self, enabled: bool):
        if not isinstance(enabled, bool):
            raise ValueError("enabled must be boolean")
        with self.lock:
            self.auto_fill = enabled
            self.next_auto = self.clock.monotonic() + 5

    def request_send(self):
        with self.lock:
            self.force = True
            self.send_now = True

    def _retry_delay(self):
        return max(60, min(60 * (2 ** max(self.retry_failures - 1, 0)), 960))

    def tick(self):
        if not self.tick_lock.acquire(blocking=False):
            return
        try:
            now = self.clock.monotonic()
            sample = None
            periodic_due = False
            with self.lock:
                interval = self.policy.interval_min * 60
                if now >= self.next_sample:
                    periodic_due = True
                    # Keep the sampling clock independent of manual and auto-fill readings.
                    missed = int((now - self.next_sample) // interval) + 1
                    sample = self.sensors
                if self.auto_fill and now >= self.next_auto:
                    if self.sensors.fill_pct < 100:
                        sample = Sensors(min(100, self.sensors.fill_pct + 5), self.sensors.temp_c, self.sensors.battery_v)
                    self.next_auto = now + 5
            if sample is not None:
                self.record(sample)
            if periodic_due:
                with self.lock:
                    interval = self.policy.interval_min * 60
                    self.next_sample += missed * interval
            if periodic_due:
                with self.lock:
                    if self.online:
                        self.force = True
            with self.lock:
                if not self.online:
                    return
                due = self.send_now or (self.retry_at is not None and now >= self.retry_at) or (self.retry_at is None and self.force)
                if self.retry_at is not None and now < self.retry_at and not self.send_now:
                    due = False
            batch = self.store.pending(50)
            if not batch or not due:
                return
            with self.lock:
                self.force = False
                self.send_now = False
                self.retry_at = None
            sent = [reading['seq'] for reading in batch]
            try:
                accepted, policy = self.transport.send(batch)
                if not isinstance(accepted, list) or len(set(accepted)) != len(accepted) or any(type(seq) is not int for seq in accepted) or not set(accepted) <= set(sent):
                    raise ValueError("invalid acknowledgement")
                if not isinstance(policy, Policy):
                    raise ValueError("invalid policy")
                old_policy = self.policy
                self.store.apply_ack(sent, accepted, policy)
                remaining = self.store.snapshot()["pending_count"] > 0
                with self.lock:
                    if policy.interval_min != old_policy.interval_min:
                        self.next_sample = self.clock.monotonic() + policy.interval_min * 60
                    self.policy = policy
                    if accepted:
                        self.retry_failures = 0
                        self.retry_at = None
                        self.force = remaining
                    else:
                        # A valid empty ACK is not delivery progress: retain failure history.
                        self.retry_at = self.clock.monotonic() + self._retry_delay()
            except Exception as exc:
                message = getattr(exc, "safe_message", "Delivery failed")
                with self.lock:
                    self.retry_failures = min(self.retry_failures + 1, 5)
                    self.retry_at = self.clock.monotonic() + self._retry_delay()
                self.store.add_event("error", message)
        finally:
            self.tick_lock.release()

    def report_error(self, message):
        # Never let durable logging failure escape the worker's recovery path.
        safe_message = "A local simulator operation failed; check the device database and data directory."
        try:
            self.store.add_event("error", safe_message)
        except Exception:
            with self.lock:
                self.runtime_events.append({"type": "error", "message": safe_message})
        with self.lock:
            self.worker_healthy = False
            self.worker_error = safe_message

    def worker_recovered(self):
        with self.lock:
            was_faulted = not self.worker_healthy
        if was_faulted:
            try:
                self.store.add_event("ack", "Local simulator operations resumed")
            except Exception:
                return
        with self.lock:
            self.worker_healthy = True
            self.worker_error = None
            self.runtime_events.clear()

    def snapshot(self):
        with self.control_lock:
            with self.lock:
                sensors, flags, policy = self.sensors, self.flags, self.policy
                online, auto = self.online, self.auto_fill
                retry = max(0, self.retry_at - self.clock.monotonic()) if self.retry_at is not None else None
                healthy, worker_error = self.worker_healthy, self.worker_error
                runtime_events = list(self.runtime_events)
        state = self.store.snapshot()
        events = state["events"] + runtime_events
        return {
            "sensors": sensors,
            "flags": flags,
            "policy": policy,
            "online": online,
            "auto_fill": auto,
            "pending_count": state["pending_count"],
            "ack_count": state["ack_count"],
            "outbox": state["outbox"],
            "events": events[-30:],
            "retry_in": retry,
            "interval_seconds": policy.interval_min * 60,
            "worker_healthy": healthy,
            "worker_error": worker_error,
        }
