/**
 * English names for domain data. The Arabic stays in the domain files (and in data from the server);
 * these helpers return the label for the current language. Keep wording in sync with docs/mobile/english-glossary.md.
 */
import { BIN_STATE_LABEL_AR, type BinDisplayState } from '@/domain/bins';
import {
  COLLECTOR_STATUS_LABEL_AR,
  PICKUP_MODE_LABEL_AR,
  PICKUP_STATUS_LABEL_AR,
  WASTE_SIZE_LABEL_AR,
  WEIGHING_SOURCE_LABEL_AR,
  type BinKind,
  type CollectorStatus,
  type MaterialId,
  type PickupMode,
  type PickupStatus,
  type WasteSize,
  type WeighingSource,
} from '@/domain/citycycle';
import { getMaterial } from '@/domain/materials';
import type { CategoryId, IncidentStatus, PaymentMethod, ServiceType, Severity, SlotId } from '@/domain/types';
import { usePrefs } from '@/store/usePrefs';

const en = (): boolean => usePrefs.getState().lang === 'en';
const pick = (ar: string, english: string | undefined): string => (en() && english ? english : ar);

export const CATEGORY_EN: Record<CategoryId, string> = {
  pothole: 'Pothole or rough speed bump',
  open_manhole: 'Open manhole',
  sewage_overflow: 'Sewage overflow',
  water_pipe_burst: 'Burst water pipe',
  garbage: 'Garbage piling up',
  streetlight_out: 'Streetlight out',
  exposed_wire: 'Exposed electric wire',
  road_obstruction: 'Road obstruction',
  stray_dogs: 'Stray dogs',
  fallen_tree: 'Fallen or leaning tree',
  broken_sidewalk: 'Broken sidewalk',
  other: 'Something else',
};

/** Department and body names as they appear in Arabic (categories, server data). */
export const DEPARTMENT_EN: Record<string, string> = {
  'صيانة الطرق': 'Road Maintenance',
  'الصرف الصحي': 'Sewage Department',
  'شركة مياه الشرب': 'Water Company',
  'هيئة النظافة والتجميل': 'Cleaning & Beautification Authority',
  'إنارة الحي': 'District Lighting',
  'شركة الكهرباء': 'Electricity Company',
  'مرافق الحي': 'District Utilities',
  'الطب البيطري': 'Veterinary Services',
  'حدائق الحي': 'District Parks',
  'إدارة الحدائق': 'Parks Department',
  'الحي': 'The District',
};

export const STATUS_EN: Record<IncidentStatus, string> = {
  received: 'Received',
  triaged: 'Reviewed',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Fixed',
  closed: 'Closed',
};

export const SEVERITY_EN: Record<Severity, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
  critical: 'Danger',
};

export const PRIORITY_LEVEL_EN = {
  critical: 'Urgent priority',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Normal priority',
} as const;

/** Priority factor keys from logic/priority.ts. */
export const FACTOR_EN: Record<string, string> = {
  severity: 'How serious the problem is',
  sensitive: 'Near a school or hospital',
  reporters: 'Number of people who reported',
  age: 'Waiting time vs. target',
  equity: 'Area that needs more attention',
};

export const HOTLINE_EN: Record<string, string> = {
  '122': 'Police',
  '123': 'Ambulance',
  '180': 'Fire',
  '129': 'Gas',
  '125': 'Water',
  '121': 'Electricity',
  '175': 'Sewage',
};

/** Governorates and districts by their Arabic name (that's what the session stores). */
export const PLACE_EN: Record<string, string> = {
  'القاهرة': 'Cairo',
  'مدينة نصر أول': 'Nasr City 1',
  'مدينة نصر ثان': 'Nasr City 2',
  'مصر الجديدة': 'Heliopolis',
  'المعادي': 'Maadi',
  'عين شمس': 'Ain Shams',
  'شبرا': 'Shubra',
  'الجيزة': 'Giza',
  'الدقي': 'Dokki',
  'المهندسين': 'Mohandessin',
  'الهرم': 'Haram',
  'فيصل': 'Faisal',
  'إمبابة': 'Imbaba',
  'الإسكندرية': 'Alexandria',
  'سيدي جابر': 'Sidi Gaber',
  'المنتزه': 'Montaza',
  'العجمي': 'Agami',
  'القليوبية': 'Qalyubia',
  'شبرا الخيمة': 'Shubra El Kheima',
  'بنها': 'Banha',
  'القناطر الخيرية': 'El Qanater El Khayreya',
};

