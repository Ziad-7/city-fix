"""Separate loopback HTTP receiver used only for explicitly simulated mode."""
import hmac, json, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
try:
    from .model import Policy
    from .store import StoreError
except ImportError:
    from model import Policy
    from store import StoreError

MAX_BODY=65536

class MockReceiver:
    def __init__(self, store, bin_id, device_key, clock):
        self.store,self.bin_id,self.device_key,self.clock=store,bin_id,device_key,clock
        self.policy=Policy(); self.lock=threading.RLock()
    def set_policy(self, policy):
        if not isinstance(policy,Policy): raise ValueError('invalid policy')
        with self.lock: self.policy=policy
    def snapshot(self):
        with self.lock: policy=self.policy
        return {**self.store.snapshot(self.bin_id,policy), 'policy':policy}


def make_mock_server(receiver: MockReceiver, port: int):
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.1'
        def setup(self):
            super().setup(); self.connection.settimeout(5)
        def log_message(self, fmt, *args): return
        def reply(self,status,body):
            raw=json.dumps(body,separators=(',',':')).encode()
            self.close_connection=True
            self.send_response(status); self.send_header('Connection','close'); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
        def do_POST(self):
            try:
                parts=urlsplit(self.path).path.strip('/').split('/')
                if self.headers.get('Host','') not in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}: return self.reply(400,{'detail':'invalid Host'})
                if len(parts)!=4 or parts[0:2]!=['iot','bins'] or parts[3]!='readings': return self.reply(404,{'detail':'route not found'})
                if self.headers.get('Content-Type','').split(';')[0].strip().lower()!='application/json': return self.reply(400,{'detail':'Content-Type must be application/json'})
                if not hmac.compare_digest(self.headers.get('X-Device-Key',''),receiver.device_key): return self.reply(401,{'detail':'device authentication failed'})
                if parts[2]!=receiver.bin_id: return self.reply(404,{'detail':'bin not found'})
                rawlen=self.headers.get('Content-Length')
                if rawlen is None or not rawlen.isdigit(): return self.reply(400,{'detail':'invalid body length'})
                length=int(rawlen)
                if length>MAX_BODY: return self.reply(413,{'detail':'request body too large'})
                raw=self.rfile.read(length)
                if len(raw)!=length: return self.reply(400,{'detail':'invalid request body'})
                try: data=json.loads(raw)
                except Exception: return self.reply(400,{'detail':'invalid JSON'})
                if not isinstance(data,dict) or set(data)!={'readings'} or not isinstance(data['readings'],list) or not 1<=len(data['readings'])<=50: return self.reply(400,{'detail':'invalid readings batch'})
                try: accepted=receiver.store.accept(receiver.bin_id,data['readings'],receiver.clock.utc_now())
                except StoreError as exc:
                    msg=str(exc)
                    return self.reply(409 if 'conflict' in msg else 400,{'detail':'sequence conflict' if 'conflict' in msg else 'invalid reading batch'})
                with receiver.lock: policy=receiver.policy
                return self.reply(202,{'accepted':accepted,'intervalMin':policy.interval_min,'fullPct':policy.full_pct,'heatC':policy.heat_c})
            except (BrokenPipeError,ConnectionResetError): pass
            except Exception: self.reply(400,{'detail':'invalid request'})
    class LocalServer(ThreadingHTTPServer):
        daemon_threads=False
        block_on_close=True
        allow_reuse_address=True
    return LocalServer(('127.0.0.1',port),Handler)
