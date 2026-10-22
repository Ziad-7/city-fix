import { CO2_KG_PER_KG, DEMO_MATERIAL_PRICES, MATERIALS, MATERIAL_IDS, SHOW_CO2_IMPACT, aggregateWeighings, co2AvoidedKg, computeImpact, demoPriceList, estimatedValue, hasUnpricedItems, normalizeItems, priceOf, pricesAreDemo, weighingValue } from '../materials';
import { earningsRange, suggestedPaymentEgp } from '../citycycle';

const prices = demoPriceList();

describe('material catalogue', () => {
  it('has the contract ids, an Arabic label, a tip, an icon and a demo price entry for each', () => {
    expect(MATERIAL_IDS).toEqual(['pet_plastic', 'paper_cardboard', 'metal_cans', 'glass', 'e_waste', 'cooking_oil', 'organics']);
    for (const m of MATERIALS) {
      expect(m.labelAr).toMatch(/[؀-ۿ]/);
      expect(m.tipAr.length).toBeGreaterThan(10);
      expect(m.icon).toBeTruthy();
      expect(m.id in DEMO_MATERIAL_PRICES).toBe(true);
      expect(m.id in CO2_KG_PER_KG).toBe(true);
    }
  });

  it('demo prices are flagged as demo, one row per material, organics unpriced', () => {
    expect(prices).toHaveLength(7);
    expect(pricesAreDemo(prices)).toBe(true);
    expect(pricesAreDemo([{ isDemo: false }, {}])).toBe(false);
    expect(priceOf(prices, 'pet_plastic')).toBe(DEMO_MATERIAL_PRICES.pet_plastic);
    expect(priceOf(prices, 'organics')).toBeNull();
  });
});

describe('estimated value', () => {
  it('sums kg x price', () => {
    const v = estimatedValue(
      [
        { materialId: 'pet_plastic', estimatedKg: 4 },
        { materialId: 'paper_cardboard', estimatedKg: 6 },
      ],
      prices,
    );
    expect(v).toBe(4 * (DEMO_MATERIAL_PRICES.pet_plastic as number) + 6 * (DEMO_MATERIAL_PRICES.paper_cardboard as number));
  });

  it('is undefined (not 0) when no item has a price', () => {
    expect(estimatedValue([{ materialId: 'organics', estimatedKg: 5 }], prices)).toBeUndefined();
    expect(estimatedValue([], prices)).toBeUndefined();
  });

  it('counts only priced items and says when some are unpriced', () => {
    const items = [
      { materialId: 'glass' as const, estimatedKg: 2 },
      { materialId: 'organics' as const, estimatedKg: 9 },
    ];
    expect(estimatedValue(items, prices)).toBe(2 * (DEMO_MATERIAL_PRICES.glass as number));
    expect(hasUnpricedItems(items, prices)).toBe(true);
    expect(hasUnpricedItems(items.slice(0, 1), prices)).toBe(false);
  });

  it('rounds money to 2 decimals and weighs at the price of the moment', () => {
    expect(estimatedValue([{ materialId: 'pet_plastic', estimatedKg: 0.333 }], [{ materialId: 'pet_plastic', priceEgpPerKg: 10 }])).toBe(3.33);
    expect(weighingValue(2.5, 12)).toBe(30);
    expect(weighingValue(2.5, null)).toBeNull();
  });

  it('normalizes items: merges repeats, drops empty or invalid rows, keeps catalogue order', () => {
    expect(
      normalizeItems([
        { materialId: 'glass', estimatedKg: 1 },
        { materialId: 'pet_plastic', estimatedKg: 2 },
        { materialId: 'glass', estimatedKg: 1.5 },
        { materialId: 'paper_cardboard', estimatedKg: 0 },
        { materialId: 'nope' as never, estimatedKg: 3 },
      ]),
    ).toEqual([
      { materialId: 'pet_plastic', estimatedKg: 2 },
      { materialId: 'glass', estimatedKg: 2.5 },
    ]);
  });
});

describe('impact maths', () => {
  const weighings = [
    { materialId: 'pet_plastic' as const, kg: 4.6, valueEgp: 46 },
    { materialId: 'paper_cardboard' as const, kg: 7.4, valueEgp: 29.6 },
    { materialId: 'pet_plastic' as const, kg: 1, valueEgp: 10 },
    { materialId: 'organics' as const, kg: 2, valueEgp: null },
  ];

  it('aggregates kg and EGP by material, most kg first', () => {
    const a = aggregateWeighings(weighings);
    expect(a.totalKg).toBe(15);
    expect(a.valueEgp).toBe(85.6);
    expect(a.byMaterial.map((r) => r.materialId)).toEqual(['paper_cardboard', 'pet_plastic', 'organics']);
    expect(a.byMaterial[1]).toEqual({ materialId: 'pet_plastic', kg: 5.6, valueEgp: 56 });
  });

  it('impact equals the sum of the weighings; earned only for collectors', () => {
    const citizen = computeImpact(weighings, 2);
    expect(citizen.totalKg).toBe(15);
    expect(citizen.pickups).toBe(2);
    expect(citizen.earnedEgp).toBeUndefined();
    expect(citizen.byMaterial.reduce((s, r) => s + r.kg, 0)).toBeCloseTo(citizen.totalKg, 5);
    expect(computeImpact(weighings, 2, { includeEarned: true }).earnedEgp).toBe(85.6);
  });

  it('computes CO2 from the per-material factors, and keeps it hidden until verified', () => {
    expect(co2AvoidedKg([{ materialId: 'pet_plastic', kg: 10 }])).toBe(10 * CO2_KG_PER_KG.pet_plastic);
    expect(co2AvoidedKg([])).toBe(0);
    expect(SHOW_CO2_IMPACT).toBe(false);
  });

  it('empty weighings give zeros', () => {
    expect(computeImpact([], 0)).toEqual({ totalKg: 0, byMaterial: [], pickups: 0, co2AvoidedKg: 0 });
  });
});

describe('pickup helpers', () => {
  it('suggests paying the weighed value only for a paid pickup', () => {
    expect(suggestedPaymentEgp({ mode: 'paid', totalValueEgp: 75.6 })).toBe(75.6);
    expect(suggestedPaymentEgp({ mode: 'free', totalValueEgp: 75.6 })).toBe(0);
    expect(suggestedPaymentEgp({ mode: 'paid' })).toBe(0);
  });

  it('earnings ranges: today starts at local midnight, week covers 7 days', () => {
    const now = new Date(2026, 9, 22, 15, 30);
    const today = earningsRange('today', now);
    expect(new Date(today.from).getTime()).toBe(new Date(2026, 9, 22).getTime());
    expect(new Date(earningsRange('week', now).from).getTime()).toBe(new Date(2026, 9, 16).getTime());
  });
});
