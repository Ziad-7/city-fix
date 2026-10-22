/**
 * CityCycle material catalogue, demo prices and the pure maths for value and impact.
 * No text that depends on the language lives here except the Arabic source strings: English and helpers that follow
 * the current language are in `@/i18n/labels` (`materialLabel`, `materialTip`, `demoPricesLabel` ...).
 */
import type { Material, MaterialId, MaterialPrice, PickupItem, Weighing, Impact, EarningsByMaterial } from './citycycle';

export const MATERIALS: readonly Material[] = [
  { id: 'pet_plastic', labelAr: 'بلاستيك (إزايز)', icon: 'bottle', tipAr: 'إزايز المية والعصير. الأحسن تكون فاضية ومكبوسة.' },
  { id: 'paper_cardboard', labelAr: 'ورق وكرتون', icon: 'package', tipAr: 'كراتين وورق وجرايد. الأحسن تكون ناشفة ومفرودة.' },
  { id: 'metal_cans', labelAr: 'معادن وعلب', icon: 'can', tipAr: 'علب الأكل والمشروبات. الأحسن تكون فاضية ومشطوفة.' },
  { id: 'glass', labelAr: 'إزاز', icon: 'glass', tipAr: 'إزايز وبرطمانات. الأحسن من غير كسر، وفي كيس لوحدها.' },
  { id: 'e_waste', labelAr: 'إلكترونيات قديمة', icon: 'cpu', tipAr: 'موبايلات وشواحن وكابلات وأجهزة صغيرة. من غير كسر أو فتح.' },
  { id: 'cooking_oil', labelAr: 'زيت طبيخ مستعمل', icon: 'droplet', tipAr: 'في إزازة مقفولة، ومن غير ما يتخلط بمية.' },
  { id: 'organics', labelAr: 'فضلات أكل', icon: 'leaf', tipAr: 'فضلات الأكل والخضار في كيس لوحده، وتتسلّم في نفس اليوم.' },
];

export const MATERIAL_IDS: readonly MaterialId[] = MATERIALS.map((m) => m.id);

const BY_ID = new Map<MaterialId, Material>(MATERIALS.map((m) => [m.id, m]));

export function getMaterial(id: MaterialId): Material {
  return BY_ID.get(id) ?? MATERIALS[0];
}

export const isMaterialId = (v: unknown): v is MaterialId => typeof v === 'string' && BY_ID.has(v as MaterialId);

// ---- Prices ----

/**
 * DEMO prices in EGP per kg for Nasr City: demo prices, not real market rates. Replace with the district's
 * published list (GET /recycling/materials); the apps must never ship real prices (docs/api-contract.md, CityCycle rules).
 * `null` = the district has not set a price: the UI shows "السعر هيتحدد" / "Price to be set" and no value
 * (organics stays null on purpose, so the demo shows that state too).
 */
export const DEMO_MATERIAL_PRICES: Record<MaterialId, number | null> = {
  pet_plastic: 10,
  paper_cardboard: 4,
  metal_cans: 12,
  glass: 1,
  e_waste: 20,
  cooking_oil: 15,
  organics: null,
};

export const DEMO_PRICES_DISTRICT = 'مدينة نصر أول';
/** Fixed so the demo list is stable between runs. */
export const DEMO_PRICES_UPDATED_AT = '2026-10-20T00:00:00.000Z';

/** The demo price list as the API would return it (one row per material, `isDemo: true`). */
export function demoPriceList(district: string = DEMO_PRICES_DISTRICT): MaterialPrice[] {
  return MATERIALS.map((m) => ({
    materialId: m.id,
    district,
    priceEgpPerKg: DEMO_MATERIAL_PRICES[m.id],
    updatedAt: DEMO_PRICES_UPDATED_AT,
    isDemo: true,
  }));
}

/** True when any row is a demo price: show the small "Demo prices" label next to every price and value. */
export const pricesAreDemo = (prices: readonly Pick<MaterialPrice, 'isDemo'>[]): boolean => prices.some((p) => p.isDemo);

type PriceRow = Pick<MaterialPrice, 'materialId' | 'priceEgpPerKg'>;

/** The price of one material, or `null` when the list has none for it. */
export function priceOf(prices: readonly PriceRow[], id: MaterialId): number | null {
  return prices.find((p) => p.materialId === id)?.priceEgpPerKg ?? null;
}

// ---- Rounding ----

export const roundKg = (kg: number): number => Math.round(kg * 100) / 100;
export const roundEgp = (egp: number): number => Math.round(egp * 100) / 100;

// ---- Pickup value ----

/** Limits the request form enforces (the server validates again). */
export const PICKUP_LIMITS = { minKg: 0.5, maxKgPerMaterial: 200 } as const;

