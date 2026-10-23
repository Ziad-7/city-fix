"""Checks for the smart-bin hardware package: schematic, BOM, links and the field brief.

Stdlib only. Run: python3 -m unittest discover -s hardware/tests -v
"""
import csv
import io
import json
import re
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HW = ROOT / "hardware"
sys.path.insert(0, str(HW / "schematics"))
sys.path.insert(0, str(HW / "bom"))
import bom_totals  # noqa: E402
import build_schematic  # noqa: E402

BRIEF_MD = ROOT / "docs" / "field-brief" / "field-deployment-brief.md"
BRIEF_HTML = ROOT / "docs" / "field-brief" / "field-deployment-brief.html"
WOKWI = HW / "wokwi" / "smart-bin"


class BomTests(unittest.TestCase):
    def setUp(self):
        self.rows = bom_totals.load()

    def test_schema_valid(self):
        self.assertEqual(bom_totals.validate(self.rows), [])

    def test_no_price_without_url_and_date(self):
        for r in self.rows:
            if r["unit_price_egp"].strip():
                self.assertTrue(r["supplier_url"].startswith("https://"), r["line_id"])
                self.assertRegex(r["price_date"], r"^\d{4}-\d{2}-\d{2}$", r["line_id"])
                self.assertNotEqual(r["evidence"], "none", r["line_id"])

    def test_to_verify_has_no_price(self):
        for r in self.rows:
            if r["status"] == "to_verify":
                self.assertEqual(r["unit_price_egp"], "", r["line_id"])

    def test_totals_recomputed(self):
        expected = sum(Decimal(r["unit_price_egp"]) * int(r["qty_per_bin"]) for r in self.rows
                       if r["status"] == "sourced" and r["block"] not in ("alternative", "running_cost"))
        one_time, _monthly, unsourced, _sourced = bom_totals.totals(self.rows)
        self.assertEqual(one_time, expected)
        self.assertEqual(len(unsourced), sum(1 for r in self.rows if r["status"] == "to_verify" and r["block"] != "alternative"))

    def test_partial_banner_when_unsourced(self):
        out = io.StringIO()
        with redirect_stdout(out):
            self.assertEqual(bom_totals.main(), 0)
        if any(r["status"] == "to_verify" and r["block"] != "alternative" for r in self.rows):
            self.assertIn("PARTIAL: not a per-bin cost", out.getvalue())

    def test_bad_rows_are_rejected(self):
        bad = [dict(self.rows[0], supplier_url="")]
        self.assertTrue(bom_totals.validate(bad))
        bad = [dict(self.rows[1], unit_price_egp="10.00")]  # to_verify line with a price
        self.assertTrue(bom_totals.validate(bad))

    def test_bom_readme_shows_current_output(self):
        out = io.StringIO()
        with redirect_stdout(out):
            bom_totals.main()
        self.assertIn(out.getvalue().strip(), (HW / "bom" / "README.md").read_text(encoding="utf-8"))


