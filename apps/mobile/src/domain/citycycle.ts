/**
 * CityCycle (سيتي سايكل): recycling pickups, collector mode, smart bins and impact.
 * Shapes follow the "CityCycle — proposed" section of docs/api-contract.md. Prices always come from the district
 * price list (never from this file): a material with no price shows "السعر هيتحدد" / "Price to be set".
 */
import { getLang, tr } from '@/i18n';
import { localDigits } from '@/utils/digits';
import type { IconName, Place, SlotId } from './types';

// ---- Enums ----

export type MaterialId = 'pet_plastic' | 'paper_cardboard' | 'metal_cans' | 'glass' | 'e_waste' | 'cooking_oil' | 'organics';
export type PickupStatus = 'requested' | 'accepted' | 'weighed' | 'completed' | 'cancelled';
/** `free` = the household gives the material away, `paid` = the household wants to be paid. */
export type PickupMode = 'free' | 'paid';
export type CollectorStatus = 'pending' | 'verified' | 'suspended';
export type BinState = 'ok' | 'full' | 'hot' | 'low_battery' | 'offline';
export type WeighingSource = 'manual' | 'scale_ble' | 'scale_api';
export type WasteSize = 'small' | 'medium' | 'large';

export const MATERIAL_IDS: readonly MaterialId[] = ['pet_plastic', 'paper_cardboard', 'metal_cans', 'glass', 'e_waste', 'cooking_oil', 'organics'];

// ---- Shapes (contract) ----

export type MaterialPrice = {
  materialId: MaterialId;
  district: string;
  /** null until the district sets a price. */
  priceEgpPerKg: number | null;
  updatedAt: string;
};

export type PickupItem = { materialId: MaterialId; estimatedKg: number };

export type PickupTimelineEntry = { status: PickupStatus; note: string; actor: string; at: string };

export type Weighing = {
  id: string;
  pickupId: string;
  materialId: MaterialId;
  kg: number;
  source: WeighingSource;
  scaleId?: string;
  /** Price at the time of weighing (null when the district had none). */
  priceEgpPerKg: number | null;
  valueEgp: number | null;
  /** Idempotency key made by the app: a retry after a lost answer never creates a second weighing. */
  clientId: string;
  at: string;
};

export type RecyclingPickup = {
  /** "RCY-3001" */
  id: string;
  citizenId: string;
  items: PickupItem[];
  photoUris: string[];
  location: Place;
  /** YYYY-MM-DD */
  day: string;
  slot: SlotId;
  mode: PickupMode;
  note?: string;
  /** From the district price list; absent when no item has a price. */
  estimatedValueEgp?: number;
  status: PickupStatus;
  collectorId?: string;
  /** First name only: a household never sees more. */
  collectorName?: string;
  weighings: Weighing[];
  totalKg?: number;
  totalValueEgp?: number;
  /** What the collector says they paid in cash (mode `paid`). Proposed contract field. */
  paidToHouseholdEgp?: number;
  /** The collector pressed "finished"; the household still has to confirm. Proposed contract field. */
  collectorFinishedAt?: string;
  /** The household confirmed the weighing. Proposed contract field. */
  confirmedAt?: string;
  timeline: PickupTimelineEntry[];
  createdAt: string;
};

export type NewRecyclingPickupInput = {
  items: PickupItem[];
  photoUris?: string[];
  location: Place;
  day: string;
  slot: SlotId;
  mode: PickupMode;
  note?: string;
};

/** A pickup as a verified collector sees it before accepting: no phone, no name, no exact pin. */
export type CollectorJob = {
  id: string;
  items: PickupItem[];
  /** Address and landmark only; the exact pin arrives with the accepted pickup. */
  location: Place;
  day: string;
  slot: SlotId;
  mode: PickupMode;
  note?: string;
  estimatedKg: number;
  estimatedValueEgp?: number;
  distanceM?: number;
};

