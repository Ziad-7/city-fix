import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
import json, tempfile, threading, unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from store import DeviceStore, ReceiverStore
from model import Sensors, Policy
from engine import Simulator
from mock_server import MockReceiver
from web_server import make_web_server
from helpers import FakeClock

class Stub:
    def send(self, readings): return [x['seq'] for x in readings], Policy()

class WebTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.store=DeviceStore(Path(self.tmp.name)/'d.sqlite',('BIN','mock','x')); self.sim=Simulator(self.store,Stub(),FakeClock()); self.sim.start()
        self.rs=ReceiverStore(Path(self.tmp.name)/'r.sqlite'); self.receiver=MockReceiver(self.rs,'BIN','secret',FakeClock()); self.token='test-control'
        self.server=make_web_server(self.sim,self.receiver,0,self.token); self.thread=threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start(); self.origin=f'http://127.0.0.1:{self.server.server_address[1]}'
    def tearDown(self): self.server.shutdown(); self.server.server_close(); self.thread.join(3); self.rs.close(); self.store.close(); self.tmp.cleanup()
    def request(self,path,method='GET',body=None,headers=None):
        h=dict(headers or {}); data=None if body is None else (body if isinstance(body,bytes) else json.dumps(body).encode())
        req=Request(self.origin+path,data=data,method=method,headers=h)
        try:
            with urlopen(req,timeout=2) as r: return r.status,json.loads(r.read()) if 'json' in r.headers.get('Content-Type','') else r.read()
        except HTTPError as e: return e.code,json.loads(e.read())
    def auth(self,origin=None,token=None): return {'Origin':origin or self.origin,'X-Control-Token':token or self.token,'Content-Type':'application/json'}
    def test_foreign_host_rejected(self): self.assertEqual(self.request('/',headers={'Host':'evil.example'})[0],400)
    def test_state_read_returns_launch_control_token(self):
        status,state=self.request('/api/state'); self.assertEqual(status,200); self.assertEqual(state['controlToken'],self.token); self.assertNotIn('device_key',state)
    def test_missing_control_token_rejected(self):
        headers={'Origin':self.origin,'Content-Type':'application/json'}
        self.assertEqual(self.request('/api/network','POST',{'online':False},headers)[0],403); self.assertTrue(self.sim.snapshot()['online'])
    def test_oversized_json_and_invalid_sensor_ranges_rejected(self):
        self.assertEqual(self.request('/api/sample','POST',b'{"x":"'+b'a'*5000+b'"}',self.auth())[0],413)
        before=self.store.pending(); self.assertEqual(self.request('/api/sample','POST',{'fillPct':101,'tempC':20,'batteryV':4},self.auth())[0],400)
        self.assertEqual(self.store.pending(),before)
    def test_browser_mutation_requires_same_origin_and_token(self):
        self.assertNotEqual(self.request('/api/network','POST',{'online':False},self.auth(origin='http://evil.example'))[0],200)
        self.assertNotEqual(self.request('/api/network','POST',{'online':False},self.auth(token='bad'))[0],200)
        self.assertTrue(self.sim.snapshot()['online'])
    def test_static_traversal_unknown_route_and_non_json_rejected(self):
        self.assertEqual(self.request('/../../README.md')[0],404)
        self.assertEqual(self.request('/api/not-real')[0],404)
        self.assertNotEqual(self.request('/api/network','POST',b'bad',self.auth())[0],200)
    def test_mock_policy_edit_waits_for_device_response(self):
        status,_=self.request('/api/mock-config','POST',{'intervalMin':1,'fullPct':50,'heatC':45},self.auth())
        self.assertEqual(status,200); self.assertEqual(self.sim.snapshot()['policy'],Policy())
        self.sim.record(Sensors(55,46,3.9)); self.receiver.policy=Policy(1,50,45); self.sim.transport.send=lambda rows: ([r['seq'] for r in rows],self.receiver.policy); self.sim.request_send(); self.sim.tick(); self.assertEqual(self.sim.snapshot()['policy'],Policy(1,50,45))
    def test_server_close_waits_for_active_control_handler(self):
        server=make_web_server(self.sim,self.receiver,0,self.token); serve=threading.Thread(target=server.serve_forever,daemon=True); serve.start()
        entered=threading.Event(); release=threading.Event(); finished=threading.Event(); original=self.sim.snapshot
        def blocked_snapshot(): entered.set(); release.wait(2); return original()
        self.sim.snapshot=blocked_snapshot
        client=threading.Thread(target=lambda:urlopen(f'http://127.0.0.1:{server.server_port}/api/state',timeout=3).read()); client.start()
        self.assertTrue(entered.wait(1)); server.shutdown()
        closer=threading.Thread(target=lambda:(server.server_close(),finished.set())); closer.start()
        self.assertFalse(finished.wait(.05))
        release.set(); client.join(2); closer.join(2); serve.join(2)
        self.assertTrue(finished.is_set()); self.sim.snapshot=original

    def test_server_close_ends_repeated_state_poll_connections(self):
        import http.client
        server=make_web_server(self.sim,self.receiver,0,self.token); serve=threading.Thread(target=server.serve_forever,daemon=True); serve.start()
        client=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
        for _ in range(4):
            client.request('GET','/api/state')
            response=client.getresponse(); self.assertEqual(response.status,200); self.assertEqual(response.getheader('Connection'),'close'); response.read()
        server.shutdown()
        closed=threading.Event(); closer=threading.Thread(target=lambda:(server.server_close(),closed.set())); closer.start()
        self.assertTrue(closed.wait(1)); closer.join(1); serve.join(1); client.close()

    def test_real_mode_rejects_mock_config(self):
        server=make_web_server(self.sim,None,0,self.token); thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        try:
            status,_=urlopen(Request(f'http://127.0.0.1:{server.server_address[1]}/api/mock-config',data=b'{"intervalMin":1,"fullPct":50,"heatC":45}',method='POST',headers={'Origin':f'http://127.0.0.1:{server.server_address[1]}','X-Control-Token':self.token,'Content-Type':'application/json'}))
        except HTTPError as e: status=e.code
        finally: server.shutdown(); server.server_close(); thread.join(3)
        self.assertEqual(status,503)