export const SERVICE_EN: Record<string, { title: string; subtitle: string }> = {
  bulky: { title: 'Bulky waste pickup', subtitle: 'Old furniture, appliances, building waste · within 48 hours' },
  tree: { title: 'Tree trimming or removal', subtitle: 'Parks Department · within 5 days' },
  'garbage-schedule': { title: 'Garbage collection times', subtitle: 'See when the truck comes to your street' },
};

export const SERVICE_TYPE_EN: Record<ServiceType, string> = {
  bulky_waste: 'Bulky waste pickup',
  tree_maintenance: 'Tree trimming or removal',
};

export const SERVICE_GROUP_EN: Record<string, string> = { all: 'All', cleaning: 'Cleaning', gardens: 'Parks', lighting: 'Lighting' };

/** Bulky items and tree work types by their Arabic label. */
export const ITEM_EN: Record<string, string> = {
  'كنبة': 'Sofa',
  'تلاجة قديمة': 'Old fridge',
  'سرير': 'Bed',
  'مخلفات بناء': 'Building waste',
  'تقليم': 'Trimming',
  'إزالة شجرة واقعة': 'Remove a fallen tree',
  'شجرة مايلة أو خطر': 'Leaning or unsafe tree',
  'رش / مكافحة آفات': 'Spraying / pest control',
};

/** No-break spaces keep "9 AM" together when a row wraps. */
export const SLOT_EN: Record<SlotId, string> = { morning: '9\u00a0AM – 12\u00a0PM', afternoon: '2\u00a0PM – 5\u00a0PM' };

export const PAYMENT_EN: Record<PaymentMethod, string> = {
  cash: 'Cash to the worker',
  fawry: 'Fawry',
  instapay: 'InstaPay',
  wallet: 'Mobile wallet',
};

export const FEE_LABEL_EN = 'as per the district’s rates';
export const FREE_SERVICE_LABEL_EN = 'Free service from the Parks Department';

export const MEDAL_EN: Record<string, string> = { 'جدع الشارع': 'Street Hero', 'جدع الحي': 'Neighbourhood Hero' };

export const WEEKDAY_EN = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' } as const;

// ---- Helpers (current language) ----

export const categoryLabel = (id: CategoryId, ar: string): string => pick(ar, CATEGORY_EN[id]);
/** For objects shaped like the CATEGORIES entries. */
export const labelOfCategory = (c: { id: CategoryId; labelAr: string }): string => categoryLabel(c.id, c.labelAr);
export const departmentLabel = (ar: string): string => pick(ar, DEPARTMENT_EN[ar]);
export const statusLabel = (s: IncidentStatus, ar: string): string => pick(ar, STATUS_EN[s]);
export const severityLabel = (s: Severity, ar: string): string => pick(ar, SEVERITY_EN[s]);
export const factorLabel = (key: string, ar: string): string => pick(ar, FACTOR_EN[key]);
export const hotlineLabel = (h: { number: string; labelAr: string }): string => pick(h.labelAr, HOTLINE_EN[h.number]);
/** Governorate or district name (Arabic in data). */
export const placeName = (ar: string): string => pick(ar, PLACE_EN[ar]);
export const serviceTitle = (s: { id: string; titleAr: string }): string => pick(s.titleAr, SERVICE_EN[s.id]?.title);
export const serviceSubtitle = (s: { id: string; subtitleAr: string }): string => pick(s.subtitleAr, SERVICE_EN[s.id]?.subtitle);
export const serviceTypeLabel = (t: ServiceType, ar: string): string => pick(ar, SERVICE_TYPE_EN[t]);
export const serviceGroupLabel = (g: { id: string; labelAr: string }): string => pick(g.labelAr, SERVICE_GROUP_EN[g.id]);
export const itemLabel = (ar: string): string => pick(ar, ITEM_EN[ar]);
export const slotLabel = (s: { id: SlotId; labelAr: string }): string => pick(s.labelAr, SLOT_EN[s.id]);
export const paymentLabelFor = (p: { id: PaymentMethod; labelAr: string }): string => pick(p.labelAr, PAYMENT_EN[p.id]);
export const medalTitle = (ar: string): string => pick(ar, MEDAL_EN[ar]);

// ---- CityCycle (waste and recycling) ----

