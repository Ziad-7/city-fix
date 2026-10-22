"""Same-origin local control panel API and fixed static asset server."""
import hmac, json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
try:
    from .model import Policy, Sensors
except ImportError:
    from model import Policy, Sensors

STATIC=Path(__file__).parent/'static'
MAX_BODY=4096


def _plain(value):
    if hasattr(value,'__dataclass_fields__'): return {k:_plain(v) for k,v in value.__dict__.items()}
    if isinstance(value,dict): return {k:_plain(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)): return [_plain(v) for v in value]
    return value


def make_web_server(simulator, receiver, port: int, control_token: str):
    class Handler(BaseHTTPRequestHandler):
        protocol_version='HTTP/1.1'
        def setup(self):
            super().setup(); self.connection.settimeout(5)
        def log_message(self,fmt,*args): return
        def origin(self): return f'http://{self.headers.get("Host","")}'
        def host_valid(self):
            allowed={f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
            return self.headers.get('Host','') in allowed
        def reply(self,status,body,content_type='application/json; charset=utf-8'):
            raw=body if isinstance(body,bytes) else json.dumps(_plain(body),separators=(',',':')).encode()
            self.close_connection=True
            self.send_response(status); self.send_header('Connection','close'); self.send_header('Content-Type',content_type); self.send_header('Content-Length',str(len(raw))); self.send_header('X-Content-Type-Options','nosniff'); self.send_header('Cache-Control','no-store'); self.end_headers()
            try: self.wfile.write(raw)
            except (BrokenPipeError,ConnectionResetError): pass
        def fail(self,status,detail): self.reply(status,{'detail':detail})
        def do_GET(self):
            if not self.host_valid(): return self.fail(400,'invalid Host')
            origin=self.headers.get('Origin')
            if origin is not None and origin != self.origin(): return self.fail(403,'same-origin request required')
            assets={'/':'index.html','/style.css':'style.css','/app.js':'app.js'}
            if self.path in assets:
                path=STATIC/assets[self.path]
                types={'index.html':'text/html; charset=utf-8','style.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8'}
                return self.reply(200,path.read_bytes(),types[assets[self.path]])
            if self.path=='/api/state':
                state=simulator.snapshot()
                state['mode']='mock' if receiver is not None else 'real'
                state['binId']=simulator.store.identity[0]
                state['receiver']=receiver.snapshot() if receiver else None
                state['controlToken']=control_token
                return self.reply(200,state)
            return self.fail(404,'route not found')
        def read_json(self):
            ctype=self.headers.get('Content-Type','').split(';')[0].strip().lower()
            if ctype!='application/json': raise ValueError('Content-Type must be application/json')
            length=self.headers.get('Content-Length','')
            if not length.isdigit(): raise ValueError('invalid Content-Length')
            if int(length)>MAX_BODY: raise OverflowError()
            raw=self.rfile.read(int(length))
            if len(raw)!=int(length): raise ValueError('invalid request body')
            try: value=json.loads(raw)
            except Exception: raise ValueError('invalid JSON')
            if not isinstance(value,dict): raise ValueError('JSON body must be an object')
            return value
        def do_POST(self):
            if not self.host_valid(): return self.fail(400,'invalid Host')
            if self.headers.get('Origin')!=self.origin(): return self.fail(403,'same-origin request required')
            if not hmac.compare_digest(self.headers.get('X-Control-Token',''),control_token): return self.fail(403,'control token required')
            try: body=self.read_json()
            except OverflowError: return self.fail(413,'request body too large')
            except ValueError as e: return self.fail(400,str(e))
            try:
                if self.path=='/api/sample':
                    if set(body)!={'fillPct','tempC','batteryV'}: raise ValueError('invalid sample fields')
                    seq=simulator.record(Sensors(body['fillPct'],body['tempC'],body['batteryV']))
                    return self.reply(200,{'recorded':seq})
                if self.path=='/api/network':
                    if set(body)!={'online'} or type(body['online']) is not bool: raise ValueError('online must be boolean')
                    simulator.set_network(body['online']); return self.reply(200,{'online':body['online']})
                if self.path=='/api/auto':
                    if set(body)!={'enabled'} or type(body['enabled']) is not bool: raise ValueError('enabled must be boolean')
                    simulator.set_auto_fill(body['enabled']); return self.reply(200,{'enabled':body['enabled']})
                if self.path=='/api/send':
                    if body: raise ValueError('body must be empty')
                    simulator.request_send(); return self.reply(200,{'requested':True})
                if self.path=='/api/mock-config':
                    if receiver is None: return self.fail(503,'mock receiver is unavailable in real mode')
                    if set(body)!={'intervalMin','fullPct','heatC'}: raise ValueError('invalid policy fields')
                    receiver.set_policy(Policy(body['intervalMin'],body['fullPct'],body['heatC']))
                    return self.reply(200,{'configured':True})
                return self.fail(404,'route not found')
            except (ValueError,TypeError) as exc: return self.fail(400,str(exc))
            except Exception: return self.fail(500,'operation failed')
    class LocalServer(ThreadingHTTPServer):
        daemon_threads=False
        block_on_close=True
        allow_reuse_address=True
    return LocalServer(('127.0.0.1',port),Handler)
