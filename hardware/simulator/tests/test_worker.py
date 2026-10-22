import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]))
import tempfile, threading, time, unittest
from model import Policy, Sensors
from store import DeviceStore
from engine import Simulator
from helpers import FakeClock
from run import Worker

class BlockingTransport:
    def __init__(self): self.entered=threading.Event(); self.cancelled=threading.Event()
    def send(self, rows):
        self.entered.set()
        if not self.cancelled.wait(4): raise TimeoutError('test transport timed out')
        raise OSError('cancelled')
    def cancel(self): self.cancelled.set()

class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','http://local')); self.clock=FakeClock()
    def tearDown(self):
        try:self.store.close()
        except Exception:pass
        self.tmp.cleanup()

    def test_worker_survives_operation_and_event_log_write_failure_then_recovers(self):
        sim=Simulator(self.store,BlockingTransport(),self.clock); sim.start(); sim.set_network(False)
        self.store.db.execute('PRAGMA query_only=ON')
        worker=Worker(sim,interval=.01); worker.start(); self.clock.advance(1800); worker.wake()
        deadline=time.monotonic()+2
        while sim.snapshot().get('worker_error') is None and time.monotonic()<deadline: threading.Event().wait(.01)
        self.assertTrue(worker.thread.is_alive()); self.assertIsNotNone(sim.snapshot().get('worker_error'))
        before=self.store.load_state()['next_seq']; self.store.db.execute('PRAGMA query_only=OFF'); worker.wake()
        deadline=time.monotonic()+2
        while (self.store.load_state()['next_seq']==before or sim.snapshot().get('worker_error') is not None) and time.monotonic()<deadline: threading.Event().wait(.01)
        self.assertGreater(self.store.load_state()['next_seq'],before); self.assertTrue(worker.thread.is_alive()); self.assertIsNone(sim.snapshot().get('worker_error'))
        worker.stop()

    def test_stop_cancels_transport_and_joins_before_store_close(self):
        transport=BlockingTransport(); sim=Simulator(self.store,transport,self.clock); sim.start(); worker=Worker(sim,interval=.01); worker.start()
        self.assertTrue(transport.entered.wait(2))
        close_called=[]; original_close=self.store.close
        def close():
            self.assertFalse(worker.thread.is_alive()); close_called.append(True); original_close()
        self.store.close=close
        worker.stop(); self.store.close()
        self.assertEqual(close_called,[True]); self.assertFalse(worker.thread.is_alive())
