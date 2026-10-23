# BOM with sourced EGP prices

Prepared 2026-10-23. The table uses published Egyptian supplier prices for the exact item or set specified in the CSV. It replaces the earlier planning allowances. Prices are evidence for a budget, not proof that the circuit is field-ready. See [dated price research](../../hardware/bom/price-research-2026-10-23.json).

## Cost summary

| Cost scope | EGP |
| --- | ---: |
| Smart-bin priced components subtotal (custom mount excluded) | 7,243.00 |
| Calendar-month data reference, derived from 37 EGP/28 days | 40.19 |
| Custom lid / sensor mount | Workshop quote required |

## Scope

The BOM has 26 priced rows and one custom-work row still requiring a quote. The optional LTE alternative is excluded from the bin subtotal. No full installed-cost or payback claim is made. Component specifications and the solar/power circuit still need validation. The source register records which figures were read from product pages, indexed supplier listings or derived from multiple published prices.

The 37 EGP Vodafone reference renews every 28 days: 37 × 365 ÷ 28 ÷ 12 = 40.19 EGP per average calendar month. Activation, business IoT terms and applicable recharge charges need operator confirmation. This is not a committed IoT service offer.

Delivery, taxes not included by a supplier, installation, labour, vehicles, existing bin/phone/computer assets, calibration, further wiring and power-design substitutions are outside the component subtotal. The custom mount has no verifiable fixed price until dimensions and fabrication method are agreed; it is not counted as free.

## Itemized component prices