export type Collector = {
  id: string;
  name: string;
  district: string;
  status: CollectorStatus;
  materials: MaterialId[];
  vehicle?: string;
  joinedAt: string;
};

export type CollectorApplication = { name: string; district: string; materials: MaterialId[]; vehicle?: string };

export type JobsQuery = { lat: number; lng: number; radiusM: number; materialId?: MaterialId };

export type NewWeighingInput = { materialId: MaterialId; kg: number; source: WeighingSource; scaleId?: string; clientId: string };

export type Earnings = {
  period: { from: string; to: string };
  totalKg: number;
  valueEgp: number;
  paidToHouseholdsEgp: number;
  byMaterial: { materialId: MaterialId; kg: number; valueEgp: number }[];
  jobs: number;
};

export type Bin = {
  /** "BIN-014" */
  id: string;
  name?: string;
  location: Place;
  kind: 'street' | 'hub';
  fillPct?: number;
  tempC?: number;
  batteryV?: number;
  state: BinState;
  lastSeenAt?: string;
};

export type Impact = {
  totalKg: number;
  byMaterial: { materialId: MaterialId; kg: number }[];
  pickups: number;
  earnedEgp?: number;
  /** Emission factors are still to verify: the app shows this only when the backend sends it. */
  co2AvoidedKg?: number;
};

export type WasteClassification = {
  materials: { materialId: MaterialId; confidence: number }[];
  size: WasteSize;
  estimatedKgRange?: [number, number];
  source: 'model' | 'fallback';
};

// ---- Materials (labels in both languages) ----

type MaterialInfo = {
  icon: IconName;
  ar: string;
  en: string;
  doAr: string;
  doEn: string;
  dontAr: string;
  dontEn: string;
};

export const MATERIALS: Record<MaterialId, MaterialInfo> = {
  pet_plastic: {
    icon: 'bottle', ar: 'بلاستيك (زجاجات PET)', en: 'Plastic bottles (PET)',
    doAr: 'زجاجات مياه وعصير فاضية وناشفة', doEn: 'Empty, dry water and juice bottles',
    dontAr: 'زجاجات فيها سوائل أو زيت', dontEn: 'Bottles with liquid or oil inside',
  },
  paper_cardboard: {
    icon: 'box', ar: 'ورق وكرتون', en: 'Paper & cardboard',
    doAr: 'كراتين وورق نضيف وناشف', doEn: 'Clean, dry cardboard and paper',
    dontAr: 'ورق مبلول أو متسخ بأكل', dontEn: 'Wet paper, or paper soiled with food',
  },
  metal_cans: {
    icon: 'can', ar: 'علب صفيح ومعادن', en: 'Metal & cans',
    doAr: 'علب صفيح وألومنيوم فاضية', doEn: 'Empty tin and aluminium cans',
    dontAr: 'بخاخات لسه فيها محتوى', dontEn: 'Spray cans that still have contents',
  },
  glass: {
    icon: 'jar', ar: 'زجاج', en: 'Glass',
    doAr: 'إزايز وبرطمانات فاضية، وخلّي بالك من الكسر', doEn: 'Empty bottles and jars. Mind the sharp edges',
    dontAr: 'مرايات وزجاج شبابيك', dontEn: 'Mirrors and window glass',
  },
  e_waste: {
    icon: 'plug', ar: 'إلكترونيات قديمة', en: 'Old electronics',
    doAr: 'موبايلات وشواحن وكابلات وأجهزة صغيرة', doEn: 'Phones, chargers, cables and small devices',
    dontAr: 'بطاريات منفوخة أو مكسورة', dontEn: 'Swollen or broken batteries',
  },
  cooking_oil: {
    icon: 'drop', ar: 'زيت طبخ مستعمل', en: 'Used cooking oil',
    doAr: 'زيت مستعمل في إزازة أو جركن مقفول', doEn: 'Used oil in a closed bottle or can',
    dontAr: 'متصبّوش في الحوض أو البلاعة', dontEn: 'Never pour it down the sink or drain',
  },
  organics: {
    icon: 'leaf', ar: 'عضويات (بواقي أكل)', en: 'Food scraps',
    doAr: 'بواقي أكل وقشر خضار وفاكهة', doEn: 'Food leftovers, vegetable and fruit peels',
    dontAr: 'أكياس بلاستيك مع الأكل', dontEn: 'Plastic bags mixed with the food',
  },
};

