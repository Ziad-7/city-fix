import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))
import json, threading, unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import contextmanager
from model import Policy
from store import ReceiverStore
from mock_server import MockReceiver, make_mock_server
from transport import HttpTransport, TransportError
from helpers import reading

@contextmanager
def running(server):
    thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
    try: yield server
    finally: server.shutdown(); server.server_close(); thread.join(timeout=3)

class HttpTests(unittest.TestCase):
    def setUp(self):
        self.temp=__import__('tempfile').TemporaryDirectory(); self.store=ReceiverStore(Path(self.temp.name)/'r.sqlite')
        self.receiver=MockReceiver(self.store,'BIN','key-secret',type('C',(),{'utc_now':lambda s:datetime.now(timezone.utc)})())
        self.server=make_mock_server(self.receiver,0)
    def tearDown(self): self.server.server_close(); self.store.close(); self.temp.cleanup()
    def transport(self,key='key-secret',bin='BIN'): return HttpTransport(f'http://127.0.0.1:{self.server.server_address[1]}',bin,key)
    def test_transport_posts_contract_and_auth(self):
        with running(self.server):
            accepted,policy=self.transport().send([reading(1)])
            self.assertEqual(accepted,[1]); self.assertEqual(policy,Policy()); self.assertEqual(self.store.snapshot('BIN',Policy())['count'],1)
    def test_missing_or_wrong_key_401(self):
        with running(self.server):
            for key in ('','wrong'):
                with self.assertRaises(TransportError) as e: self.transport(key).send([reading(1)])
                self.assertEqual(e.exception.status,401)
    def test_wrong_bin_404(self):
        with running(self.server):
            with self.assertRaises(TransportError) as e: self.transport(bin='OTHER').send([reading(1)])
            self.assertEqual(e.exception.status,404)
    def test_required_fields_only_accepted_without_invented_optional_measurements_or_heat(self):
        with running(self.server):
            self.assertEqual(self.transport().send([reading(2)])[0],[2])
            latest=self.store.snapshot('BIN',Policy())['latest']; self.assertNotIn('tempC',latest); self.assertFalse(latest['heat'])
    def test_conflicting_duplicate_409_without_partial_insert(self):
        with running(self.server):
            self.transport().send([reading(1)])
            with self.assertRaises(TransportError) as e: self.transport().send([reading(2),reading(1,fillPct=90)])
            self.assertEqual(e.exception.status,409); self.assertEqual(self.store.snapshot('BIN',Policy())['count'],1)
    def test_invalid_batch_rejected(self):
        with running(self.server):
            for r in ([reading(1,foo=3)],[reading(True)],[reading(2),reading(2)],[{"seq":1,"at":None}],[reading(2,fillPct=101)]):
                with self.assertRaises(TransportError): self.transport().send(r)
            self.assertEqual(self.store.snapshot('BIN',Policy())['count'],0)
    def test_invalid_json_and_oversized_request_body(self):
        from urllib.request import Request, urlopen
        from urllib.error import HTTPError
        with running(self.server):
            endpoint=f'http://127.0.0.1:{self.server.server_address[1]}/iot/bins/BIN/readings'
            for body,expected in ((b'{bad',400),(b' '*65537,413)):
                req=Request(endpoint,data=body,method='POST',headers={'Content-Type':'application/json','X-Device-Key':'key-secret'})
                with self.assertRaises(HTTPError) as e: urlopen(req,timeout=2)
                self.assertEqual(e.exception.code,expected); e.exception.close()
            self.assertEqual(self.store.snapshot('BIN',Policy())['count'],0)
    def test_server_policy_response_is_returned(self):
        self.receiver.set_policy(Policy(2,55,45))
        with running(self.server): self.assertEqual(self.transport().send([reading(1)]),( [1],Policy(2,55,45)))

    def test_lost_response_after_commit_retry_is_deduplicated(self):
        receiver=self.receiver; state={'first':True}
        class Lost(BaseHTTPRequestHandler):
            def do_POST(self):
                n=int(self.headers['Content-Length']); payload=json.loads(self.rfile.read(n))
                accepted=receiver.store.accept('BIN',payload['readings'],receiver.clock.utc_now())
                if state['first']: state['first']=False; self.connection.shutdown(1); self.connection.close(); return
                body=json.dumps({'accepted':accepted,'intervalMin':1,'fullPct':50,'heatC':45}).encode()
                self.send_response(202); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
            def log_message(self,*args): pass
        lost=ThreadingHTTPServer(('127.0.0.1',0),Lost)
        with running(lost):
            t=HttpTransport(f'http://127.0.0.1:{lost.server_address[1]}','BIN','key-secret')
            with self.assertRaises(TransportError): t.send([reading(8)])
            self.assertEqual(self.store.snapshot('BIN',Policy())['count'],1)
            self.assertEqual(t.send([reading(8)]),( [8], Policy(1,50,45)))
            self.assertEqual(self.store.snapshot('BIN',Policy())['count'],1)

    def test_malformed_and_oversized_ack_are_sanitized(self):
        class Reply(BaseHTTPRequestHandler):
            body=b'{"accepted":[999],"intervalMin":30,"fullPct":80,"heatC":60,"detail":"key-secret raw"}'
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length','0')))
                self.send_response(202); self.send_header('Content-Length',str(len(self.body))); self.end_headers(); self.wfile.write(self.body)
            def log_message(self,*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Reply)
        with running(server):
            with self.assertRaises(TransportError) as e: HttpTransport(f'http://127.0.0.1:{server.server_address[1]}','BIN','key-secret').send([reading(1)])
            self.assertNotIn('key-secret',str(e.exception)); self.assertNotIn('raw',str(e.exception))
            Reply.body=b'{}'+b' '*65536
            with self.assertRaises(TransportError) as e: HttpTransport(f'http://127.0.0.1:{server.server_address[1]}','BIN','key-secret').send([reading(1)])
            self.assertNotIn('key-secret',str(e.exception))
    def test_redirect_is_not_followed(self):
        contacted=[]
        class Target(BaseHTTPRequestHandler):
            def do_POST(self): contacted.append(True); self.send_response(202); self.end_headers()
            def log_message(self,*args): pass
        target=ThreadingHTTPServer(('127.0.0.1',0),Target)
        class Redirect(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length','0'))); self.send_response(302); self.send_header('Location',f'http://127.0.0.1:{target.server_address[1]}/'); self.send_header('Content-Length','0'); self.end_headers()
            def log_message(self,*args): pass
        redirect=ThreadingHTTPServer(('127.0.0.1',0),Redirect)
        with running(target), running(redirect):
            with self.assertRaises(TransportError) as e: HttpTransport(f'http://127.0.0.1:{redirect.server_address[1]}','BIN','key-secret').send([reading(1)])
            self.assertEqual(e.exception.status,302); self.assertEqual(contacted,[])

    def test_transport_cancel_interrupts_a_dripping_response(self):
        import threading
        body=b'{"accepted":[1],"intervalMin":30,"fullPct":80,"heatC":60}'
        body_started=threading.Event(); release=threading.Event(); errors=[]
        class Drip(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers.get('Content-Length','0')))
                self.send_response(202); self.send_header('Content-Length',str(len(body))); self.end_headers()
                try:
                    self.wfile.write(body[:4]); self.wfile.flush(); body_started.set()
                    release.wait(2); self.wfile.write(body[4:]); self.wfile.flush()
                except OSError: pass
            def log_message(self,*args): pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Drip); transport=HttpTransport(f'http://127.0.0.1:{server.server_address[1]}','BIN','secret')
        with running(server):
            def send():
                try: transport.send([reading(1)])
                except Exception as exc: errors.append(exc)
            thread=threading.Thread(target=send); thread.start(); self.assertTrue(body_started.wait(1))
            transport.cancel(); thread.join(1); release.set()
            self.assertFalse(thread.is_alive()); self.assertTrue(errors)
