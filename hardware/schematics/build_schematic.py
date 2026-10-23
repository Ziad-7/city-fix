#!/usr/bin/env python3
"""Build the CityCycle smart-bin field wiring schematic (SVG) and its pin/net tables.

One data structure (PARTS, WIRES, NETS, ESP_PINS) is the single source. The script
writes smart-bin.svg and the generated section of README.md. Output is deterministic
(sorted, no timestamps). `--check` regenerates in memory and fails if files differ.

Rev A: paper design, NOT bench-validated.
"""
import sys
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
SVG_PATH = HERE / "smart-bin.svg"
README_PATH = HERE / "README.md"
BEGIN, END = "<!-- BEGIN GENERATED -->", "<!-- END GENERATED -->"

W, H = 1640, 1030
C_PWR, C_SIG, C_AUX, C_TXT, C_MUTE = "#b3261e", "#1d4ed8", "#9a5b00", "#1a1a1a", "#555555"

# id: (x, y, w, h, title, lines, bench_only, {pin: (x, y, side)}, show_pin_labels)
PARTS = {
    "PV": (20, 100, 170, 90, "PV panel", ["size and voltage:", "to verify"], False, {"PV+": (190, 140, "R")}, False),
    "D1": (230, 120, 90, 40, "D1 Schottky", [], False, {"A": (230, 140, "L"), "K": (320, 140, "R")}, False),
    "U1": (380, 90, 230, 190, "U1 TP4056 charger", [
        "DW01A + FS8205 protection", "cuts off on over-discharge", "and short circuit.",
        "TEMP pin not used: no", "thermal cutoff (field risk).", "Rprog sets charge current."], False,
        {"IN+": (380, 140, "L"), "OUT+": (610, 110, "R"), "B+": (440, 280, "B"), "B-": (550, 280, "B")}, True),
    "BT1": (380, 340, 230, 78, "BT1 18650 Li-ion cell", ["protected cell or module", "protection; capacity: datasheet"], False,
            {"+": (440, 340, "T"), "-": (550, 340, "T")}, True),
    "F1": (650, 92, 60, 36, "F1 fuse", [], False, {"1": (650, 110, "L"), "2": (710, 110, "R")}, False),
    "SW1": (740, 92, 60, 36, "SW1", [], False, {"1": (740, 110, "L"), "2": (800, 110, "R")}, False),
    "U2": (800, 150, 150, 84, "U2 LDO 3V3", ["low Iq, Wi-Fi peaks"], False, {"VIN": (830, 150, "T"), "VOUT": (900, 234, "B")}, True),
    "Q2": (1060, 150, 130, 84, "Q2 P-FET", ["sensor power"], False, {"S": (1105, 150, "T"), "G": (1060, 180, "L"), "D": (1190, 190, "R")}, True),
    "U3": (1230, 150, 150, 64, "U3 5V boost", ["MT3608 type"], False, {"IN": (1230, 190, "L"), "OUT": (1380, 190, "R")}, True),
    "Q1": (1450, 150, 130, 84, "Q1 P-FET", ["GSM power"], False, {"S": (1505, 150, "T"), "G": (1450, 180, "L"), "D": (1505, 234, "B")}, True),
    "C2": (1515, 355, 115, 56, "C2 bulk cap", ["+ 100 nF, low ESR"], False, {"+": (1515, 385, "L")}, False),
    "U0": (640, 470, 300, 410, "U0 ESP32 DevKit", ["field unit: bare module", "(verify)"], False, {}, False),
    "R78": (400, 500, 200, 50, "R7/R8 divider + C3", ["high value, calibrate"], False, {"IN": (400, 520, "L"), "MID": (600, 520, "R")}, False),
    "SW2": (400, 580, 200, 44, "SW2 lid / tamper", ["wakes ESP32 (ext0)"], False, {"OUT": (600, 600, "R")}, False),
    "SW3": (400, 640, 200, 44, "SW3 sample now", ["maintenance button"], False, {"OUT": (600, 660, "R")}, False),
    "CHG": (400, 700, 200, 44, "optional: CHRG sense", ["needs isolation (verify)"], True, {"OUT": (600, 720, "R")}, False),
    "R34": (990, 540, 130, 40, "R3 1k / R4 2k", ["echo 5V to 3V3"], False, {"A": (990, 560, "L"), "B": (1120, 560, "R")}, False),
    "M1": (1200, 500, 210, 90, "M1 JSN-SR04T", ["waterproof probe + board", "blind zone: datasheet"], False,
           {"TRIG": (1200, 520, "L"), "ECHO": (1200, 560, "L"), "VCC": (1390, 500, "T")}, True),
    "B1": (1200, 600, 200, 44, "B1 DS18B20 probe", ["VDD from 3V3"], False, {"DQ": (1200, 620, "L")}, True),
    "R2": (1140, 630, 24, 36, "", [], False, {"1": (1152, 620, "T"), "2": (1152, 666, "B")}, False),
    "R56": (990, 720, 130, 40, "R5 1k / R6 2k", ["level shift (verify)"], False, {"A": (990, 740, "L"), "B": (1120, 740, "R")}, False),
    "M3": (1200, 670, 200, 170, "M3 SIM800L (2G)", ["VCC from VBAT via Q1", "peaks: bulk cap C2", "external antenna", "2G per operator: verify"], False,
           {"TXD": (1200, 690, "L"), "RXD": (1200, 740, "L"), "VCC": (1400, 690, "R")}, True),
    "BENCH": (640, 930, 300, 90, "bench / maintenance only", ["OLED SDA D21, SCL D22", "LEDs FULL D13, HEAT D14", "NET D19, CHARGE D23"], True,
              {"D21": (670, 930, "T"), "D22": (720, 930, "T"), "D13": (770, 930, "T"), "D14": (820, 930, "T"), "D19": (870, 930, "T"), "D23": (915, 930, "T")}, False),
}

