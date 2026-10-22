#!/usr/bin/env python3
"""Start the local CityCycle smart-bin demonstration."""
import os, sys, threading, time, webbrowser
from pathlib import Path

try:
    from config import Config, ConfigError
    from engine import Simulator
    from model import SystemClock
    from mock_server import MockReceiver, make_mock_server
    from store import DeviceStore, ReceiverStore
    from transport import HttpTransport
    from web_server import make_web_server
except ImportError:
    from .config import Config, ConfigError
    from .engine import Simulator
    from .model import SystemClock
    from .mock_server import MockReceiver, make_mock_server
    from .store import DeviceStore, ReceiverStore
    from .transport import HttpTransport
    from .web_server import make_web_server


class Worker:
    def __init__(self, simulator, interval=1):
        self.simulator = simulator
        self.interval = interval
        self.stop_event = threading.Event()
        self.wake_event = threading.Event()
        self.thread = threading.Thread(target=self._run, name='citycycle-simulator', daemon=True)

    def start(self):
        self.thread.start()

    def wake(self):
        self.wake_event.set()

    def _run(self):
        while not self.stop_event.is_set():
            self.wake_event.clear()
            try:
                self.simulator.tick()
                self.simulator.worker_recovered()
            except Exception:
                self.simulator.report_error("A local simulator operation failed; check the device database and data directory.")
            self.wake_event.wait(self.interval)

    def stop(self):
        self.stop_event.set()
        self.wake_event.set()
        cancel = getattr(self.simulator.transport, "cancel", None)
        if callable(cancel):
            try:
                cancel()
            except Exception:
                pass
        if self.thread.ident is not None:
            self.thread.join()
        if self.thread.is_alive():
            raise RuntimeError("simulator worker did not stop")


def main(argv=None, env=None):
    env=os.environ if env is None else env
    try: config=Config.from_env_and_args(sys.argv[1:] if argv is None else argv,env)
    except ConfigError as exc: print(f"Configuration error: {exc}",file=sys.stderr); return 2
    clock=SystemClock(); config.data_dir.mkdir(parents=True,exist_ok=True)
    device=receiver_store=mock_server=web_server=None; mock_thread=web_thread=None; worker=None
    try:
        identity=(config.bin_id,config.mode,config.base_url)
        device=DeviceStore(config.data_dir/'device.sqlite3',identity)
        if config.mode=='mock':
            receiver_store=ReceiverStore(config.data_dir/'receiver.sqlite3')
            receiver=MockReceiver(receiver_store,config.bin_id,config.device_key,clock)
            mock_server=make_mock_server(receiver,config.mock_port)
            mock_thread=threading.Thread(target=mock_server.serve_forever,name='citycycle-mock-http',daemon=True); mock_thread.start()
        else: receiver=None
        transport=HttpTransport(config.base_url,config.bin_id,config.device_key)
        simulator=Simulator(device,transport,clock)
        web_server=make_web_server(simulator,receiver,config.port,__import__('secrets').token_urlsafe(32))
        web_thread=threading.Thread(target=web_server.serve_forever,name='citycycle-panel-http',daemon=True); web_thread.start()
        simulator.start(); worker=Worker(simulator); worker.start()
        url=f"http://127.0.0.1:{config.port}"
        print(f"CityCycle smart-bin simulator ({config.mode} mode) for {config.bin_id}")
        print(f"Panel: {url}")
        print(f"Local data: {config.data_dir}")
        if config.open_browser: webbrowser.open(url)
        print("Press Ctrl+C to stop.")
        while True: time.sleep(1)
    except KeyboardInterrupt:
        return 0
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"Simulator startup failed: {exc}",file=sys.stderr); return 1
    finally:
        if worker: worker.stop()
        for server in (web_server, mock_server):
            if server:
                try:
                    server.shutdown()
                except OSError:
                    pass
        for server in (web_server, mock_server):
            if server:
                try:
                    server.server_close()
                except OSError:
                    pass
        for thread in (web_thread, mock_thread):
            if thread:
                thread.join()
        if receiver_store: receiver_store.close()
        if device: device.close()

if __name__=='__main__': raise SystemExit(main())
