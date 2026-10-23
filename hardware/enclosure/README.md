# Enclosure and mounting notes

Design notes only. There are no 3D files in this package: a printed bracket is optional and can be drawn once the box and sensor are chosen. **The assembled unit is unverified**: nothing below has been tested on a real bin.

## Box

- An off-the-shelf ABS or PC junction box with a gasket (BOM line B20, size and price to verify).
- **IP rating: use the manufacturer's label only.** Drilling gland holes and a sensor opening changes the box, so the assembled unit has no rating until it passes the tests below.
- Light colour, mounted shaded under the bin lid. Breather vent plug only (B22): do not leave open holes.

## Mounting

- Electronics tray under the bin lid. The fill sensor faces down through a sealed gland, or its transducer head is exposed and the cable is glanded (see the probe datasheet).
- Mount the sensor above the full line by at least its blind zone (datasheet, verify), looking at the waste surface, not at the bin wall.
- Solar panel on the lid top under a perforated steel guard; note its tilt and orientation in the pilot record.
- External antenna on a plastic part of the lid (a metal bin attenuates the signal).

## Vandal and theft resistance

- Security (pin-Torx type) screws (B23), no visible valuables, cable in conduit.
- The tamper switch (D27) wakes the ESP32 when the lid opens; what the server does with that event is not built yet.

## Heat and dust

- Keep the battery away from the charger board and out of direct sun. Li-ion charge-temperature limits come from the cell datasheet (verify).
- Lower the TP4056 charge current with the programming resistor (formula in the TP4056 datasheet). The module has no thermal cutoff.
- A LiFePO4 cell tolerates heat better than Li-ion; check cell availability and the charger (a different charge profile) before switching. To verify.
- Conformal coating on the boards (B25) and silica gel (B26) inside; clean the sensor face on every maintenance visit.
- Optional printed brackets: use PETG or ASA, not PLA. Check the heat deflection temperature on the filament datasheet (verify).

## Test procedure before any pilot

Run each test on the assembled unit, not on the empty box. Record the result and the date.

1. **Dust:** place in a dust chamber or a sealed bin with fine sand and air movement for a set time, open, check for ingress and that the sensor still reads. Set the time and the dust type in the log.
2. **Splash and hose:** spray from several directions as street washing would, with the lid closed; open and check for water. Log the duration and the distance.
3. **Heat soak in the sun:** leave the closed unit in direct sun on a hot day with a temperature logger inside next to the cell and the charger. Log the peak and compare it with the cell datasheet limits.
4. **Fit and vibration:** shake and drop-test the tray; check that connectors, the cell holder and the antenna stay seated.