export const materialLabel = (id: MaterialId): string => tr(MATERIALS[id].ar, MATERIALS[id].en);
export const materialDo = (id: MaterialId): string => tr(MATERIALS[id].doAr, MATERIALS[id].doEn);
export const materialDont = (id: MaterialId): string => tr(MATERIALS[id].dontAr, MATERIALS[id].dontEn);

// ---- Numbers and money ----

/** 12.5 -> "١٢٫٥" (Arabic) / "12.5" (English); whole numbers have no decimals, others at most `maxDecimals`. */
export function numText(n: number, maxDecimals = 1): string {
  const factor = 10 ** maxDecimals;
  const rounded = Math.round(n * factor) / factor;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(maxDecimals).replace(/0+$/, '');
  const local = localDigits(text);
  return getLang() === 'en' ? local : local.replace('.', '٫');
}

export const formatKg = (kg: number): string => `${numText(kg)} ${tr('كجم', 'kg')}`;
export const formatEgp = (egp: number): string => `${numText(egp, 2)} ${tr('ج.م', 'EGP')}`;
/** "٥ ج.م / كجم" or the "price to be set" line. */
export const formatPrice = (price: number | null | undefined): string =>
  price === null || price === undefined ? tr('السعر هيتحدد', 'Price to be set') : `${numText(price, 2)} ${tr('ج.م/كجم', 'EGP/kg')}`;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function priceOf(prices: readonly Pick<MaterialPrice, 'materialId' | 'priceEgpPerKg'>[], id: MaterialId): number | null {
  return prices.find((p) => p.materialId === id)?.priceEgpPerKg ?? null;
}

export const valueOf = (kg: number, price: number | null): number | null => (price === null ? null : round2(kg * price));

/**
 * Estimated value of a pickup from the price list. `valueEgp` is undefined when no item has a price;
 * `unpriced` lists the materials the district has not priced yet (the estimate leaves them out).
 */
export function estimateValue(
  items: readonly PickupItem[],
  prices: readonly Pick<MaterialPrice, 'materialId' | 'priceEgpPerKg'>[],
): { valueEgp?: number; unpriced: MaterialId[] } {
  let total = 0;
  let any = false;
  const unpriced: MaterialId[] = [];
  for (const it of items) {
    const price = priceOf(prices, it.materialId);
    if (price === null) {
      unpriced.push(it.materialId);
      continue;
    }
    any = true;
    total += it.estimatedKg * price;
  }
  return { valueEgp: any ? round2(total) : undefined, unpriced };
}

export const sumKg = (items: readonly { estimatedKg: number }[]): number => round2(items.reduce((s, i) => s + i.estimatedKg, 0));

export type WeighingTotals = { totalKg: number; totalValueEgp: number; byMaterial: { materialId: MaterialId; kg: number; valueEgp: number }[]; hasUnpriced: boolean };

/** Weighings are the source of truth for kg and EGP. */
export function weighingTotals(weighings: readonly Weighing[]): WeighingTotals {
  const map = new Map<MaterialId, { kg: number; valueEgp: number }>();
  let hasUnpriced = false;
  for (const w of weighings) {
    const cur = map.get(w.materialId) ?? { kg: 0, valueEgp: 0 };
    cur.kg = round2(cur.kg + w.kg);
    if (w.valueEgp === null) hasUnpriced = true;
    else cur.valueEgp = round2(cur.valueEgp + w.valueEgp);
    map.set(w.materialId, cur);
  }
  const byMaterial = [...map.entries()].map(([materialId, v]) => ({ materialId, ...v }));
  return {
    totalKg: round2(byMaterial.reduce((s, m) => s + m.kg, 0)),
    totalValueEgp: round2(byMaterial.reduce((s, m) => s + m.valueEgp, 0)),
    byMaterial,
    hasUnpriced,
  };
}