| ID | Item | Quantity | Unit EGP | Total EGP | Supplier |
| --- | --- | ---: | ---: | ---: | --- |
| B01 | ESP32 dev board | 1 | 280.00 | 280.00 | [Makers Electronics](https://makerselectronics.com/product-category/wireless-communication/iot-development-boards/) |
| B02 | JSN-SR04T ultrasonic probe | 1 | 375.00 | 375.00 | [Electra Store](https://electra.store/products/waterproof-distance-measuring-ultrasonic-sensor-jsn-sr04t) |
| B03 | DS18B20 waterproof probe | 1 | 65.00 | 65.00 | [Makers Electronics](https://makerselectronics.com/product/ds18b20-waterproof-temperature-senso/) |
| B04 | Pull-up resistor 4.7k | 1 | 0.25 | 0.25 | [Makers Electronics](https://makerselectronics.com/product/carbon-resistor-4-7k%CF%89-0-5w-through-hole/) |
| B05 | Resistor assortment kit | 1 | 95.00 | 95.00 | [Makers Electronics](https://makerselectronics.com/product/metal-resistor-pack-30-kinds-600/) |
| B06 | TP4056 charger module | 1 | 15.00 | 15.00 | [Makers Electronics](https://makerselectronics.com/product/tp4056-micro-usb-lithium-battery/) |
| B07 | 18650 Li-ion cell | 1 | 165.00 | 165.00 | [Makers Electronics](https://makerselectronics.com/product-category/batteries-chargers-connectors-holders/batteries/li-ion-batteries/) |
| B08 | 18650 single-cell holder | 1 | 8.00 | 8.00 | [Makers Electronics](https://makerselectronics.com/product/18650-battery-holder-1-slot/) |
| B09 | Solar panel | 1 | 240.00 | 240.00 | [Makers Electronics](https://makerselectronics.com/product/monocrystalline-solar-panel-6v-6w/) |
| B10 | Schottky reverse-protection diode | 1 | 1.25 | 1.25 | [Makers Electronics](https://makerselectronics.com/product/schottky-barrier-diodes-smd-1n5819w-s4-40v-350ma-600mv200ma-sod-123/) |
| B11 | Inline fuse and holder | 1 | 10.75 | 10.75 | [RAM Electronics](https://www.ram-e-shop.com/shop/fuse-pocket1-fuse-pocket-holder-external-for-t5x20-size-type-1-5995) |
| B12 | 3.3 V LDO low quiescent | 1 | 16.00 | 16.00 | [RS Egypt](https://eg.rsdelivers.com/product/diodeszetex/ap2112k-33trg1/diodeszetex-ap2112k-33trg1-voltage-regulator-6v-23/8283509) |
| B13 | 5 V boost module | 1 | 25.00 | 25.00 | [Makers Electronics](https://makerselectronics.com/product/mt3608-dc-dc-step-up-2a/) |
| B14 | P-channel MOSFET | 2 | 3.50 | 7.00 | [Makers Electronics](https://makerselectronics.com/product/ao3401-30v-4-2a-65m%cf%8910v4-2a-350mw-p-channel-sot-23to-236-mosfet-smd/) |
| B15 | Gate-drive transistor | 2 | 2.50 | 5.00 | [UGE Electronics Egypt](https://uge-one.com/product/2n7000-small-signal-n-channel-mosfet/) |
| B16 | Bulk capacitor | 1 | 2.00 | 2.00 | [Makers Electronics](https://makerselectronics.com/product/capacitors-100uf-6-3v-6mmx5mm-dip/) |
| B17 | SIM800L GSM module with antenna | 1 | 300.00 | 300.00 | [Makers Electronics](https://makerselectronics.com/product/sim800l-gsm-gprs-module-antenna/) |
| B18 | LTE Cat-1 modem module | 1 | 10000.00 | 10000.00 | [Makers Electronics](https://makerselectronics.com/product/sim7600e-h-4g-hat-for-raspberry-pi/) |
| B19 | SIM card and data plan | 1 | 40.19 | 40.19 | [Vodafone Egypt](https://web.vodafone.com.eg/en/mobile-internet-bundles) |
| B20 | Weatherproof enclosure | 1 | 275.00 | 275.00 | [Makers Electronics](https://makerselectronics.com/product/waterproof-project-box-200x120x55mm/) |
| B21 | Cable gland PG7 nylon | 3 | 4.00 | 12.00 | [Makers Electronics](https://makerselectronics.com/product/pg-7-nylon-waterproof-cable-gland/) |
| B22 | Breather vent plug | 1 | 389.85 | 389.85 | [AETRONIX Egypt](https://eg.aetronix.com/product/amphenol-industrial-aipg/vent-ps1ybk-n8001/breathable-vent-with-nut?pid=74298c50-bb51-42f3-aaff-21fcbf95d349) |
| B23 | Security screws | 1 | 1883.00 | 1883.00 | [Desertcart Egypt](https://www.desertcart.com.eg/products/45542787-uxcell-a16110300ux0448-m6x20mm-304-stainless-steel-button-head-torx-security-tamper-proof-screws-pack-of-20) |
| B24 | Lid bracket and sensor mount | 1 | Quote required | — | Custom workshop |
| B25 | Conformal coating | 1 | 2352.90 | 2352.90 | [AETRONIX Egypt](https://eg.aetronix.com/product/mg-chemicals/422b-55ml/conformal-coating?pid=0ed9511b-452c-4697-80ba-9bfa36699ef3) |
| B26 | Silica gel sachets | 1 | 135.00 | 135.00 | [Silica Egypt](https://silicaeg.com/products/premium-30-sachets-of-10g-silica-gel) |
| B27 | Wiring and connectors | 1 | 540.00 | 540.00 | [Makers Electronics and RAM Electronics](https://makerselectronics.com/product/flexible-tinned-copper-silicone-wire-awg-22-1m/) |
| B28 | Perfboard or small PCB | 1 | 45.00 | 45.00 | [RAM Electronics](https://www.ram-e-shop.com/shop/pcb26-holes-double-9x15-pcb-fr-4-dots-holes-9x15-cm2-double-side-with-green-musk-sku-pcb26-6769) |

## Optional hub-scale reference

The current Wokwi scale is a simulation. Published component references: ESP32 280 EGP, 50 kg bar load cell 350 EGP, HX711 75 EGP, giving a **705 EGP component subset**, not a complete scale. Platform fabrication, supply, display/controls, calibration and integration still need a design and quote. See the research register for supplier URLs. The HX711 product-page reference is used rather than a conflicting category price.

## Completing the only unpriced bin row

B24 is a custom lid bracket and sensor mount. A real value requires the selected bin dimensions, a finished mounting drawing and a local workshop quotation. No unrelated sensor bracket is substituted and no fabricated price is entered. Obtain that quote before claiming a complete installed-hardware budget.