class SchematicTests(unittest.TestCase):
    def test_check_passes(self):
        r = subprocess.run([sys.executable, str(HW / "schematics" / "build_schematic.py"), "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_render_is_deterministic(self):
        self.assertEqual(build_schematic.render_svg(), build_schematic.render_svg())

    def test_unchanged_esp_pins_match_wokwi(self):
        diagram = json.loads((WOKWI / "diagram.json").read_text(encoding="utf-8"))
        pairs = {frozenset((c[0], c[1])) for c in diagram["connections"]}
        for gpio, (_x, _y, _s, _func, _net, wk, _delta) in build_schematic.ESP_PINS.items():
            if wk is None:
                continue
            self.assertIn(frozenset((f"esp:{gpio}", wk)), pairs, f"{gpio} vs Wokwi {wk}")

    def test_wokwi_sketch_constants_match(self):
        sketch = (WOKWI / "sketch.ino").read_text(encoding="utf-8")
        consts = {}
        for m in re.finditer(r"constexpr int ([^;]+);", sketch):
            for a in m.group(1).split(","):
                k, v = a.split("=")
                consts[k.strip()] = int(v)
        names = {"TRIG": "D5", "ECHO": "D18", "ONEWIRE": "D4", "BATTERY": "D34", "NET_SW": "D27", "SOLAR_SW": "D26",
                 "SAMPLE_BTN": "D25", "LED_FULL": "D13", "LED_HEAT": "D14", "LED_STATUS": "D19", "LED_CHARGE": "D23"}
        for k, gpio in names.items():
            self.assertEqual(f"D{consts[k]}", gpio, k)
            self.assertIn(gpio, build_schematic.ESP_PINS)

    def test_changed_pins_are_marked(self):
        for gpio, (_x, _y, _s, _f, _n, wk, delta) in build_schematic.ESP_PINS.items():
            if wk is None and gpio != "3V3":
                self.assertIn("Δ", delta, gpio)

    def test_netlist_references_real_parts_and_pins(self):
        for net, pins in build_schematic.NETS.items():
            if net == "GND":
                continue
            for ref in pins:
                part, pin = ref.split(".", 1)
                if part == "U0":
                    self.assertIn(pin, build_schematic.ESP_PINS, ref)
                else:
                    self.assertIn(part, build_schematic.PARTS, ref)

    def test_svg_has_key_features(self):
        svg = (HW / "schematics" / "smart-bin.svg").read_text(encoding="utf-8")
        for needle in ("R3 1k / R4 2k", "R7/R8 divider", "F1 fuse", "U1 TP4056", "C2 bulk cap", "GSM_EN", "SENS_EN",
                       "SIM_TXD", "TAMPER", "stroke-dasharray", "not bench-validated"):
            self.assertIn(needle, svg)


class LinkTests(unittest.TestCase):
    def test_relative_links_resolve(self):
        files = list(HW.rglob("*.md")) + [BRIEF_MD]
        link = re.compile(r"\]\(([^)\s]+)\)")
        for f in files:
            if "node_modules" in f.parts:
                continue
            for target in link.findall(f.read_text(encoding="utf-8")):
                if re.match(r"^(https?:|mailto:|#)", target):
                    continue
                path = (f.parent / target.split("#")[0]).resolve()
                self.assertTrue(path.exists(), f"{f.relative_to(ROOT)} -> {target}")


class _Collect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h2, self.first_col, self._in, self._cell, self._row, self._tag = [], [], None, False, 0, None

    def handle_starttag(self, tag, attrs):
        self._tag = tag
        if tag == "h2":
            self.h2.append("")
        if tag == "tr":
            self._row = 0
        if tag in ("td", "th"):
            self._row += 1
            if self._row == 1 and tag == "td":
                self.first_col.append("")

    def handle_endtag(self, tag):
        self._tag = None

    def handle_data(self, data):
        if self._tag == "h2":
            self.h2[-1] += data
        elif self._tag == "td" and self._row == 1:
            self.first_col[-1] += data


class BriefTests(unittest.TestCase):
    def test_word_limit(self):
        self.assertLessEqual(len(BRIEF_MD.read_text(encoding="utf-8").split()), 1200)

    def test_md_and_html_structure_match(self):
        md = BRIEF_MD.read_text(encoding="utf-8")
        md_h2 = [m.strip() for m in re.findall(r"^## (.+)$", md, flags=re.M)]
        md_first = [line.strip().strip("|").split("|")[0].strip() for line in md.splitlines()
                    if line.startswith("|") and not line.startswith("| ---") and not line.startswith("| Condition")
                    and not line.startswith("| Interval")]
        p = _Collect()
        p.feed(BRIEF_HTML.read_text(encoding="utf-8"))
        self.assertEqual([h.strip() for h in p.h2], md_h2)
        self.assertEqual([c.strip() for c in p.first_col], md_first)

    def test_every_claim_row_has_verified_and_how(self):
        md = BRIEF_MD.read_text(encoding="utf-8")
        rows = [l for l in md.splitlines() if l.startswith("|") and not l.startswith("| ---")][1:9]
        for row in rows:
            cells = [c.strip() for c in row.strip("|").split("|")]
            self.assertEqual(len(cells), 5, row)
            self.assertTrue(cells[3] and cells[4], row)

    def test_html_is_a4_and_self_contained(self):
        html = BRIEF_HTML.read_text(encoding="utf-8")
        self.assertIn("@page { size: A4; margin: 15mm; }", html)
        self.assertNotRegex(html, r'(src|href)="https?://')

    def test_cost_line_matches_bom(self):
        rows = bom_totals.load()
        one_time, _m, unsourced, sourced = bom_totals.totals(rows)
        line = f"{len(sourced)} lines sourced, {len(unsourced)} to verify; sourced lines add up to {one_time:.2f} EGP"
        self.assertIn(line, BRIEF_MD.read_text(encoding="utf-8"))
        self.assertIn(line, BRIEF_HTML.read_text(encoding="utf-8"))


class TemplateTests(unittest.TestCase):
    def test_csv_headers(self):
        bench = (HW / "power" / "bench-log-template.csv").read_text(encoding="utf-8").strip()
        self.assertEqual(bench, "date,tester,board,firmware,state,supply_v,current_ma,duration_s,instrument,ambient_c,notes")
        disc = (HW / "power" / "discharge-log-template.csv").read_text(encoding="utf-8").strip()
        self.assertEqual(disc, "timestamp,vbat_v,tempC,notes")

    def test_no_workflow_or_firmware_added(self):
        self.assertFalse((HW / "firmware").exists())
        self.assertFalse((ROOT / ".github" / "workflows" / "hardware-ci.yml").exists())


if __name__ == "__main__":
    unittest.main()