# ESP32 pins: gpio -> (x, y, side, field function, net, wokwi reference or None, change note)
ESP_PINS = {
    "3V3": (900, 470, "T", "3V3 supply in", "3V3", None, ""),
    "D34": (640, 520, "L", "VBAT_SNS", "VBAT_SNS", "battery:SIG", "Δ: reads VBAT through R7/R8, not a pot"),
    "D27": (640, 600, "L", "TAMPER", "TAMPER", "network:2", "Δ: lid/tamper switch, ext0 wake (was NETWORK slide switch)"),
    "D25": (640, 660, "L", "SAMPLE", "SAMPLE", "sample:2.l", ""),
    "D26": (640, 720, "L", "CHRG_SNS (optional)", "CHRG_SNS", "solar:2", "Δ: optional charger sense (was SOLAR slide switch)"),
    "D5": (940, 520, "R", "TRIG", "TRIG", "ultra:TRIG", ""),
    "D18": (940, 560, "R", "ECHO", "ECHO", "ultra:ECHO", "Δ: echo through R3/R4 divider"),
    "D4": (940, 620, "R", "DQ", "DQ", "temp:DQ", ""),
    "D16": (940, 690, "R", "RX2 (from SIM TXD)", "SIM_TXD", None, "Δ: new, modem UART2"),
    "D17": (940, 740, "R", "TX2 (to SIM RXD)", "TX2", None, "Δ: new, modem UART2"),
    "D32": (940, 790, "R", "SENS_EN", "SENS_EN", None, "Δ: new, sensor power gate"),
    "D33": (940, 830, "R", "GSM_EN", "GSM_EN", None, "Δ: new, modem power gate"),
    "D21": (670, 880, "B", "OLED SDA (bench)", "OLED_SDA", "oled:SDA", ""),
    "D22": (720, 880, "B", "OLED SCL (bench)", "OLED_SCL", "oled:SCL", ""),
    "D13": (770, 880, "B", "LED FULL (bench)", "LED_FULL", "rfull:1", ""),
    "D14": (820, 880, "B", "LED HEAT (bench)", "LED_HEAT", "rheat:1", ""),
    "D19": (870, 880, "B", "LED NET (bench)", "LED_NET", "rstatus:1", ""),
    "D23": (915, 880, "B", "LED CHARGE (bench)", "LED_CHARGE", "rcharge:1", ""),
}

