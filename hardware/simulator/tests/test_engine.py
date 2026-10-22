import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
import tempfile
import unittest
from model import Policy, Sensors
from store import DeviceStore
from engine import Simulator
from helpers import FakeClock

class Transport:
    def __init__(self, results=None): self.calls=[]; self.results=list(results or [])
    def send(self, readings):
        self.calls.append([dict(x) for x in readings])
        if self.results:
            value=self.results.pop(0)
            if isinstance(value, Exception): raise value
            return value
        return [r['seq'] for r in readings], Policy()

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','http://local'))
        self.clock=FakeClock(); self.transport=Transport(); self.sim=Simulator(self.store,self.transport,self.clock); self.sim.start(); self.sim.tick(); self.transport.calls.clear()
    def tearDown(self): self.store.close(); self.tmp.cleanup()
    def test_edges_at_equality_rearm_and_no_repeat(self):
        self.transport.calls.clear()
        for fill,temp in [(79,59),(80,59),(81,59),(79,59),(80,60)]: self.sim.record(Sensors(fill,temp,3.9)); self.sim.tick()
        self.assertEqual(len(self.transport.calls),2)
        self.assertIn(80,[r['fillPct'] for r in self.transport.calls[-1]])
    def test_retry_deadlines_are_60_120_240_480_960_seconds(self):
        self.transport.results=[RuntimeError('x')]*5
        self.sim.record(Sensors(30,25,3.9)); self.sim.request_send()
        self.sim.tick(); delays=[self.sim.snapshot()['retry_in']]
        for seconds in (60,120,240,480):
            self.clock.advance(seconds); self.sim.tick(); delays.append(self.sim.snapshot()['retry_in'])
        self.assertEqual(delays,[60,120,240,480,960])
    def test_crossing_during_backoff_retained_until_due(self):
        self.transport.results=[RuntimeError('x'),None]
        self.sim.record(Sensors(30,25,3.9)); self.sim.request_send(); self.sim.tick(); n=len(self.transport.calls); self.sim.record(Sensors(90,25,3.9)); self.sim.tick()
        self.assertEqual(len(self.transport.calls),n); self.assertTrue(any(x['fillPct']==90 for x in self.store.pending()))
    def test_periodic_samples_continue_offline(self):
        self.sim.set_network(False); n=len(self.store.pending()); self.clock.advance(1800); self.sim.tick(); self.assertGreater(len(self.store.pending()),n)
    def test_offline_restart_sends_nothing_until_restore(self):
        self.sim.set_network(False); self.store.close(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','http://local'))
        t=Transport(); sim=Simulator(self.store,t,self.clock); sim.start(); self.assertEqual(t.calls,[]); sim.set_network(True); sim.tick(); self.assertTrue(t.calls)
    def test_network_restore_and_manual_send_wake_delivery(self):
        self.sim.set_network(False); self.transport.calls.clear(); self.sim.record(Sensors(35,25,3.9)); self.sim.request_send(); self.assertEqual(self.transport.calls,[]); self.sim.set_network(True); self.sim.tick(); self.assertTrue(self.transport.calls)
    def test_offline_send_now_does_not_send(self):
        self.sim.set_network(False); self.transport.calls.clear(); self.sim.record(Sensors(40,25,3.9)); self.sim.request_send(); self.sim.tick(); self.assertFalse(self.transport.calls)
    def test_partial_ack_retains_remainder(self):
        self.sim.record(Sensors(21,25,3.9)); self.sim.record(Sensors(22,25,3.9)); self.transport.results=[([2],Policy()),([3],Policy())]; self.sim.request_send(); self.sim.tick(); self.assertEqual([x['seq'] for x in self.store.pending()],[3]); self.sim.tick(); self.assertEqual(self.store.pending(),[])
    def test_foreign_duplicate_boolean_or_malformed_ack_keeps_all_rows_and_old_policy(self):
        self.sim.record(Sensors(30,25,3.9))
        for ack in ([999],[2,2],[True],None):
            count=len(self.store.pending()); self.transport.results=[(ack,Policy(1,50,40))]; self.sim.request_send(); self.sim.tick()
            self.assertEqual(len(self.store.pending()),count); self.assertEqual(self.store.load_state()['policy'],Policy())
    def test_empty_ack_waits_without_spin(self):
        self.transport.results=[([],Policy())]; self.sim.record(Sensors(30,25,3.9)); self.sim.request_send(); self.sim.tick(); count=len(self.transport.calls); self.sim.tick(); self.assertEqual(len(self.transport.calls),count); self.assertEqual(self.sim.snapshot()['retry_in'],60)
    def test_restart_preserves_alert_flags_and_policy(self):
        self.sim.record(Sensors(30,25,3.9)); self.transport.results=[([],Policy(2,50,45))]; self.sim.request_send(); self.sim.tick()
        self.sim.record(Sensors(80,25,3.9)); self.store.close(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','http://local'))
        self.assertEqual(self.store.load_state()['flags'],(True,False)); self.assertEqual(self.store.load_state()['policy'],Policy(2,50,45))
    def test_changed_server_policy_changes_next_sample_threshold_and_interval(self):
        self.transport.results=[([],Policy(1,50,45))]; self.sim.record(Sensors(30,25,3.9)); self.sim.request_send(); self.sim.tick(); self.sim.record(Sensors(55,46,3.9)); self.assertEqual(self.sim.snapshot()['flags'],(True,True)); self.assertEqual(self.sim.snapshot()['interval_seconds'],60)

    def test_changed_interval_reschedules_periodic_delivery_from_policy_response(self):
        seq=self.sim.record(Sensors(30,25,3.9))
        self.transport.results=[([seq],Policy(1,80,60))]
        self.sim.request_send(); self.sim.tick()
        calls=len(self.transport.calls)
        self.clock.advance(59); self.sim.tick(); self.assertEqual(len(self.transport.calls),calls)
        self.clock.advance(1); self.sim.tick(); self.assertEqual(len(self.transport.calls),calls+1)
    def test_auto_fill_steps_and_caps(self):
        self.sim.set_auto_fill(True); before=self.store.load_state()['next_seq']; self.clock.advance(5); self.sim.tick(); self.assertEqual(self.sim.snapshot()['sensors'].fill_pct,25); self.sim.record(Sensors(100,25,3.9)); self.clock.advance(5); self.sim.tick(); self.assertEqual(self.sim.snapshot()['sensors'].fill_pct,100); seq=self.store.load_state()['next_seq']; self.clock.advance(5); self.sim.tick(); self.assertEqual(self.store.load_state()['next_seq'],seq)
    def test_normal_samples_deliver_on_each_periodic_interval(self):
        self.clock.advance(1800); self.sim.tick()
        self.assertEqual(self.store.pending(),[])
        self.assertEqual(len(self.transport.calls),1)
        self.clock.advance(1800); self.sim.tick()
        self.assertEqual(self.store.pending(),[])
        self.assertEqual(len(self.transport.calls),2)

    def test_manual_normal_sample_waits_for_next_periodic_delivery(self):
        self.clock.advance(1790); self.sim.record(Sensors(35,25,3.9)); self.sim.tick()
        self.assertEqual(len(self.transport.calls),0)
        self.clock.advance(10); self.sim.tick()
        self.assertEqual(len(self.transport.calls),1); self.assertEqual(self.store.pending(),[])

    def test_periodic_sample_during_backoff_does_not_bypass_retry(self):
        self.transport.results=[([],Policy(.1,80,60)),RuntimeError('network')]
        self.sim.record(Sensors(30,25,3.9)); self.sim.request_send(); self.sim.tick()
        calls=len(self.transport.calls); self.clock.advance(6); self.sim.tick()
        self.assertEqual(len(self.transport.calls),calls)
        self.assertEqual(self.sim.snapshot()['retry_in'],54)
        self.assertGreaterEqual(self.store.snapshot()['pending_count'],2)

    def test_empty_ack_preserves_accumulated_retry_backoff(self):
        self.sim.record(Sensors(30,25,3.9)); self.transport.results=[RuntimeError('x')]*4+[([],Policy()),RuntimeError('x')]
        self.sim.request_send(); self.sim.tick()
        for delay in (60,120,240): self.clock.advance(delay); self.sim.tick()
        self.assertEqual(self.sim.snapshot()['retry_in'],480)
        self.clock.advance(480); self.sim.tick()
        self.assertEqual(self.sim.snapshot()['retry_in'],480)
        self.clock.advance(480); self.sim.tick()
        self.assertEqual(self.sim.snapshot()['retry_in'],960)

    def test_network_control_persistence_and_publication_are_serialized(self):
        import threading
        false_persisted=threading.Event(); release_false=threading.Event(); true_started=threading.Event()
        original=self.store.set_network
        def wrapped(online):
            original(online)
            if not online:
                false_persisted.set(); self.assertTrue(release_false.wait(2))
        self.store.set_network=wrapped
        off=threading.Thread(target=lambda:self.sim.set_network(False)); off.start()
        self.assertTrue(false_persisted.wait(2))
        def set_online(): true_started.set(); self.sim.set_network(True)
        on=threading.Thread(target=set_online); on.start(); self.assertTrue(true_started.wait(1))
        release_false.set(); off.join(2); on.join(2)
        self.assertFalse(off.is_alive()); self.assertFalse(on.is_alive())
        self.assertTrue(self.sim.snapshot()['online']); self.assertTrue(self.store.load_state()['online'])
        self.store.close(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','http://local'))
        self.assertTrue(self.store.load_state()['online'])

    def test_auto_fill_and_unchanged_policy_keep_independent_periodic_deadline(self):
        self.sim.set_auto_fill(True)
        self.clock.advance(5)
        for _ in range(359): self.clock.advance(5); self.sim.tick()
        self.assertEqual(len(self.transport.calls),2)
        self.assertEqual(self.store.pending(),[])

    def test_unsynced_at_is_stored(self):
        self.sim.record(Sensors(30,25,3.9), at=None); self.assertIsNone(self.store.pending()[-1]['at'])