// ---- Pickup form ----

export const MIN_KG = 0.5;
export const MAX_KG = 500;
export const DEFAULT_KG = 2;
export const KG_STEP = 0.5;

export type PickupFormErrors = { items?: string; address?: string; day?: string; kg?: string };

export function validatePickupInput(input: Pick<NewRecyclingPickupInput, 'items' | 'location' | 'day'>): PickupFormErrors {
  const errors: PickupFormErrors = {};
  if (input.items.length === 0) errors.items = tr('اختار خامة واحدة على الأقل', 'Pick at least one material');
  else if (input.items.some((i) => !(i.estimatedKg >= MIN_KG) || i.estimatedKg > MAX_KG)) {
    errors.kg = tr(`الوزن لازم يكون بين ${numText(MIN_KG)} و${numText(MAX_KG)} كجم`, `Each weight must be between ${numText(MIN_KG)} and ${numText(MAX_KG)} kg`);
  }
  if (!input.location.address.trim()) errors.address = tr('حدّد المكان الأول', 'Set the location first');
  if (!input.day) errors.day = tr('اختار اليوم', 'Pick a day');
  return errors;
}

/** Parses what a person typed for a weight ("2.5", "٢٫٥", "2,5"); NaN when it is not a number. */
export function parseKg(text: string): number {
  const western = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫,،]/g, '.')
    .trim();
  if (!/^\d+(\.\d+)?$/.test(western)) return NaN;
  return Math.round(Number(western) * 100) / 100;
}

export const stepKg = (kg: number, dir: 1 | -1): number => Math.min(MAX_KG, Math.max(MIN_KG, round2(kg + dir * KG_STEP)));

// ---- Status ----

export const PICKUP_STATUS_ORDER: readonly PickupStatus[] = ['requested', 'accepted', 'weighed', 'completed'];

const PICKUP_STATUS_LABELS: Record<PickupStatus, { ar: string; en: string }> = {
  requested: { ar: 'مستني جامع', en: 'Waiting for a collector' },
  accepted: { ar: 'جامع في الطريق', en: 'Collector on the way' },
  weighed: { ar: 'اتوزن', en: 'Weighed' },
  completed: { ar: 'خلص', en: 'Done' },
  cancelled: { ar: 'اتلغى', en: 'Cancelled' },
};

export const pickupStatusLabel = (s: PickupStatus): string => tr(PICKUP_STATUS_LABELS[s].ar, PICKUP_STATUS_LABELS[s].en);
export const isOpenPickup = (s: PickupStatus): boolean => s === 'requested' || s === 'accepted' || s === 'weighed';
export const canCancelPickup = (p: Pick<RecyclingPickup, 'status'>): boolean => p.status === 'requested';
/** The collector finished and the household has not confirmed yet. */
export const awaitingConfirmation = (p: Pick<RecyclingPickup, 'status' | 'collectorFinishedAt' | 'confirmedAt'>): boolean =>
  p.status === 'weighed' && !!p.collectorFinishedAt && !p.confirmedAt;

export const PICKUP_MODES: readonly { id: PickupMode; ar: string; en: string; subAr: string; subEn: string }[] = [
  { id: 'free', ar: 'أدّيها مجانًا', en: 'Give it away', subAr: 'من غير مقابل', subEn: 'No payment' },
  { id: 'paid', ar: 'عايز أبيعها', en: 'Sell it', subAr: 'بسعر الحي × الوزن الفعلي', subEn: 'District price × actual weight' },
];
export const pickupModeLabel = (m: PickupMode): string => {
  const x = PICKUP_MODES.find((p) => p.id === m);
  return x ? tr(x.ar, x.en) : m;
};