# (net, points, colour, dashed, label (x, y, anchor[, text]) or None)
WIRES = [
    ("PV", [(190, 140), (230, 140)], C_PWR, False, (210, 132, "middle")),
    ("PV_D", [(320, 140), (380, 140)], C_PWR, False, (350, 132, "middle")),
    ("BAT_P", [(440, 280), (440, 340)], C_PWR, False, (446, 314, "start", "BAT+")),
    ("BAT_N", [(550, 280), (550, 340)], C_PWR, False, (556, 314, "start", "BAT-")),
    ("VBAT_RAW", [(610, 110), (650, 110)], C_PWR, False, None),
    ("VBAT_F", [(710, 110), (740, 110)], C_PWR, False, None),
    ("VBAT", [(800, 110), (1505, 110)], C_PWR, False, (880, 102, "start")),
    ("VBAT", [(830, 110), (830, 150)], C_PWR, False, None),
    ("VBAT", [(1105, 110), (1105, 150)], C_PWR, False, None),
    ("VBAT", [(1505, 110), (1505, 150)], C_PWR, False, None),
    ("3V3", [(900, 234), (900, 470)], C_PWR, False, (908, 300, "start")),
    ("VBAT_S", [(1190, 190), (1230, 190)], C_PWR, False, None),
    ("5V_S", [(1380, 190), (1390, 190), (1390, 500)], C_AUX, False, (1398, 300, "start")),
    ("SENS_EN", [(1020, 180), (1060, 180)], C_SIG, False, (1008, 172, "start")),
    ("SENS_EN", [(940, 790), (985, 790)], C_SIG, False, (990, 794, "start", "SENS_EN > Q2 gate")),
    ("GSM_EN", [(940, 830), (985, 830)], C_SIG, False, (990, 834, "start", "GSM_EN > Q1 gate")),
    ("GSM_EN", [(1404, 180), (1450, 180)], C_SIG, False, (1404, 172, "start")),
    ("GSM_VCC", [(1505, 234), (1505, 690), (1400, 690)], C_PWR, False, (1513, 300, "start")),
    ("GSM_VCC", [(1505, 385), (1515, 385)], C_PWR, False, None),
    ("TRIG", [(940, 520), (1200, 520)], C_SIG, False, (1050, 512, "middle")),
    ("ECHO", [(940, 560), (990, 560)], C_SIG, False, (965, 552, "middle")),
    ("ECHO_5V", [(1120, 560), (1200, 560)], C_AUX, False, (1160, 552, "middle")),
    ("DQ", [(940, 620), (1200, 620)], C_SIG, False, (1010, 612, "middle")),
    ("SIM_TXD", [(940, 690), (1200, 690)], C_SIG, False, (1050, 682, "middle")),
    ("TX2", [(940, 740), (990, 740)], C_SIG, False, (965, 732, "middle")),
    ("SIM_RXD", [(1120, 740), (1200, 740)], C_SIG, False, (1160, 732, "middle")),
    ("3V3", [(1152, 666), (1152, 676)], C_PWR, False, (1158, 681, "start")),
    ("VBAT_SNS", [(600, 520), (640, 520)], C_SIG, False, None),
    ("VBAT", [(370, 520), (400, 520)], C_PWR, False, (385, 512, "middle")),
    ("TAMPER", [(600, 600), (640, 600)], C_SIG, False, None),
    ("SAMPLE", [(600, 660), (640, 660)], C_SIG, False, None),
    ("CHRG_SNS", [(600, 720), (640, 720)], C_SIG, True, None),
    ("BENCH", [(670, 880), (670, 930)], C_MUTE, True, None),
    ("BENCH", [(720, 880), (720, 930)], C_MUTE, True, None),
    ("BENCH", [(770, 880), (770, 930)], C_MUTE, True, None),
    ("BENCH", [(820, 880), (820, 930)], C_MUTE, True, None),
    ("BENCH", [(870, 880), (870, 930)], C_MUTE, True, None),
    ("BENCH", [(915, 880), (915, 930)], C_MUTE, True, None),
]
JUNCTIONS = [(830, 110), (1105, 110), (1505, 385), (1152, 620)]

NOTES = [
    (20, 250, 340, 190, "Deep-sleep cycle", [
        "Timer wake every intervalMin (from server).",
        "ext0 wake on lid / tamper switch D27.",
        "GSM and sensors unpowered while asleep.",
        "Order: SENS_EN on, warm-up, measure,",
        "GSM_EN on, send, both off, sleep.",
        "Warm-up time: datasheet, to verify."]),
    (20, 460, 340, 150, "Status of this drawing", [
        "Rev A: paper design, not bench-tested.",
        "Items marked verify need a datasheet",
        "check or a bench measurement.",
        "GND is common to all blocks (not drawn).",
        "Bench parts match hardware/wokwi."]),
]

