#!/usr/bin/env python3
"""Optional loopback-only HTTP receiver for the Wokwi smart-bin sketch."""
from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path
import re
import sys
import threading

SIMULATOR = Path(__file__).resolve().parents[1] / "simulator"
sys.path.insert(0, str(SIMULATOR))

from mock_server import MockReceiver, make_mock_server  # noqa: E402
from store import ReceiverStore  # noqa: E402

DEFAULT_BIN_ID = "bin-sim-001"
DEFAULT_PORT = 8776


def build_receiver(*, key: str, bin_id: str, data_dir: Path, port: int):
    if not isinstance(key, str) or not key or len(key) > 512 or any(ord(c) < 32 or ord(c) == 127 for c in key):
        raise ValueError("CITYFIX_DEVICE_KEY must be set to a safe runtime-only key")
    if not isinstance(bin_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", bin_id):
        raise ValueError("CITYFIX_BIN_ID must contain 1-64 letters, digits, _ or -")
    if type(port) is not int or not 0 <= port <= 65535:
        raise ValueError("CITYFIX_RECEIVER_PORT must be between 1 and 65535")
    store = ReceiverStore(Path(data_dir) / "receiver.sqlite3")
    receiver = MockReceiver(store, bin_id, key, type("SystemClock", (), {"utc_now": staticmethod(lambda: datetime.now(timezone.utc))})())
    try:
        server = make_mock_server(receiver, port)
    except Exception:
        store.close()
        raise
    class AdapterHandler(server.RequestHandlerClass):
        def method_not_allowed(self):
            self.reply(405, {"detail": "method not allowed"})
        def __getattr__(self, name):
            if name.startswith("do_"):
                return self.method_not_allowed
            raise AttributeError(name)
        do_GET = method_not_allowed
        do_HEAD = method_not_allowed
        do_PUT = method_not_allowed
        do_DELETE = method_not_allowed
        do_PATCH = method_not_allowed
        do_OPTIONS = method_not_allowed
        do_TRACE = method_not_allowed
    server.RequestHandlerClass = AdapterHandler
    return store, receiver, server


def summary_loop(receiver: MockReceiver, stop: threading.Event) -> None:
    last_key = None
    while not stop.wait(1.0):
        try:
            state = receiver.snapshot()
            latest = state["latest"]
            key = (state["count"], latest["seq"] if latest else None)
            if key == last_key:
                continue
            last_key = key
            if latest is None:
                print("Receiver ready | no confirmed readings", flush=True)
                continue
            temp = "unavailable" if latest.get("tempC") is None else f"{latest['tempC']:.1f} C"
            print(
                "Receiver confirmed | "
                f"unique readings={state['count']} seq={latest['seq']} "
                f"fill={latest['fillPct']:.0f}% temp={temp} "
                f"full={'YES' if latest['full'] else 'no'} heat={'YES' if latest['heat'] else 'no'}",
                flush=True,
            )
        except Exception:
            print("Receiver summary temporarily unavailable", flush=True)


def main() -> int:
    key = os.environ.get("CITYFIX_DEVICE_KEY", "")
    bin_id = os.environ.get("CITYFIX_BIN_ID", DEFAULT_BIN_ID)
    port_text = os.environ.get("CITYFIX_RECEIVER_PORT", str(DEFAULT_PORT))
    data_dir = Path(os.environ.get("CITYFIX_RECEIVER_DATA", Path(__file__).parent / ".data"))
    try:
        port = int(port_text)
        if port == 0:
            raise ValueError("CITYFIX_RECEIVER_PORT must be between 1 and 65535")
        store, receiver, server = build_receiver(key=key, bin_id=bin_id, data_dir=data_dir, port=port)
    except (ValueError, OSError) as exc:
        print(f"Receiver startup failed: {exc}", file=sys.stderr)
        return 2

    print(f"Wokwi bin receiver listening only on http://127.0.0.1:{server.server_port}", flush=True)
    print(f"Bin ID: {bin_id}; key: configured but hidden; data: {store.path}", flush=True)
    print("Route: POST /iot/bins/{binId}/readings. No dashboard, control API, files, or scale endpoint.", flush=True)
    print("For external Wokwi Gateway access, expose only this port with the optional tunnel described in README.", flush=True)
    stop = threading.Event()
    summary = threading.Thread(target=summary_loop, args=(receiver, stop), name="receiver-summary", daemon=True)
    summary.start()
    serve = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.2}, name="wokwi-receiver", daemon=False)
    serve.start()
    try:
        while serve.is_alive():
            serve.join(timeout=0.5)
    except KeyboardInterrupt:
        print("Stopping loopback receiver", flush=True)
    finally:
        stop.set()
        server.shutdown()
        server.server_close()
        serve.join()
        summary.join(timeout=2)
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
