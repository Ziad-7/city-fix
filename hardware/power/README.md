# Power and battery life

**Nothing here is measured yet.** This page has the formulas and the blank table the bench fills in. Battery life and solar sufficiency are unknown until then; no number from this page may be quoted as a result.

## Formulas

```text
T          = intervalMin x 60                     (seconds per cycle; intervalMin comes from the server)
I_avg      = (I_sleep x t_sleep + I_sense x t_sense + I_tx x t_tx) / T
C_usable   = C_rated x k_temp x k_age x k_cutoff
days       = C_usable / (I_avg x 24)              (C in mAh, I in mA)
E_in/day   = P_panel x PSH x eta_charge           (Wh per day)
E_out/day  = I_avg x V_batt x 24 / 1000           (Wh per day)
```

Solar is enough only if `E_in/day` exceeds `E_out/day` on the worst days (dusty, shaded). Include the constant drain of the battery divider (VBAT / (R7+R8)) in `I_sleep`.

## Placeholder table

Every value is empty on purpose. Fill the source column with `measured`, `datasheet` (name the document) or `to verify`.

| Symbol | Meaning | Value | Unit | Source | How to measure |
| --- | --- | --- | --- | --- | --- |
| I_sleep | whole unit, deep sleep, modem and sensors off | | mA | | Series meter on the battery lead, 10 minutes after sleep begins |
| I_sense | during a fill + temperature reading | | mA | | Meter plus a log of one cycle; warm-up time from the datasheet |
| t_sense | duration of one reading cycle | | s | | Serial timestamps |
| I_tx | modem registered and sending | | mA | | Scope or logging meter (see below) |
| t_tx | time to register and send | | s | | Serial timestamps; repeat in weak signal |
| C_rated | cell capacity | | mAh | | Cell datasheet; check by a discharge run |
| k_temp | capacity factor at the bin's temperature | | none | | Cell datasheet curve, to verify |
| k_age | capacity factor after cycling | | none | | Cell datasheet, to verify |
| k_cutoff | share usable above the cutoff voltage | | none | | Discharge run to the protection cutoff |
| P_panel | panel rated power | | W | | Panel label |
| PSH | peak sun hours per day (Cairo and other districts) | | h | | A cited irradiance source, to verify |
| eta_charge | panel-to-cell efficiency, including soiling | | none | | Measure charge energy over a clean day and a dusty day |

## Procedure

1. Use a USB power meter, or a multimeter in series, or a shunt resistor with a logger. Note the instrument in the log.
2. Measure each state separately: deep sleep, sensors on, modem registering, modem sending.
3. **A multimeter misses short current bursts.** The modem draws brief high peaks when it transmits; capture them with a logging meter or a scope on a shunt, and check that the 3V3 rail and the modem supply do not sag.
4. Run a full discharge with the logger. Record cell voltage and temperature over time.
5. Repeat at a high ambient temperature (a shaded enclosure in the sun, with a temperature logger inside).

## Templates

- [`bench-log-template.csv`](bench-log-template.csv): one row per measurement (current per state).
- [`discharge-log-template.csv`](discharge-log-template.csv): one row per time step for a discharge run.