export const MATERIAL_EN: Record<MaterialId, string> = {
  pet_plastic: 'Plastic bottles (PET)',
  paper_cardboard: 'Paper & cardboard',
  metal_cans: 'Metal & cans',
  glass: 'Glass',
  e_waste: 'Old electronics',
  cooking_oil: 'Used cooking oil',
  organics: 'Food scraps',
};

export const MATERIAL_TIP_EN: Record<MaterialId, string> = {
  pet_plastic: 'Water and juice bottles. Best empty and flattened.',
  paper_cardboard: 'Boxes, paper and newspapers. Best dry and flat.',
  metal_cans: 'Food and drink cans. Best empty and rinsed.',
  glass: 'Bottles and jars. Best unbroken, in a separate bag.',
  e_waste: 'Phones, chargers, cables and small devices. Please don’t break or open them.',
  cooking_oil: 'In a closed bottle, not mixed with water.',
  organics: 'Food and vegetable scraps in a separate bag, handed over the same day.',
};

export const PICKUP_STATUS_EN: Record<PickupStatus, string> = {
  requested: 'Waiting for a collector',
  accepted: 'Accepted, on the way',
  weighed: 'Weighed',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export const PICKUP_MODE_EN: Record<PickupMode, string> = { free: 'Give for free', paid: 'Get paid' };

export const COLLECTOR_STATUS_EN: Record<CollectorStatus, string> = {
  pending: 'We’re reviewing the application',
  verified: 'Verified',
  suspended: 'Suspended',
};

export const WEIGHING_SOURCE_EN: Record<WeighingSource, string> = { manual: 'Typed in', scale_ble: 'Bluetooth scale', scale_api: 'Hub scale' };

export const WASTE_SIZE_EN: Record<WasteSize, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

export const BIN_STATE_EN: Record<BinDisplayState, string> = {
  ok: 'OK',
  filling: 'Filling up',
  full: 'Full',
  hot: 'Heat alert',
  low_battery: 'Low battery',
  offline: 'Offline',
};

export const BIN_KIND_EN: Record<BinKind, string> = { street: 'Street bin', hub: 'Collection hub' };

/** Names that appear in mock/seed data and in the app copy. */
export const CITYCYCLE_EN = {
  pillar: 'CityCycle',
  pillarSub: 'Recycling',
  demoPrices: 'Demo prices',
  priceToBeSet: 'Price to be set',
  alreadyTaken: 'Already taken',
} as const;

export const materialLabel = (id: MaterialId): string => pick(getMaterial(id).labelAr, MATERIAL_EN[id]);
export const materialTip = (id: MaterialId): string => pick(getMaterial(id).tipAr, MATERIAL_TIP_EN[id]);
export const pickupStatusLabel = (s: PickupStatus): string => pick(PICKUP_STATUS_LABEL_AR[s], PICKUP_STATUS_EN[s]);
export const pickupModeLabel = (m: PickupMode): string => pick(PICKUP_MODE_LABEL_AR[m], PICKUP_MODE_EN[m]);
export const collectorStatusLabel = (s: CollectorStatus): string => pick(COLLECTOR_STATUS_LABEL_AR[s], COLLECTOR_STATUS_EN[s]);
export const weighingSourceLabel = (s: WeighingSource): string => pick(WEIGHING_SOURCE_LABEL_AR[s], WEIGHING_SOURCE_EN[s]);
export const wasteSizeLabel = (s: WasteSize): string => pick(WASTE_SIZE_LABEL_AR[s], WASTE_SIZE_EN[s]);
/** Label for a bin state, with "filling" included. */
export const binStateLabel = (s: BinDisplayState): string => pick(BIN_STATE_LABEL_AR[s], BIN_STATE_EN[s]);
export const binKindLabel = (k: BinKind): string => pick(k === 'hub' ? 'مركز تجميع' : 'صندوق شارع', BIN_KIND_EN[k]);
/** The small label shown next to every price or value that comes from demo prices. */
export const demoPricesLabel = (): string => pick('أسعار تجريبية', CITYCYCLE_EN.demoPrices);
/** Shown instead of a value when the district has no price for a material. */
export const priceToBeSetLabel = (): string => pick('السعر هيتحدد', CITYCYCLE_EN.priceToBeSet);
/** 409 on accept: another collector was first. */
export const alreadyTakenLabel = (): string => pick('اتاخد خلاص', CITYCYCLE_EN.alreadyTaken);
