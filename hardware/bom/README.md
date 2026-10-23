# Bill of Materials (EGP)

[`bom.csv`](bom.csv) is the source of truth. **It is partial: most lines are not priced yet, and the total below is not a per-bin cost.**

## Method

- Prices come from Egyptian supplier pages, searched on **2026-10-23** (Makers Electronics was the only supplier that returned usable EGP prices; RAM Electronics, Future Electronics, Amazon.eg and Noon returned nothing usable in those searches).
- Evidence type for every sourced line is `search_snippet`: the price was read from a web-search result for the supplier's page, **not from a page opened in a browser**. Confirm on the live page before buying.
- A line is `sourced` only with a price, supplier URL, ISO date and evidence type. Everything else is `to_verify` with an **empty** price. Nothing is estimated, and nothing is converted from another currency.
- Quantity-tier prices are used only where a supplier lists them (none are used yet).
- Block `alternative` lines are listed but never counted. Block `running_cost` (SIM data plan) is monthly and kept apart from the one-time hardware cost.

## Totals (output of `bom_totals.py`)

```text
BOM lines counted: 27 (sourced 11, to_verify 16); alternatives listed but not counted: 1
One-time hardware, sourced lines only: 973.25 EGP
Monthly running cost, sourced lines only: 0.00 EGP
PARTIAL: not a per-bin cost. Lines still to verify:
  B02 (one-time) JSN-SR04T ultrasonic probe
  B04 (one-time) Pull-up resistor 4.7k
  B09 (one-time) Solar panel
  B11 (one-time) Inline fuse and holder
  B12 (one-time) 3.3 V LDO low quiescent
  B15 (one-time) Gate-drive transistor
  B16 (one-time) Bulk capacitor
  B19 (monthly) SIM card and data plan
  B20 (one-time) Weatherproof enclosure
  B22 (one-time) Breather vent plug
  B23 (one-time) Security screws
  B24 (one-time) Lid bracket and sensor mount
  B25 (one-time) Conformal coating
  B26 (one-time) Silica gel sachets
  B27 (one-time) Wiring and connectors
  B28 (one-time) Perfboard or small PCB
Prices are EGP as listed by the supplier on the stated date; nothing converted from another currency.
```

Notes on the sourced lines: B05 is a 600-piece resistor kit counted once per bin, which overstates the per-bin share. The subtotal is therefore neither a floor nor a ceiling.

## Running the check

```bash
python3 hardware/bom/bom_totals.py
```

It validates the schema (price present exactly when `sourced`, ISO date, https URL, quantity above zero), prints the subtotal and every unsourced line, and exits non-zero on a schema error.

## Payback (formula only)

```text
payback_months = bin_hw_cost / (avoided_trips_per_month x cost_per_trip - monthly_running_cost)
```

| Variable | Value | Source |
| --- | --- | --- |
| `bin_hw_cost` | to verify (needs every line sourced) | this BOM |
| `avoided_trips_per_month` | to verify with the district | pilot data |
| `cost_per_trip` | to verify with the district | district or contractor |
| `monthly_running_cost` | to verify (B19 data plan and others) | operator quote |

No payback figure is given: three of the four inputs are unknown.
