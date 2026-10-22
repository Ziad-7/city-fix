import { type Bin, type Collector, type PickupItem, type PickupMode, type PickupStatus, type RecyclingPickup, type Weighing } from '@/domain/citycycle';
import { binStateFromReading } from '@/domain/bins';
import { DEMO_MATERIAL_PRICES, estimatedValue, aggregateWeighings, weighingValue } from '@/domain/materials';
import { nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { pickupTimelineEntry } from './citycycle-timeline';
import type { DbTimelineEntry } from './timeline';

/** The demo collector's sign-in identity in mock mode (the citizen demo user is `demo-user`). */
export const DEMO_COLLECTOR_USER_ID = 'demo-collector';
export const DEMO_COLLECTOR_ID = 'COL-101';
/** A second verified collector, so "first accept wins" can be shown and tested. */
export const OTHER_COLLECTOR_USER_ID = 'demo-collector-2';

export type DbPickup = Omit<RecyclingPickup, 'timeline'> & {
  timeline: DbTimelineEntry[];
  addressEn?: string;
  landmarkEn?: string;
  collectorNameEn?: string;
};
export type DbBin = Bin & {
  nameEn?: string;
  addressEn?: string;
  /** Mock only: how many fill points the bin gains on each refresh (0 for full and heat-alert bins). */
  driftPct: number;
  /** Mock only: reading counter, like the device's `seq`. */
  seq: number;
};
export type DbCollector = Collector & { userId: string; nameEn: string; vehicleEn?: string };
export type DbBinReport = { id: string; binId: string; userId: string; reportId: string; note?: string; at: string };
export type DbCityCycle = { pickups: DbPickup[]; bins: DbBin[]; collectors: DbCollector[]; binReports: DbBinReport[]; pickupCounter: number };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

const STREETS = {
  akkad: { ar: 'شارع عباس العقاد', en: 'Abbas El Akkad St' },
  tayaran: { ar: 'شارع الطيران', en: 'El Tayaran St' },
  makram: { ar: 'شارع مكرم عبيد', en: 'Makram Ebeid St' },
  nahas: { ar: 'شارع مصطفى النحاس', en: 'Mostafa El Nahas St' },
  youssef: { ar: 'شارع يوسف عباس', en: 'Youssef Abbas St' },
  maamoun: { ar: 'شارع حسن المأمون', en: 'Hassan El Maamoun St' },
  zaker: { ar: 'شارع ذاكر حسين', en: 'Zaker Hussein St' },
} as const;

export function buildCityCycleSeed(now: number = Date.now()): DbCityCycle {
  return { pickups: buildPickups(now), bins: buildBins(now), collectors: buildCollectors(now), binReports: [], pickupCounter: 3007 };
}

// ---- Collectors ----

function buildCollectors(now: number): DbCollector[] {
  return [
    {
      id: DEMO_COLLECTOR_ID,
      userId: DEMO_COLLECTOR_USER_ID,
      name: 'محمود سعيد',
      nameEn: 'Mahmoud Saeed',
      district: 'مدينة نصر أول',
      status: 'verified',
      materials: ['pet_plastic', 'paper_cardboard', 'metal_cans', 'glass', 'cooking_oil'],
      vehicle: 'تروسيكل',
      vehicleEn: 'Cargo tricycle',
      joinedAt: iso(now - 200 * DAY),
    },
    {
      id: 'COL-102',
      userId: OTHER_COLLECTOR_USER_ID,
      name: 'سامح عادل',
      nameEn: 'Sameh Adel',
      district: 'مدينة نصر أول',
      status: 'verified',
      materials: ['paper_cardboard', 'metal_cans', 'e_waste'],
      vehicle: 'سيارة ربع نقل',
      vehicleEn: 'Pickup truck',
      joinedAt: iso(now - 90 * DAY),
    },
  ];
}

// ---- Pickups ----

type Spec = {
  n: number;
  citizenId: string;
  items: PickupItem[];
  street: keyof typeof STREETS;
  area?: [number, number];
  building: string;
  buildingEn: string;
  landmark?: string;
  landmarkEn?: string;
  lat: number;
  lng: number;
  mode: PickupMode;
  slot: SlotId;
  /** days from today for the pickup day (negative = past) */
  dayOffset: number;
  createdAgoH: number;
  status: PickupStatus;
  /** weighed kg per material, for weighed/completed rows */
  weighed?: Partial<Record<PickupItem['materialId'], number>>;
  paid?: number;
  collector?: DbCollector;
};

function pickupFrom(spec: Spec, now: number): DbPickup {
  const created = now - spec.createdAgoH * HOUR;
  const dayMs = now + spec.dayOffset * DAY;
  const day = spec.dayOffset >= 1 ? nextWorkingDays(Math.max(1, spec.dayOffset), new Date(now)).pop()! : iso(dayMs).slice(0, 10);
  const street = STREETS[spec.street];
  const prices = Object.entries(DEMO_MATERIAL_PRICES).map(([materialId, priceEgpPerKg]) => ({ materialId: materialId as PickupItem['materialId'], priceEgpPerKg }));
  const who = spec.collector ? { collectorName: spec.collector.name.split(' ')[0], collectorNameEn: spec.collector.nameEn.split(' ')[0] } : {};
  const timeline: DbTimelineEntry[] = [pickupTimelineEntry('requested', iso(created))];
  const weighings: Weighing[] = [];
  const reached = ['requested', 'accepted', 'weighed', 'completed'].indexOf(spec.status);
  if (reached >= 1 && spec.collector) timeline.push(pickupTimelineEntry('accepted', iso(created + 2 * HOUR), who));
  if (reached >= 2 && spec.weighed) {
    let i = 0;
    for (const [materialId, kg] of Object.entries(spec.weighed) as [PickupItem['materialId'], number][]) {
      const price = DEMO_MATERIAL_PRICES[materialId];
      weighings.push({
        id: `W-${spec.n}-${++i}`,
        pickupId: `RCY-${spec.n}`,
        materialId,
        kg,
        source: 'manual',
        priceEgpPerKg: price,
        valueEgp: weighingValue(kg, price),
        clientId: `seed-${spec.n}-${i}`,
        at: iso(created + 4 * HOUR),
      });
    }
    timeline.push(pickupTimelineEntry('weighed', iso(created + 4 * HOUR), who, { totalKg: aggregateWeighings(weighings).totalKg }));
  }
  if (spec.status === 'completed') timeline.push(pickupTimelineEntry('completed', iso(created + 5 * HOUR), who, { paidEgp: spec.paid }));
  const agg = aggregateWeighings(weighings);
  const estimated = estimatedValue(spec.items, prices);
  return {
    id: `RCY-${spec.n}`,
    citizenId: spec.citizenId,
    items: spec.items,
    photoUris: [],
    location: {
      lat: spec.lat,
      lng: spec.lng,
      address: `${spec.building}، ${street.ar}، مدينة نصر`,
      ...(spec.landmark ? { landmark: spec.landmark } : {}),
    },
    addressEn: `${spec.buildingEn}, ${street.en}, Nasr City`,
    landmarkEn: spec.landmarkEn,
    day,
    slot: spec.slot,
    mode: spec.mode,
    ...(estimated !== undefined ? { estimatedValueEgp: estimated } : {}),
    status: spec.status,
    ...(spec.collector ? { collectorId: spec.collector.id, collectorName: who.collectorName, collectorNameEn: who.collectorNameEn } : {}),
    weighings,
    ...(weighings.length ? { totalKg: agg.totalKg, totalValueEgp: agg.valueEgp } : {}),
    ...(spec.paid ? { paidToHouseholdEgp: spec.paid } : {}),
    timeline,
    createdAt: iso(created),
  };
}

function buildPickups(now: number): DbPickup[] {
  const mahmoud = buildCollectors(now)[0];
  const specs: Spec[] = [
    // Open jobs from other households (the collector's list).
    { n: 3003, citizenId: 'household-3', items: [{ materialId: 'pet_plastic', estimatedKg: 4 }, { materialId: 'paper_cardboard', estimatedKg: 6 }], street: 'makram', building: 'عمارة ٢٣', buildingEn: 'Building 23', landmark: 'جنب الصيدلية', landmarkEn: 'Next to the pharmacy', lat: 30.0621, lng: 31.3478, mode: 'paid', slot: 'morning', dayOffset: 1, createdAgoH: 3, status: 'requested' },
    { n: 3004, citizenId: 'household-4', items: [{ materialId: 'glass', estimatedKg: 3 }, { materialId: 'metal_cans', estimatedKg: 2.5 }], street: 'youssef', building: 'عمارة ٧', buildingEn: 'Building 7', landmark: 'قدام الجراج', landmarkEn: 'In front of the garage', lat: 30.0642, lng: 31.3331, mode: 'free', slot: 'afternoon', dayOffset: 1, createdAgoH: 6, status: 'requested' },
    { n: 3005, citizenId: 'household-5', items: [{ materialId: 'cooking_oil', estimatedKg: 5 }], street: 'maamoun', building: 'عمارة ١٤', buildingEn: 'Building 14', lat: 30.0576, lng: 31.3412, mode: 'paid', slot: 'morning', dayOffset: 2, createdAgoH: 9, status: 'requested' },
    { n: 3006, citizenId: 'household-6', items: [{ materialId: 'e_waste', estimatedKg: 2 }, { materialId: 'paper_cardboard', estimatedKg: 8 }], street: 'tayaran', building: 'عمارة ٣٠', buildingEn: 'Building 30', landmark: 'قدام محل الموبايلات', landmarkEn: 'In front of the phone shop', lat: 30.0703, lng: 31.3406, mode: 'paid', slot: 'afternoon', dayOffset: 2, createdAgoH: 1, status: 'requested' },
    // Past pickups of the demo citizen.
    { n: 3001, citizenId: 'demo-user', items: [{ materialId: 'pet_plastic', estimatedKg: 5 }, { materialId: 'paper_cardboard', estimatedKg: 8 }], street: 'akkad', building: 'عمارة ١٢', buildingEn: 'Building 12', landmark: 'قدام مدرسة النصر الإعدادية', landmarkEn: 'In front of El Nasr Preparatory School', lat: 30.056, lng: 31.33, mode: 'paid', slot: 'morning', dayOffset: -6, createdAgoH: 6 * 24 + 8, status: 'completed', weighed: { paper_cardboard: 7.4, pet_plastic: 4.6 }, paid: 75, collector: mahmoud },
    { n: 3002, citizenId: 'demo-user', items: [{ materialId: 'metal_cans', estimatedKg: 3 }, { materialId: 'cooking_oil', estimatedKg: 4 }], street: 'akkad', building: 'عمارة ١٢', buildingEn: 'Building 12', landmark: 'قدام مدرسة النصر الإعدادية', landmarkEn: 'In front of El Nasr Preparatory School', lat: 30.056, lng: 31.33, mode: 'paid', slot: 'afternoon', dayOffset: -14, createdAgoH: 14 * 24 + 6, status: 'completed', weighed: { cooking_oil: 3.5, metal_cans: 2.8 }, paid: 85, collector: mahmoud },
    // A job the demo collector finished today (so "today" in the earnings screen is not empty).
    { n: 2999, citizenId: 'household-9', items: [{ materialId: 'glass', estimatedKg: 6 }, { materialId: 'pet_plastic', estimatedKg: 3 }], street: 'zaker', building: 'عمارة ٥', buildingEn: 'Building 5', lat: 30.0502, lng: 31.3287, mode: 'paid', slot: 'morning', dayOffset: 0, createdAgoH: 6, status: 'completed', weighed: { glass: 6, pet_plastic: 3.2 }, paid: 38, collector: mahmoud },
  ];
  return specs.map((s) => pickupFrom(s, now));
}

// ---- Smart bins ----

type BinSpec = {
  n: number;
  street: keyof typeof STREETS;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  kind: 'street' | 'hub';
  fillPct: number;
  tempC: number;
  batteryV: number;
  driftPct: number;
  seenMinAgo: number;
};

function buildBins(now: number): DbBin[] {
  const specs: BinSpec[] = [
    { n: 11, street: 'akkad', name: 'صندوق عباس العقاد', nameEn: 'Abbas El Akkad bin', lat: 30.0586, lng: 31.3338, kind: 'street', fillPct: 18, tempC: 31, batteryV: 3.95, driftPct: 2, seenMinAgo: 6 },
    { n: 12, street: 'tayaran', name: 'صندوق الطيران', nameEn: 'El Tayaran bin', lat: 30.0698, lng: 31.3401, kind: 'street', fillPct: 41, tempC: 33, batteryV: 3.88, driftPct: 2, seenMinAgo: 12 },
    { n: 13, street: 'makram', name: 'صندوق مكرم عبيد', nameEn: 'Makram Ebeid bin', lat: 30.0617, lng: 31.3472, kind: 'street', fillPct: 64, tempC: 34, batteryV: 3.8, driftPct: 3, seenMinAgo: 4 },
    { n: 14, street: 'nahas', name: 'صندوق مصطفى النحاس', nameEn: 'Mostafa El Nahas bin', lat: 30.0543, lng: 31.3436, kind: 'street', fillPct: 92, tempC: 36, batteryV: 3.72, driftPct: 0, seenMinAgo: 9 },
    { n: 15, street: 'youssef', name: 'صندوق يوسف عباس', nameEn: 'Youssef Abbas bin', lat: 30.0648, lng: 31.3326, kind: 'street', fillPct: 27, tempC: 32, batteryV: 3.4, driftPct: 1, seenMinAgo: 20 },
    { n: 16, street: 'maamoun', name: 'صندوق حسن المأمون', nameEn: 'Hassan El Maamoun bin', lat: 30.0572, lng: 31.3416, kind: 'street', fillPct: 71, tempC: 35, batteryV: 3.84, driftPct: 3, seenMinAgo: 7 },
    { n: 17, street: 'zaker', name: 'صندوق ذاكر حسين', nameEn: 'Zaker Hussein bin', lat: 30.0497, lng: 31.3281, kind: 'street', fillPct: 58, tempC: 68, batteryV: 3.76, driftPct: 0, seenMinAgo: 3 },
    { n: 18, street: 'nahas', name: 'مركز تجميع مصطفى النحاس', nameEn: 'Mostafa El Nahas collection hub', lat: 30.0551, lng: 31.3423, kind: 'hub', fillPct: 33, tempC: 30, batteryV: 4.05, driftPct: 1, seenMinAgo: 2 },
  ];
  return specs.map((s) => {
    const lastSeenAt = iso(now - s.seenMinAgo * 60_000);
    const street = STREETS[s.street];
    return {
      id: `BIN-0${s.n}`,
      name: s.name,
      nameEn: s.nameEn,
      location: { lat: s.lat, lng: s.lng, address: `${street.ar}، مدينة نصر` },
      addressEn: `${street.en}, Nasr City`,
      kind: s.kind,
      fillPct: s.fillPct,
      tempC: s.tempC,
      batteryV: s.batteryV,
      state: binStateFromReading({ fillPct: s.fillPct, tempC: s.tempC, batteryV: s.batteryV, lastSeenAt }, now),
      lastSeenAt,
      driftPct: s.driftPct,
      seq: 1000 + s.n,
    };
  });
}

