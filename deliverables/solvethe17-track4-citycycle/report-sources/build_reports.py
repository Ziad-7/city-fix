"""Export the submission reports. Does not modify apps, supplier evidence or slides."""
import argparse
import base64
import csv
import html
import re
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

import markdown
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

HERE = Path(__file__).resolve().parent
PACKAGE = HERE.parent
ROOT = PACKAGE.parents[1]

def make_budget():
    source = ROOT / "hardware/bom/bom.csv"
    items = list(csv.DictReader(source.open(encoding="utf-8")))
    rows = []
    for item in items:
        qty = int(item["qty_per_bin"])
        value = Decimal(item["unit_price_egp"]) if item["unit_price_egp"] else None
        rows.append(dict(id=item["line_id"], item=item["part"], specification=item["spec"], quantity=qty,
                         unit_price_egp=str(value) if value is not None else "",
                         total_egp=str(value * qty) if value is not None else "",
                         category=item["block"], supplier=item["supplier"], source_url=item["supplier_url"],
                         date=item["price_date"], evidence=item["evidence"]))
    with (PACKAGE / "CityFix-BOM-Estimate.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    selected = [r for r in rows if r["category"] not in ("alternative", "running_cost") and r["total_egp"]]
    subtotal = sum((Decimal(r["total_egp"]) for r in selected), Decimal(0))
    monthly = sum((Decimal(r["total_egp"]) for r in rows if r["category"] == "running_cost" and r["total_egp"]), Decimal(0))
    unknown = [r for r in rows if not r["unit_price_egp"] and r["category"] != "alternative"]
    summary = ("| Cost scope | EGP |\n| --- | ---: |\n"
               f"| Smart-bin priced components subtotal (custom mount excluded) | {subtotal:,.2f} |\n"
               f"| Calendar-month data reference, derived from 37 EGP/28 days | {monthly:,.2f} |\n"
               "| Custom lid / sensor mount | Workshop quote required |\n")
    report = """# BOM with sourced EGP prices

Prepared 2026-10-23. The table uses published Egyptian supplier prices for the exact item or set specified in the CSV. It replaces the earlier planning allowances. Prices are evidence for a budget, not proof that the circuit is field-ready. See [dated price research](../../hardware/bom/price-research-2026-10-23.json).

## Cost summary

""" + summary + """
## Scope

The BOM has 26 priced rows and one custom-work row still requiring a quote. The optional LTE alternative is excluded from the bin subtotal. No full installed-cost or payback claim is made. Component specifications and the solar/power circuit still need validation. The source register records which figures were read from product pages, indexed supplier listings or derived from multiple published prices.

The 37 EGP Vodafone reference renews every 28 days: 37 × 365 ÷ 28 ÷ 12 = 40.19 EGP per average calendar month. Activation, business IoT terms and applicable recharge charges need operator confirmation. This is not a committed IoT service offer.

Delivery, taxes not included by a supplier, installation, labour, vehicles, existing bin/phone/computer assets, calibration, further wiring and power-design substitutions are outside the component subtotal. The custom mount has no verifiable fixed price until dimensions and fabrication method are agreed; it is not counted as free.

## Itemized component prices

| ID | Item | Quantity | Unit EGP | Total EGP | Supplier |
| --- | --- | ---: | ---: | ---: | --- |
"""
    for r in rows:
        price = r["unit_price_egp"] or "Quote required"
        total = r["total_egp"] or "—"
        supplier = f"[{r['supplier']}]({r['source_url']})" if r["source_url"] else "Custom workshop"
        report += f"| {r['id']} | {r['item']} | {r['quantity']} | {price} | {total} | {supplier} |\n"
    report += """
## Optional hub-scale reference

The current Wokwi scale is a simulation. Published component references: ESP32 280 EGP, 50 kg bar load cell 350 EGP, HX711 75 EGP, giving a **705 EGP component subset**, not a complete scale. Platform fabrication, supply, display/controls, calibration and integration still need a design and quote. See the research register for supplier URLs. The HX711 product-page reference is used rather than a conflicting category price.

## Completing the only unpriced bin row

B24 is a custom lid bracket and sensor mount. A real value requires the selected bin dimensions, a finished mounting drawing and a local workshop quotation. No unrelated sensor bracket is substituted and no fabricated price is entered. Obtain that quote before claiming a complete installed-hardware budget.
"""
    (PACKAGE / "COST-ESTIMATE.md").write_text(report, encoding="utf-8")
    assert len(unknown) == 1 and unknown[0]["id"] == "B24"
    return summary, report


CSS = """
@page{size:A4;margin:15mm}body{font:10pt/1.45 Arial,sans-serif;color:#182c28;margin:0}
h1{font-size:23pt;line-height:1.15;color:#155b45}h2{font-size:15pt;color:#155b45;break-before:page;margin-top:0}h3{font-size:12pt;color:#155b45}
table{border-collapse:collapse;width:100%;font-size:8.5pt;margin:3mm 0}th,td{border:1px solid #cbd7d0;padding:1.6mm;text-align:left;vertical-align:top}th{background:#edf4ef}tr{break-inside:avoid}
img{display:block;max-width:100%;height:auto;margin:3mm auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:8.5pt/1.4 monospace;background:#f2f5f3;padding:3mm;break-inside:avoid}a{color:#155b45;overflow-wrap:anywhere}p,li{orphans:3;widows:3}code{font-size:9pt} .meta{font-size:8pt;color:#52645d}
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--chromium")
    parser.add_argument("--ref", default="main", help="GitHub ref for report hyperlinks")
    args = parser.parse_args()
    summary, cost = make_budget()
    text = (PACKAGE / "TECHNICAL-DOCUMENTATION.md").read_text(encoding="utf-8")
    # Include the full estimated BOM in the PDF, not only a link to a CSV.
    text = text.replace("Totals are generated into the cost report.", summary + "\nTotals are generated into the cost report.")
    text += "\n\n## Appendix: estimated EGP budget and line items\n\n" + cost.replace("# Estimated BOM and cost methodology — EGP", "", 1).replace("\n## ", "\n### ")
    body = markdown.markdown(text, extensions=["tables", "fenced_code"])

    def embed(match):
        src = match.group(1)
        path = (PACKAGE / src).resolve()
        if path.suffix == ".svg" and path.is_file():
            data = base64.b64encode(path.read_bytes()).decode()
            return f'src="data:image/svg+xml;base64,{data}"'
        return match.group(0)

    body = re.sub(r'src="([^"]+)"', embed, body)
    def repo_link(match):
        target = match.group(1)
        if target.startswith(("https:", "http:", "#", "mailto:")):
            return match.group(0)
        relative = (PACKAGE / target.split("#")[0]).resolve().relative_to(ROOT)
        anchor = "#" + target.split("#", 1)[1] if "#" in target else ""
        return f'href="https://github.com/Ziad-7/city-fix/blob/{args.ref}/{quote(str(relative))}{anchor}"'
    body = re.sub(r'href="([^"]+)"', repo_link, body)
    document = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>CityFix Technical Documentation</title><style>{CSS}</style></head><body><p class="meta">SOLVETHE17 · TRACK 4 · SOFTWARE PROOF OF CONCEPT / SIMULATED HARDWARE · 2026-10-23</p>{body}</body></html>'
    output = HERE / "technical-documentation.html"
    output.write_text(document, encoding="utf-8")

    with sync_playwright() as p:
        options = {"headless": True, "args": ["--no-sandbox"]}
        if args.chromium:
            options["executable_path"] = args.chromium
        browser = p.chromium.launch(**options)
        page = browser.new_page()
        page.set_content(document, wait_until="load")
        page.pdf(path=str(PACKAGE / "CityFix-Technical-Documentation.pdf"), prefer_css_page_size=True, print_background=True)
        page.set_content((HERE / "field-brief.html").read_text(encoding="utf-8"), wait_until="load")
        page.pdf(path=str(PACKAGE / "CityFix-Field-Deployment-Brief.pdf"), prefer_css_page_size=True, print_background=True)
        svg = (ROOT / "hardware/schematics/smart-bin.svg").read_text(encoding="utf-8")
        page.set_content('<style>@page{size:A3 landscape;margin:10mm}body{margin:0}svg{width:100%;height:auto}</style>' + svg)
        page.pdf(path=str(PACKAGE / "CityFix-Circuit-Diagram.pdf"), prefer_css_page_size=True, print_background=True)
        browser.close()

    brief = PdfReader(PACKAGE / "CityFix-Field-Deployment-Brief.pdf")
    assert len(brief.pages) == 2, f"Field brief must have exactly 2 pages, got {len(brief.pages)}"
    assert "Egyptian conditions" in brief.pages[0].extract_text()
    assert "Pilot gates" in brief.pages[1].extract_text()
    technical = PdfReader(PACKAGE / "CityFix-Technical-Documentation.pdf")
    technical_text = " ".join(" ".join(p.extract_text() for p in technical.pages).split())
    for phrase in ("System architecture", "Process flowcharts", "Bill of Materials", "B28", "B24", "sourced EGP prices"):
        assert phrase.lower() in technical_text.lower(), f"Missing technical report content: {phrase}"
    assert len(PdfReader(PACKAGE / "CityFix-Circuit-Diagram.pdf").pages) == 1
    print(f"Exported technical documentation ({len(technical.pages)} pages), field brief (2 A4 pages), circuit (1 A3 page), and EGP estimate.")
    print(summary)


if __name__ == "__main__":
    main()
