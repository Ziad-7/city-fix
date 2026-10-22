import json
from datetime import datetime, timezone
from http.client import HTTPConnection
from pathlib import Path
import sys
import tempfile
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from receiver import build_receiver
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class ReceiverAdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store, self.receiver, self.server = build_receiver(
            key="disposable-test-key", bin_id="bin-sim-001", data_dir=Path(self.temp.name), port=0
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(2)
        self.store.close(); self.temp.cleanup()

    def post(self, body, bin_id="bin-sim-001", key="disposable-test-key"):
        request = Request(
            f"{self.origin}/iot/bins/{bin_id}/readings",
            data=json.dumps(body).encode(), method="POST",
            headers={"Content-Type": "application/json", "X-Device-Key": key},
        )
        try:
            with urlopen(request, timeout=2) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, json.loads(error.read())

    def test_requires_runtime_key_and_valid_bin_configuration(self):
        for args in (
            {"key": "", "bin_id": "BIN", "data_dir": Path(self.temp.name), "port": 8776},
            {"key": "key", "bin_id": "../bad", "data_dir": Path(self.temp.name), "port": 8776},
            {"key": "key", "bin_id": "BIN", "data_dir": Path(self.temp.name), "port": 70000},
        ):
            with self.assertRaises(ValueError): build_receiver(**args)

    def test_loopback_socket_accepts_optional_bin_fields_and_deduplicates_retry(self):
        payload = {"readings": [{"seq": 1, "at": None, "fillPct": 80, "tempC": 61, "batteryV": 3.7, "fw": "sim-0.1.0"}]}
        self.assertEqual(self.post(payload), (202, {"accepted": [1], "intervalMin": 30, "fullPct": 80, "heatC": 60}))
        self.assertEqual(self.post(payload)[0], 202)
        state = self.receiver.snapshot()
        self.assertEqual(state["count"], 1)
        self.assertEqual(state["latest"]["seq"], 1)
        self.assertTrue(state["latest"]["full"]); self.assertTrue(state["latest"]["heat"])

    def test_missing_measurements_remain_unavailable_and_wrong_auth_is_rejected(self):
        status, _ = self.post({"readings": [{"seq": 1, "at": None, "fillPct": 12}]}, key="wrong")
        self.assertEqual(status, 401)
        status, ack = self.post({"readings": [{"seq": 1, "at": None, "fillPct": 12}]})
        self.assertEqual(status, 202); self.assertEqual(ack["accepted"], [1])
        latest = self.receiver.snapshot()["latest"]
        self.assertNotIn("tempC", latest); self.assertFalse(latest["heat"])

    def test_conflict_and_invalid_or_oversized_request_do_not_partially_store(self):
        self.assertEqual(self.post({"readings": [{"seq": 1, "at": None, "fillPct": 50}]})[0], 202)
        status, _ = self.post({"readings": [{"seq": 2, "at": None, "fillPct": 30}, {"seq": 1, "at": None, "fillPct": 60}]})
        self.assertEqual(status, 409); self.assertEqual(self.receiver.snapshot()["count"], 1)
        status, _ = self.post({"readings": [{"seq": 2, "at": None, "fillPct": 101}]})
        self.assertEqual(status, 400); self.assertEqual(self.receiver.snapshot()["count"], 1)
        conn = HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        conn.request("POST", "/iot/bins/bin-sim-001/readings", body=b"x" * 65537,
                     headers={"Content-Type": "application/json", "X-Device-Key": "disposable-test-key"})
        response = conn.getresponse(); self.assertEqual(response.status, 413); response.read(); conn.close()
        self.assertEqual(self.receiver.snapshot()["count"], 1)

    def test_unsupported_method_returns_bounded_json_without_reflecting_key(self):
        conn = HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        conn.request("BREW", "/iot/bins/bin-sim-001/readings")
        response = conn.getresponse(); body = response.read(); conn.close()
        self.assertEqual(response.status, 405)
        self.assertEqual(response.getheader("Content-Type"), "application/json")
        payload = json.loads(body)
        self.assertEqual(payload, {"detail": "method not allowed"})
        self.assertNotIn(b"disposable-test-key", body)


if __name__ == "__main__": unittest.main()
