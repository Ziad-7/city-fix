from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping
from urllib.parse import urlsplit
import argparse
import re
import secrets


class ConfigError(ValueError): pass


@dataclass(frozen=True)
class Config:
    mode: str
    bin_id: str
    base_url: str
    device_key: str = field(repr=False)
    port: int = 8765
    mock_port: int = 8766
    data_dir: Path = Path(__file__).parent / ".data"
    open_browser: bool = True

    @classmethod
    def from_env_and_args(cls, argv: list[str], env: Mapping[str, str]):
        parser = argparse.ArgumentParser()
        parser.add_argument("--port", type=int, default=8765)
        parser.add_argument("--mock-port", type=int, default=8766)
        parser.add_argument("--data-dir", type=Path)
        parser.add_argument("--no-browser", action="store_true")
        try: args = parser.parse_args(argv)
        except SystemExit as exc: raise ConfigError("invalid command line options") from exc
        if any(not isinstance(p, int) or p < 1 or p > 65535 for p in (args.port, args.mock_port)) or args.port == args.mock_port: raise ConfigError("ports must be distinct integers from 1 to 65535")
        mode = env.get("CITYFIX_SIM_MODE", "mock").lower()
        if mode not in {"mock", "real"}: raise ConfigError("CITYFIX_SIM_MODE must be mock or real")
        bin_id = env.get("CITYFIX_BIN_ID", "BIN-SIM-001")
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", bin_id): raise ConfigError("invalid CITYFIX_BIN_ID")
        if mode == "mock":
            url, key = f"http://127.0.0.1:{args.mock_port}", secrets.token_urlsafe(32)
        else:
            url, key = env.get("CITYFIX_API_BASE_URL", ""), env.get("CITYFIX_DEVICE_KEY", "")
            if not url or not key: raise ConfigError("real mode requires CITYFIX_API_BASE_URL and CITYFIX_DEVICE_KEY")
            if any(ord(c) < 32 or ord(c) == 127 for c in key): raise ConfigError("device key contains invalid header characters")
            try: parsed = urlsplit(url)
            except ValueError as exc: raise ConfigError("invalid API base URL") from exc
            if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment: raise ConfigError("API base URL must not contain credentials, query, or fragment")
            loop = parsed.hostname.lower() in {"127.0.0.1", "localhost", "::1"}
            if parsed.scheme == "http" and not loop: raise ConfigError("real endpoint must use HTTPS except for loopback")
            try: endpoint_port=parsed.port
            except ValueError as exc: raise ConfigError("invalid API port") from exc
            if endpoint_port and not 1 <= endpoint_port <= 65535: raise ConfigError("invalid API port")
            if any(ord(c) < 32 or ord(c) == 127 for c in url): raise ConfigError("invalid API base URL")
            url = url.rstrip("/")
        return cls(mode, bin_id, url, key, args.port, args.mock_port, (args.data_dir or Path(__file__).parent / ".data").resolve(), not args.no_browser)
