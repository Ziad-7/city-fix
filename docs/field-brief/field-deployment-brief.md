# Field Deployment Brief: CityCycle smart bin

**موجز النشر الميداني: الصندوق الذكي (مرحلة التصميم، لم يُختبر في الميدان بعد).**
ملخص: صندوق بطاقة شمسية يقيس الامتلاء والحرارة ويرسل القراءات عبر شبكة الجوال، وهذا الموجز يوضح ما تحقق منه الفريق وما لم يتحقق.

Printable two-page version: [`field-deployment-brief.html`](field-deployment-brief.html). Schematic: [`smart-bin.svg`](../../hardware/schematics/smart-bin.svg).

## What it is and where it stands

A solar-charged bin sensor for Egyptian streets. An ESP32 sleeps most of the time, wakes on a timer, reads fill level (ultrasonic) and temperature, and sends the reading over a SIM800L modem. The district sees which bins are full and which are hot, and collectors can be routed to those instead of to every bin.

**Status, stated plainly:** the logic is verified in a simulator and in host-side native tests. The wiring in this package is a paper design. **No unit has been built, bench-tested or placed on a street.** Nothing below is a field result. The "Verified in" column says where each claim has actually been checked; "none" means it has not.

| Condition | Egyptian risk | Design response | Verified in | How to verify |
| --- | --- | --- | --- | --- |
| Heat | Hot bin and enclosure in summer; Li-ion should not be charged hot, and the charger module has no thermal cutoff | Light, shaded box; lower charge current; heat flag at the sensor; LiFePO4 considered | none | Heat-soak test with a temperature logger next to the cell; compare with the cell datasheet |
| Dust, khamaseen | Dust on the panel and on the ultrasonic face | Sealed box with a breather plug; guard over the panel; sensor face cleaned on each visit | none | Dust test on the assembled unit; measure charge energy on a clean and a dusty day |
| Water, street washing | Hose spray and rain splash | Gasketed box, glands, coating, silica gel | none | Splash test on the assembled unit; the box's IP label is the maker's claim only |
| Weak or no GSM | Poor signal inside a metal bin; 2G service may not exist for every operator | 32-reading buffer with retry; external antenna; LTE Cat-1 modem as the alternative | native test (buffer and retry logic) and simulator | Bench test with signal removed; ask each operator whether 2G is available where the bin stands |
| Power | Shade, soiled panel, too small a battery | Energy budget formula, panel guard, cleaning schedule | none | Measure currents and a discharge run: [`hardware/power/`](../../hardware/power/README.md) |
| Theft, vandalism | Valuables visible, easy to open | Security screws, no visible parts, conduit, lid tamper switch | none | Pilot inspection; check tamper wake on the bench |
| Fire or heat alert | Hot waste, battery fault | Heat flag from the temperature probe; fuse; protection module | none (the flag exists in the simulator sketch only) | Bench test with a warmed probe; fuse and short-circuit test |
| Low literacy | Collectors and residents may not read text | Icon sticker, large bin number, QR code to report | none | Test the sticker with a few collectors and residents |

## Maintenance (concept)

A district crew or trained collectors visit on a schedule. A spare, pre-tested electronics tray can be swapped in, so a faulty unit is repaired at the workshop rather than on the street.

| Interval | Check |
| --- | --- |
| Monthly | Wipe the panel and the sensor face; check screws, seals, vent and antenna; read battery voltage from the last report |
| After storms or washing | Open and look for water; replace silica gel if wet |
| When a bin goes silent | Swap the tray; test the faulty one on the bench |

## On-bin interface for low literacy

No text-dependent lights. The bin carries a sticker with a pictogram, the bin number in large figures, and a QR code that opens the citizen report page. A maintenance LED, if any, sits behind a light pipe and is for crews only. An Arabic mock-up of the sticker is in the printable page.

## Cost

The bill of materials is in [`hardware/bom/README.md`](../../hardware/bom/README.md). Each price there has a supplier page, a date and an evidence type; lines without one stay empty.

PARTIAL: not a per-bin cost. 26 lines sourced, 1 to verify; sourced lines add up to 7243.00 EGP (one-time). The custom mount needs a quote; a 40.19 EGP calendar-month connectivity reference is recorded. Full installed cost remains unverified.

## Deployment steps

1. Build and bench-test one unit; fill the power table.
2. Run the enclosure tests on the assembled unit.
3. Pilot a small number of bins (the number is for the district to decide) in one area with known signal.
4. Review the first weeks of readings with the crew, then adjust thresholds and routes.
5. Expand only after the open items below are closed.

## Data and privacy

The unit has no camera and collects no personal data: a bin id, fill level, temperature, battery voltage and a timestamp. The QR code leads to the normal citizen report page, which has its own privacy rules.

## Open items before a field pilot

- Bench-validate the wiring, including MOSFET gate drive and modem peak current.
- Measure sleep and transmit currents; compute battery life from the formulas.
- Choose and test the enclosure; run the dust, splash and heat tests.
- Confirm which Egyptian operators still serve 2G, or move to LTE Cat-1.
- Source the remaining BOM prices and size the solar panel.
- Implement the firmware changes listed in the schematics README.
