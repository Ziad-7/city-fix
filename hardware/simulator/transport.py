"""Bounded, cancellable HTTP transport for the provisional reading endpoint."""
import http.client
import json
import socket
import ssl
import threading
import time
from urllib.parse import urlsplit

try:
    from .model import Policy
except ImportError:
    from model import Policy

MAX_RESPONSE = 65536
HTTP_DEADLINE_SECONDS = 3


class TransportError(RuntimeError):
    def __init__(self, category, status=None):
        self.category = category
        self.status = status
        self.safe_message = f"Delivery failed ({status})" if status else f"Delivery failed ({category})"
        super().__init__(self.safe_message)


class HttpTransport:
    def __init__(self, base_url: str, bin_id: str, device_key: str):
        parsed = urlsplit(base_url)
        self.scheme = parsed.scheme
        self.host = parsed.hostname
        self.port = parsed.port or (443 if parsed.scheme == "https" else 80)
        self.prefix = parsed.path.rstrip("/")
        self.bin_id = bin_id
        self.device_key = device_key
        self._active_lock = threading.Lock()
        self._active = None

    def cancel(self):
        """Interrupt the current socket operation during worker shutdown."""
        with self._active_lock:
            active = self._active
        if active is not None:
            connection, sock, cancelled = active
            cancelled.set()
            if sock is not None:
                try:
                    sock.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
            connection.close()

    def send(self, readings):
        endpoint = f"{self.prefix}/iot/bins/{self.bin_id}/readings"
        body = json.dumps({"readings": readings}, allow_nan=False, separators=(",", ":")).encode()
        deadline = time.monotonic() + HTTP_DEADLINE_SECONDS
        timeout = HTTP_DEADLINE_SECONDS
        if self.scheme == "https":
            connection = http.client.HTTPSConnection(self.host, self.port, timeout=timeout, context=ssl.create_default_context())
        else:
            connection = http.client.HTTPConnection(self.host, self.port, timeout=timeout)
        cancelled = threading.Event()
        active_socket = None
        with self._active_lock:
            self._active = (connection, None, cancelled)
        try:
            connection.connect()
            # Retain the socket because http.client transfers it to the response
            # object after getresponse(), clearing connection.sock.
            active_socket = connection.sock
            with self._active_lock:
                self._active = (connection, active_socket, cancelled)
            if cancelled.is_set():
                raise TransportError("cancelled")
            connection.request("POST", endpoint, body=body, headers={
                "Content-Type": "application/json",
                "X-Device-Key": self.device_key,
                "Accept": "application/json",
                "Connection": "close",
            })
            response = connection.getresponse()
            if cancelled.is_set():
                raise TransportError("cancelled")
            if response.status != 202:
                raise TransportError("http", response.status)
            chunks = bytearray()
            while len(chunks) <= MAX_RESPONSE:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TransportError("timeout")
                if active_socket is not None and active_socket.fileno() >= 0:
                    active_socket.settimeout(remaining)
                chunk = response.read1(min(8192, MAX_RESPONSE + 1 - len(chunks)))
                if cancelled.is_set():
                    raise TransportError("cancelled")
                if not chunk:
                    break
                chunks.extend(chunk)
            if len(chunks) > MAX_RESPONSE:
                raise TransportError("response-too-large")
            try:
                data = json.loads(chunks)
                if not isinstance(data, dict) or set(data) != {"accepted", "intervalMin", "fullPct", "heatC"}:
                    raise ValueError()
                accepted = data["accepted"]
                if not isinstance(accepted, list) or any(type(seq) is not int or seq < 1 for seq in accepted) or len(set(accepted)) != len(accepted) or not set(accepted) <= {reading["seq"] for reading in readings}:
                    raise ValueError()
                policy = Policy(data["intervalMin"], data["fullPct"], data["heatC"])
                return accepted, policy
            except Exception:
                raise TransportError("invalid-response") from None
        except TransportError:
            raise
        except (http.client.HTTPException, OSError, socket.timeout, TimeoutError):
            raise TransportError("network") from None
        finally:
            connection.close()
            with self._active_lock:
                if self._active is not None and self._active[0] is connection:
                    self._active = None