/** Merges repeated materials and drops empty or invalid rows. */
export function normalizeItems(items: readonly PickupItem[]): PickupItem[] {
  const sums = new Map<MaterialId, number>();
  for (const it of items) {
    if (!isMaterialId(it.materialId) || !(it.estimatedKg > 0) || !Number.isFinite(it.estimatedKg)) continue;
    sums.set(it.materialId, (sums.get(it.materialId) ?? 0) + it.estimatedKg);
  }
  return MATERIAL_IDS.filter((id) => sums.has(id)).map((id) => ({ materialId: id, estimatedKg: roundKg(sums.get(id) as number) }));
}

export const totalEstimatedKg = (items: readonly PickupItem[]): number => roundKg(items.reduce((s, i) => s + (i.estimatedKg > 0 ? i.estimatedKg : 0), 0));

/**
 * Estimated value of a pickup: sum of kg x price per kg over the items that have a price.
 * `undefined` when no item has a price (the UI then shows "price to be set", never 0).
 */
export function estimatedValue(items: readonly PickupItem[], prices: readonly PriceRow[]): number | undefined {
  let total = 0;
  let priced = false;
  for (const it of items) {
    const price = priceOf(prices, it.materialId);
    if (price === null || !(it.estimatedKg > 0)) continue;
    total += it.estimatedKg * price;
    priced = true;
  }
  return priced ? roundEgp(total) : undefined;
}

/** Some of the items have no price yet: the value shown is a lower bound ("from X"). */
export const hasUnpricedItems = (items: readonly PickupItem[], prices: readonly PriceRow[]): boolean =>
  items.some((it) => it.estimatedKg > 0 && priceOf(prices, it.materialId) === null);

/** Value of one weighing at the price at that time; `null` when there was no price. */
export const weighingValue = (kg: number, priceEgpPerKg: number | null): number | null => (priceEgpPerKg === null ? null : roundEgp(kg * priceEgpPerKg));

// ---- Impact ----

type WeighingRow = Pick<Weighing, 'materialId' | 'kg' | 'valueEgp'>;

/** Kg and value per material (most kg first), plus the totals. Values of unpriced weighings count as 0. */
export function aggregateWeighings(weighings: readonly WeighingRow[]): { totalKg: number; valueEgp: number; byMaterial: EarningsByMaterial[] } {
  const acc = new Map<MaterialId, { kg: number; valueEgp: number }>();
  for (const w of weighings) {
    const row = acc.get(w.materialId) ?? { kg: 0, valueEgp: 0 };
    row.kg += w.kg;
    row.valueEgp += w.valueEgp ?? 0;
    acc.set(w.materialId, row);
  }
  const byMaterial = [...acc.entries()]
    .map(([materialId, r]) => ({ materialId, kg: roundKg(r.kg), valueEgp: roundEgp(r.valueEgp) }))
    .sort((a, b) => b.kg - a.kg || MATERIAL_IDS.indexOf(a.materialId) - MATERIAL_IDS.indexOf(b.materialId));
  return {
    totalKg: roundKg(byMaterial.reduce((s, r) => s + r.kg, 0)),
    valueEgp: roundEgp(byMaterial.reduce((s, r) => s + r.valueEgp, 0)),
    byMaterial,
  };
}

/**
 * CO2 avoided per kg recycled, by material (kg CO2e per kg). TO VERIFY: placeholders until a source is chosen
 * (for example the national inventory or a recycling-LCA study). Do not publish these numbers as facts.
 */
export const CO2_KG_PER_KG: Record<MaterialId, number> = {
  pet_plastic: 1.5,
  paper_cardboard: 1,
  metal_cans: 4,
  glass: 0.3,
  e_waste: 2,
  cooking_oil: 2.5,
  organics: 0.5,
};

/** Feature plan: hide the CO2 line until the factors above are sourced. Flip to true when they are. */
export const SHOW_CO2_IMPACT = false;

export function co2AvoidedKg(byMaterial: readonly { materialId: MaterialId; kg: number }[]): number {
  return roundKg(byMaterial.reduce((s, r) => s + r.kg * (CO2_KG_PER_KG[r.materialId] ?? 0), 0));
}

/**
 * Impact from confirmed weighings: kg diverted by material, EGP earned (collectors pass `includeEarned`), and CO2
 * avoided (factors to verify; check `SHOW_CO2_IMPACT` before showing it). `pickups` is the number of finished pickups.
 */
export function computeImpact(weighings: readonly WeighingRow[], pickups: number, opts: { includeEarned?: boolean } = {}): Impact {
  const agg = aggregateWeighings(weighings);
  const byMaterial = agg.byMaterial.map(({ materialId, kg }) => ({ materialId, kg }));
  return {
    totalKg: agg.totalKg,
    byMaterial,
    pickups,
    ...(opts.includeEarned ? { earnedEgp: agg.valueEgp } : {}),
    co2AvoidedKg: co2AvoidedKg(byMaterial),
  };
}
