import sys
from pathlib import Path as _Path
sys.path.insert(0, str(_Path(__file__).parents[1]))
import unittest
from pathlib import Path

from config import Config, ConfigError


class ConfigTests(unittest.TestCase):
    def parse(self, env, argv=None):
        return Config.from_env_and_args(argv or ["--no-browser"], env)

    def test_missing_real_credentials(self):
        with self.assertRaises(ConfigError): self.parse({"CITYFIX_SIM_MODE": "real"})

    def test_external_plain_http_rejected(self):
        with self.assertRaises(ConfigError): self.parse({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": "http://example.com", "CITYFIX_DEVICE_KEY": "abc"})

    def test_embedded_url_credentials_query_and_fragment_rejected(self):
        for url in ("https://u:p@example.com", "https://example.com/?x=1", "https://example.com/#x"):
            with self.subTest(url=url), self.assertRaises(ConfigError): self.parse({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": url, "CITYFIX_DEVICE_KEY": "abc"})

    def test_invalid_bin_header_and_ports_rejected(self):
        for env, argv in (({"CITYFIX_BIN_ID": "bad id"}, ["--no-browser"]), ({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": "https://example.com", "CITYFIX_DEVICE_KEY": "a\nb"}, ["--no-browser"]), ({}, ["--port", "0"])):
            with self.subTest(env=env, argv=argv), self.assertRaises(ConfigError): self.parse(env, argv)

    def test_invalid_endpoint_port_is_a_config_error(self):
        with self.assertRaises(ConfigError): self.parse({"CITYFIX_SIM_MODE":"real","CITYFIX_API_BASE_URL":"https://example.com:nope","CITYFIX_DEVICE_KEY":"abc"})

    def test_valid_https_prefix(self):
        cfg = self.parse({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": "https://example.com/api", "CITYFIX_DEVICE_KEY": "abc"})
        self.assertEqual(cfg.base_url, "https://example.com/api")

    def test_valid_loopback_http(self):
        cfg = self.parse({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": "http://127.0.0.1:9000", "CITYFIX_DEVICE_KEY": "abc"})
        self.assertTrue(cfg.base_url.startswith("http://127.0.0.1"))

    def test_default_data_is_script_relative(self):
        cfg = self.parse({})
        self.assertEqual(cfg.data_dir, Path(__file__).parents[1] / ".data")

    def test_repr_omits_key(self):
        cfg = self.parse({"CITYFIX_SIM_MODE": "real", "CITYFIX_API_BASE_URL": "https://example.com", "CITYFIX_DEVICE_KEY": "secret-value"})
        self.assertNotIn("secret-value", repr(cfg))
