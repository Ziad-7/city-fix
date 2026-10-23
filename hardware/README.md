# Hardware: CityCycle smart bin

## How the smart bin is built / كيف يُصنع الصندوق الذكي

![Smart bin field wiring, rev A](schematics/smart-bin.svg)

<p dir="rtl">صندوق قمامة ذكي يعمل بالطاقة الشمسية: لوح شمسي يشحن بطارية ليثيوم 18650 عبر شاحن محمي ومصهر. يقيس حساس فوق صوتي نسبة الامتلاء ومجس مقاوم للماء درجة الحرارة، ويرسل مودم SIM800L (الجيل الثاني) القراءات، وتنتظر القراءات غير المرسلة في ذاكرة تتسع لـ 32 قراءة. الإلكترونيات في علبة مقاومة للطقس تحت غطاء الصندوق، مع براغي أمان ومفتاح ضد العبث. <strong>الحالة:</strong> تصميم على الورق (النسخة أ)؛ السلوك مُتحقَّق منه في المحاكاة فقط، ولم تُبنَ أي وحدة ولم تُختبر على المنضدة أو في الميدان.</p>

- **الطاقة / Power:** a solar panel charges an 18650 cell through a protected charger module, with a fuse and a 3.3 V regulator. Battery life is not measured yet.
- **الاستشعار / Sensing:** an ultrasonic probe measures how full the bin is (its supply is switched off while the unit sleeps); a waterproof probe measures temperature.
- **الاتصال / Connectivity:** a SIM800L modem (2G) sends readings; unsent readings wait in a 32-row buffer. Whether each operator still serves 2G is to verify, with an LTE alternative listed.
- **التركيب / Enclosure:** an off-the-shelf weatherproof box under the bin lid, with a panel guard, security screws and a tamper switch. The assembled unit has not been tested.
- **الحالة / Status:** a paper design (rev A). The behaviour is checked in simulation only; no unit has been built or tested on a bench or in the field.

## What is here

| Folder | Contents |
| --- | --- |
| [`schematics/`](schematics/README.md) | Field wiring schematic (SVG), pin table, netlist, and the changes needed from the simulator |
| [`bom/`](bom/README.md) | Bill of Materials in EGP with supplier, date and evidence per price; unsourced lines stay empty |
| [`enclosure/`](enclosure/README.md) | Enclosure, mounting, vandal and heat notes, and the test procedure |
| [`power/`](power/README.md) | Battery-life and solar formulas with a blank table and bench log templates |
| [`wokwi/`](wokwi/README.md) | ESP32 browser simulations of the bin and the hub scale (not hardware validation) |
| [`simulator/`](simulator/README.md) | PC panel that posts fake readings to the backend |
| [`tests/`](tests/test_hardware_package.py) | Checks for the schematic, BOM and the brief |

The [Field Deployment Brief](../docs/field-brief/field-deployment-brief.md) covers Egyptian field conditions, maintenance and open items. There is no firmware folder yet: the real-hardware firmware changes are listed in the schematics README and none is implemented.

## Checks

The hardware workflow was removed, so run these locally (stdlib Python and `xmllint`; no board needed):

```bash
python3 hardware/schematics/build_schematic.py --check
xmllint --noout hardware/schematics/smart-bin.svg
python3 hardware/bom/bom_totals.py
python3 -m unittest discover -s hardware/tests -v
python3 -m unittest discover -s hardware/simulator/tests -v
```