NETS = {
    "PV": ["PV.PV+", "D1.A"],
    "PV_D": ["D1.K", "U1.IN+"],
    "BAT_P": ["U1.B+", "BT1.+"],
    "BAT_N": ["U1.B-", "BT1.-"],
    "VBAT_RAW": ["U1.OUT+", "F1.1"],
    "VBAT_F": ["F1.2", "SW1.1"],
    "VBAT": ["SW1.2", "U2.VIN", "Q2.S", "Q1.S", "R78.IN"],
    "3V3": ["U2.VOUT", "U0.3V3", "B1.VDD", "R2.2"],
    "VBAT_S": ["Q2.D", "U3.IN"],
    "5V_S": ["U3.OUT", "M1.VCC"],
    "GSM_VCC": ["Q1.D", "M3.VCC", "C2.+"],
    "SENS_EN": ["U0.D32", "Q2.G"],
    "GSM_EN": ["U0.D33", "Q1.G"],
    "TRIG": ["U0.D5", "M1.TRIG"],
    "ECHO_5V": ["M1.ECHO", "R34.B"],
    "ECHO": ["R34.A", "U0.D18"],
    "DQ": ["U0.D4", "B1.DQ", "R2.1"],
    "TX2": ["U0.D17", "R56.A"],
    "SIM_RXD": ["R56.B", "M3.RXD"],
    "SIM_TXD": ["M3.TXD", "U0.D16"],
    "VBAT_SNS": ["R78.MID", "U0.D34"],
    "TAMPER": ["SW2.OUT", "U0.D27"],
    "SAMPLE": ["SW3.OUT", "U0.D25"],
    "CHRG_SNS": ["CHG.OUT", "U0.D26"],
    "OLED_SDA": ["U0.D21", "BENCH.D21"],
    "OLED_SCL": ["U0.D22", "BENCH.D22"],
    "LED_FULL": ["U0.D13", "BENCH.D13"],
    "LED_HEAT": ["U0.D14", "BENCH.D14"],
    "LED_NET": ["U0.D19", "BENCH.D19"],
    "LED_CHARGE": ["U0.D23", "BENCH.D23"],
    "GND": ["all blocks (common return, not drawn)"],
}


def t(x, y, s, size=12, anchor="start", weight="normal", fill=C_TXT, extra=""):
    return (f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" '
            f'font-weight="{weight}" fill="{fill}"{extra}>{escape(s)}</text>')


def pin_label(px, py, side, name):
    if side == "L":
        return t(px + 6, py + 4, name, 11, "start", fill=C_MUTE)
    if side == "R":
        return t(px - 6, py + 4, name, 11, "end", fill=C_MUTE)
    if side == "T":
        return t(px, py + 15, name, 11, "middle", fill=C_MUTE)
    return t(px, py - 6, name, 11, "middle", fill=C_MUTE)


