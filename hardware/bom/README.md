# Bill of Materials (EGP)

[`bom.csv`](bom.csv) is the source of truth. **Retail prices are recorded for all standard rows; the custom lid/sensor mount still needs a workshop quote. The subtotal is not a complete installed-system cost.**

## Method

- EGP prices, supplier links and dates are recorded per item. The October 23 research is in [price-research-2026-10-23.json](price-research-2026-10-23.json); it distinguishes product-page evidence, indexed supplier prices and arithmetic derived from listings.
- A listed price confirms price evidence, not field suitability. Component ratings, calibration, wiring fit and power design still require validation.
- Quantities refer to the exact priced item or set described in `spec`. No currency conversions or invented supplier prices are used.
- The tariff reference is 37 EGP per 28 days; its annualized calendar-month equivalent is 40.19 EGP. Activation, recharge charges and business IoT terms need operator confirmation.
- The custom bracket (B24) remains unpriced: no dimensions, finished CAD or verifiable workshop quote exist. It is not silently counted as free.
- Alternative LTE hardware is recorded but excluded from the bin subtotal.

## Totals (output of `bom_totals.py`)

```text
BOM lines counted: 27 (sourced 26, to_verify 1); alternatives listed but not counted: 1
One-time hardware, sourced lines only: 7243.00 EGP
Monthly running cost, sourced lines only: 40.19 EGP
PARTIAL: not a per-bin cost. Lines still to verify:
  B24 (one-time) Lid bracket and sensor mount
Prices are EGP as listed by the supplier on the stated date; nothing converted from another currency.
```

The total is a one-off component basket, including full consumable/fastener sets. It is not an optimized per-bin production cost. Labour, delivery, taxes not included in a listing, installation, required power-design substitutions and unfinished custom work are outside the subtotal.

## Running the check

```bash
python3 hardware/bom/bom_totals.py
```

It validates the schema (price present exactly when `sourced`, ISO date, https URL, quantity above zero), prints the subtotal and every unsourced line, and exits non-zero on a schema error.

## Payback (formula only)

```text
BOM lines counted: 27 (sourced 26, to_verify 1); alternatives listed but not counted: 1
One-time hardware, sourced lines only: 7243.00 EGP
Monthly running cost, sourced lines only: 40.19 EGP
PARTIAL: not a per-bin cost. Lines still to verify:
  B24 (one-time) Lid bracket and sensor mount
Prices are EGP as listed by the supplier on the stated date; nothing converted from another currency.
```

| Variable | Value | Source |
| --- | --- | --- |
| `bin_hw_cost` | to verify (needs every line sourced) | this BOM |
| `avoided_trips_per_month` | to verify with the district | pilot data |
| `cost_per_trip` | to verify with the district | district or contractor |
| `monthly_running_cost` | to verify (B19 data plan and others) | operator quote |

No payback figure is given: three of the four inputs are unknown.