// ---- Collector ----

export const COLLECTOR_VEHICLES: readonly { id: string; ar: string; en: string }[] = [
  { id: 'foot', ar: 'مشي أو عجلة', en: 'On foot or bicycle' },
  { id: 'cart', ar: 'عربية كارو', en: 'Cart' },
  { id: 'tuktuk', ar: 'توك توك', en: 'Tuk-tuk' },
  { id: 'truck', ar: 'عربية نقل', en: 'Pickup truck' },
];

export const DEFAULT_JOB_RADIUS_M = 5000;

const COLLECTOR_STATUS_LABELS: Record<CollectorStatus, { ar: string; en: string }> = {
  pending: { ar: 'مستني التوثيق', en: 'Waiting for verification' },
  verified: { ar: 'موثّق', en: 'Verified' },
  suspended: { ar: 'موقوف', en: 'Suspended' },
};
export const collectorStatusLabel = (s: CollectorStatus): string => tr(COLLECTOR_STATUS_LABELS[s].ar, COLLECTOR_STATUS_LABELS[s].en);

/** First word of a name: what a household or a list shows of a collector. */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? '';

export type EarningsPeriod = 'today' | 'week' | 'all';

const ymd = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Inclusive date range (YYYY-MM-DD) for the earnings chips. "week" = the last 7 days including today. */
export function periodRange(period: EarningsPeriod, now: Date = new Date()): { from: string; to: string } {
  const to = ymd(now);
  if (period === 'today') return { from: to, to };
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return { from: ymd(start), to };
  }
  return { from: '2000-01-01', to };
}

/** True when an ISO timestamp falls inside the inclusive local-date range. */
export function inRange(iso: string, range: { from: string; to: string }): boolean {
  const day = ymd(new Date(iso));
  return day >= range.from && day <= range.to;
}

/** Offline-first collector actions (saved on the phone with a clientId, sent when the network is back). */
export type CollectorAction =
  | { kind: 'accept'; pickupId: string }
  | { kind: 'weigh'; pickupId: string; weighing: NewWeighingInput }
  | { kind: 'complete'; pickupId: string; paidToHouseholdEgp?: number };

// ---- Smart bins ----

const BIN_STATE_LABELS: Record<BinState, { ar: string; en: string }> = {
  ok: { ar: 'شغال وفاضي', en: 'Working, has room' },
  full: { ar: 'مليان', en: 'Full' },
  hot: { ar: 'سخن', en: 'Overheating' },
  low_battery: { ar: 'البطارية ضعيفة', en: 'Low battery' },
  offline: { ar: 'مقطوع', en: 'Offline' },
};
export const binStateLabel = (s: BinState): string => tr(BIN_STATE_LABELS[s].ar, BIN_STATE_LABELS[s].en);
/** Full or hot bins need someone to act. */
export const binNeedsAttention = (b: Pick<Bin, 'state'>): boolean => b.state === 'full' || b.state === 'hot';
export const binDisplayName = (b: Pick<Bin, 'id' | 'name'>): string => b.name?.trim() || b.id;

// ---- Impact ----

/** The citizen's own impact: only confirmed (completed) pickups count, by their weighings. */
export function impactFromPickups(pickups: readonly RecyclingPickup[]): Impact {
  const done = pickups.filter((p) => p.status === 'completed');
  const all = done.flatMap((p) => p.weighings);
  const totals = weighingTotals(all);
  return {
    totalKg: totals.totalKg,
    byMaterial: totals.byMaterial.map(({ materialId, kg }) => ({ materialId, kg })).sort((a, b) => b.kg - a.kg),
    pickups: done.length,
  };
}

export const WASTE_SIZE_KG: Record<WasteSize, number> = { small: 1, medium: 3, large: 8 };