def render_svg():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
         f'font-family="Arial, Helvetica, sans-serif" role="img" aria-labelledby="ttl">',
         '<title id="ttl">CityCycle smart bin field wiring, rev A, not bench-validated</title>',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         t(20, 34, "CityCycle smart bin: field wiring, rev A", 24, weight="bold"),
         t(20, 58, "NOT bench-validated. Prices and values marked verify are not confirmed.", 14, fill=C_MUTE),
         t(W - 20, 34, "الصندوق الذكي: توصيلات الحقل (نسخة أ، غير مختبرة على المنضدة)", 18, "start", "bold",
           extra=' direction="rtl" unicode-bidi="plaintext"')]
    for x, y, w, h, title, lines in NOTES:
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="#f6f6f2" stroke="#999" stroke-width="1"/>')
        o.append(t(x + 10, y + 22, title, 13, weight="bold"))
        for i, ln in enumerate(lines):
            o.append(t(x + 10, y + 44 + i * 20, ln, 12))
    for pid in sorted(PARTS):
        x, y, w, h, title, lines, bench, pins, labels = PARTS[pid]
        dash = ' stroke-dasharray="7 4"' if bench else ""
        fill = "#f3f3f3" if bench else "#fbfdf8"
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{fill}" stroke="{C_MUTE if bench else C_TXT}" stroke-width="1.6"{dash}/>')
        if pid == "U0":
            o.append(t(x + w / 2, y + 22, title, 14, "middle", "bold"))
            for i, ln in enumerate(lines):
                o.append(t(x + w / 2, y + 40 + i * 15, ln, 11, "middle", fill=C_MUTE))
        elif title:
            tx = x + (42 if labels and any(p[2] == "L" for p in pins.values()) else 8)
            ty = y + 17 + (16 if labels and any(p[2] == "T" for p in pins.values()) else 0)
            o.append(t(tx, ty, title, 13, weight="bold"))
            for i, ln in enumerate(lines):
                o.append(t(tx, ty + 17 + i * 15, ln, 11.5))
        for pn, (px, py, side) in pins.items():
            o.append(f'<circle cx="{px}" cy="{py}" r="3" fill="{C_TXT}"/>')
            if labels:
                o.append(pin_label(px, py, side, pn))
    for gpio in sorted(ESP_PINS):
        px, py, side, func, _net, _wk, _delta = ESP_PINS[gpio]
        o.append(f'<circle cx="{px}" cy="{py}" r="3" fill="{C_TXT}"/>')
        if side == "L":
            o.append(t(px + 8, py + 4, f"{gpio} {func}", 11.5, "start"))
        elif side == "R":
            o.append(t(px - 8, py + 4, f"{func} {gpio}", 11.5, "end"))
        elif side == "T":
            o.append(t(px, py + 16, gpio, 11.5, "middle"))
        else:
            o.append(t(px, py - 8, gpio, 11.5, "middle"))
    for net, pts, col, dashed, lab in WIRES:
        d = "M " + " L ".join(f"{x} {y}" for x, y in pts)
        da = ' stroke-dasharray="6 4"' if dashed else ""
        o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="2"{da}/>')
        if lab:
            o.append(t(lab[0], lab[1], lab[3] if len(lab) > 3 else net, 11.5, lab[2], "bold", col))
    for jx, jy in JUNCTIONS:
        o.append(f'<circle cx="{jx}" cy="{jy}" r="4" fill="{C_SIG if jy == 620 else C_PWR}"/>')
    o.append(t(1134, 652, "R2 4.7k pull-up", 11.5, "end"))
    lx, ly = 1000, 900
    o.append(f'<rect x="{lx}" y="{ly}" width="580" height="115" rx="6" fill="#ffffff" stroke="{C_TXT}" stroke-width="1.6"/>')
    o.append(t(lx + 12, ly + 22, "CityCycle smart bin, field wiring, rev A", 14, weight="bold"))
    o.append(t(lx + 12, ly + 40, "Generated by build_schematic.py. Not bench-validated.", 11.5, fill=C_MUTE))
    items = [(C_PWR, False, "battery / power"), (C_SIG, False, "signal"), (C_AUX, False, "5V switched"), (C_MUTE, True, "bench / demo only")]
    for i, (c, dsh, lab) in enumerate(items):
        x0 = lx + 12 + (i % 2) * 280
        y0 = ly + 66 + (i // 2) * 24
        da = ' stroke-dasharray="6 4"' if dsh else ""
        o.append(f'<path d="M {x0} {y0} L {x0 + 40} {y0}" stroke="{c}" stroke-width="2.5"{da}/>')
        o.append(t(x0 + 50, y0 + 4, lab, 12))
    o.append("</svg>")
    return "\n".join(o) + "\n"


def render_tables():
    rows = ["### Pin table (ESP32 DevKit)", "",
            "The Wokwi column names the `hardware/wokwi/smart-bin/diagram.json` connection for the same function. Rows changed from the simulator are marked Δ.", "",
            "| GPIO | Field function | Net | Wokwi connection | Change |", "| --- | --- | --- | --- | --- |"]
    order = sorted(ESP_PINS, key=lambda g: (g != "3V3", int(g[1:]) if g[0] == "D" else 0))
    for g in order:
        _x, _y, _s, func, net, wk, delta = ESP_PINS[g]
        wok = f"`esp:{g}` to `{wk}`" if wk else "none (new)"
        rows.append(f"| {g} | {func} | `{net}` | {wok} | {delta or 'same as Wokwi'} |")
    rows += ["", "### Netlist", "", "| Net | Pins |", "| --- | --- |"]
    for n in sorted(NETS):
        rows.append(f"| `{n}` | {', '.join(NETS[n])} |")
    return "\n".join(rows) + "\n"


def updated_readme(current):
    if BEGIN not in current or END not in current:
        raise SystemExit("README.md is missing the GENERATED markers")
    head, rest = current.split(BEGIN, 1)
    tail = rest.split(END, 1)[1]
    return f"{head}{BEGIN}\n\n{render_tables()}\n{END}{tail}"


def main(argv):
    svg = render_svg()
    readme = updated_readme(README_PATH.read_text(encoding="utf-8"))
    if "--check" in argv:
        ok = (SVG_PATH.exists() and SVG_PATH.read_text(encoding="utf-8") == svg
              and README_PATH.read_text(encoding="utf-8") == readme)
        print("schematic up to date" if ok else "schematic OUT OF DATE: run build_schematic.py")
        return 0 if ok else 1
    SVG_PATH.write_text(svg, encoding="utf-8")
    README_PATH.write_text(readme, encoding="utf-8")
    print(f"wrote {SVG_PATH.name} and tables in {README_PATH.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
