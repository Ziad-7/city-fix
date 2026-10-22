import sys
from pathlib import Path as _Path
sys.path.insert(0, str(_Path(__file__).parents[1]))
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone

from model import Policy, Sensors
from store import DeviceStore, ReceiverStore, StoreError
from helpers import append, reading


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "device.sqlite3"
        self.identity = ("BIN-SIM-001", "mock", "http://127.0.0.1:8766")
        self.store = DeviceStore(self.path, self.identity)

    def tearDown(self):
        self.store.close(); self.tmp.cleanup()

    def test_sequence_and_payload_survive_restart(self):
        append(self.store, 44)
        expected = self.store.pending()
        self.store.close(); self.store = DeviceStore(self.path, self.identity)
        self.assertEqual(self.store.pending(), expected)
        self.assertEqual(self.store.load_state()["next_seq"], 2)

    def test_acknowledged_sequence_is_not_reused(self):
        append(self.store); self.store.apply_ack([1], [1], Policy())
        self.assertEqual(append(self.store), 2)

    def test_offline_alert_survives_later_normal_sample_and_restart(self):
        append(self.store, 80, 61, (True, True)); append(self.store, 20, 25)
        self.store.close(); self.store = DeviceStore(self.path, self.identity)
        self.assertEqual(self.store.load_state()["flags"], (False, False))
        self.assertEqual([x["seq"] for x in self.store.pending()], [1, 2])
        self.assertEqual(next(x for x in self.store.snapshot()["outbox"] if x["seq"] == 1)["flags"], (True, True))

    def test_network_flag_defaults_online_and_persists_offline(self):
        self.assertTrue(self.store.load_state()["online"])
        self.store.set_network(False); self.store.close(); self.store = DeviceStore(self.path, self.identity)
        self.assertFalse(self.store.load_state()["online"])

    def test_append_failure_rolls_back_sequence_and_flags(self):
        with self.assertRaises(Exception): self.store.append({"at": "bad", "fillPct": float("nan")}, Sensors(90, 25, 3.9), (True, False))
        self.assertEqual(self.store.load_state()["next_seq"], 1)
        self.assertEqual(self.store.load_state()["flags"], (False, False))

    def test_identity_mismatch_refused(self):
        self.store.close()
        with self.assertRaises(StoreError): DeviceStore(self.path, ("OTHER", "mock", self.identity[2]))

    def test_partial_ack_and_unknown_sequence_are_atomic(self):
        append(self.store); append(self.store)
        with self.assertRaises(StoreError): self.store.apply_ack([1, 2], [1, 99], Policy(2, 50, 40))
        self.assertEqual([x["seq"] for x in self.store.pending()], [1, 2])
        self.assertEqual(self.store.load_state()["policy"], Policy())
        self.store.apply_ack([1, 2], [1], Policy(2, 50, 40))
        self.assertEqual([x["seq"] for x in self.store.pending()], [2])

    def test_receiver_idempotency_survives_restart(self):
        path = Path(self.tmp.name) / "receiver.sqlite3"
        r = ReceiverStore(path); self.assertEqual(r.accept("BIN", [reading(1)], datetime.now(timezone.utc)), [1]); r.close()
        r = ReceiverStore(path); self.assertEqual(r.accept("BIN", [reading(1)], datetime.now(timezone.utc)), [1]); self.assertEqual(r.snapshot("BIN", Policy())["count"], 1); r.close()

    def test_receiver_conflict_rolls_back_whole_batch(self):
        r = ReceiverStore(Path(self.tmp.name) / "r.sqlite3")
        r.accept("BIN", [reading(1)], datetime.now(timezone.utc))
        with self.assertRaises(StoreError): r.accept("BIN", [reading(2), reading(1, fillPct=90)], datetime.now(timezone.utc))
        self.assertEqual(r.snapshot("BIN", Policy())["count"], 1); r.close()

    def test_latest_does_not_regress_on_old_retry(self):
        r = ReceiverStore(Path(self.tmp.name) / "r.sqlite3")
        r.accept("BIN", [reading(3, fillPct=30)], datetime.now(timezone.utc)); r.accept("BIN", [reading(1, fillPct=10)], datetime.now(timezone.utc))
        self.assertEqual(r.snapshot("BIN", Policy())["latest"]["seq"], 3); r.close()

    def test_recent_events_survive_restart(self):
        self.store.add_event("error", "Delivery failed (503)")
        self.store.close(); self.store=DeviceStore(self.path,self.identity)
        self.assertEqual(self.store.snapshot()["events"][0],{"type":"error","message":"Delivery failed (503)"})

    def test_priority_batch_contains_alert_after_50_normal_rows(self):
        for _ in range(55): append(self.store)
        append(self.store, 90, 25, (True, False))
        batch = self.store.pending()
        self.assertEqual(len(batch), 50); self.assertEqual(batch[0]["seq"], 56)
