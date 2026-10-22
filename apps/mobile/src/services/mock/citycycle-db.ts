import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Bin, Collector, MaterialPrice, PickupTimelineEntry, RecyclingPickup } from '@/domain/citycycle';
import { nextWorkingDays } from '@/domain/services-catalog';

/**
 * Mock database for CityCycle, kept apart from the FixFirst mock (own storage key) so the two never disturb each
 * other. Like the main mock, rows carry English text next to the Arabic; the services return the plain API types
 * (see citycycle-services.ts).
 *
 * The prices below are DEMO values to make the screens testable. Real prices come only from the district price
 * list (backend, admin sets them): the app never hard-codes one, and a material without a price shows
 * "السعر هيتحدد" / "Price to be set". Two materials are left without a price on purpose.
 */

export type DbPickupTimelineEntry = PickupTimelineEntry & { noteEn?: string; actorEn?: string };
export type DbPickup = Omit<RecyclingPickup, 'timeline'> & { timeline: DbPickupTimelineEntry[]; addressEn?: string; landmarkEn?: string };
export type DbBin = Bin & { nameEn?: string; addressEn?: string };

export type CityCycleDb = {
  pickups: DbPickup[];
  prices: MaterialPrice[];
  /** userId -> the collector profile that user applied with */
  collectors: Record<string, Collector>;
  bins: DbBin[];
  counters: { pickup: number; weighing: number; collector: number };
};

const KEY = 'ftc.mock.citycycle.v1';
const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

export function buildCityCycleSeed(now: number = Date.now()): CityCycleDb {
  const [d1, d2] = nextWorkingDays(2);
  const district = 'مدينة نصر أول';
  const seedEntry = (at: string): DbPickupTimelineEntry => ({
    status: 'requested',
    at,
    actor: 'سيتي سايكل',
    note: 'طلبك وصل وبندوّر على جامع قريب',
    actorEn: 'CityCycle',
    noteEn: 'Your request is in. We’re looking for a nearby collector',
  });
  const house = (
    n: number,
    h: number,
    p: Pick<DbPickup, 'items' | 'mode' | 'day' | 'slot' | 'note'> & { address: string; addressEn: string; landmark?: string; landmarkEn?: string; lat: number; lng: number },
  ): DbPickup => {
    const at = iso(now - h * HOUR);
    return {
      id: `RCY-${3000 + n}`,
      citizenId: `seed-household-${n}`,
      items: p.items,
      photoUris: [],
      location: { lat: p.lat, lng: p.lng, address: p.address, landmark: p.landmark },
      addressEn: p.addressEn,
      landmarkEn: p.landmarkEn,
      day: p.day,
      slot: p.slot,
      mode: p.mode,
      note: p.note,
      status: 'requested',
      weighings: [],
      timeline: [seedEntry(at)],
      createdAt: at,
    };
  };

  const updatedAt = iso(now - 24 * HOUR);
  const price = (materialId: MaterialPrice['materialId'], priceEgpPerKg: number | null): MaterialPrice => ({ materialId, district, priceEgpPerKg, updatedAt });

  const bin = (b: Omit<DbBin, 'location'> & { lat: number; lng: number; address: string; addressEn: string }): DbBin => {
    const { lat, lng, address, addressEn, ...rest } = b;
    return { ...rest, location: { lat, lng, address }, addressEn };
  };

  return {
    pickups: [
      house(1, 3, { items: [{ materialId: 'pet_plastic', estimatedKg: 4 }, { materialId: 'paper_cardboard', estimatedKg: 6 }], mode: 'paid', day: d1, slot: 'morning', address: 'شارع عباس العقاد، مدينة نصر', addressEn: 'Abbas El Akkad St, Nasr City', landmark: 'جنب صيدلية السلام', landmarkEn: 'Next to El Salam Pharmacy', lat: 30.0562, lng: 31.3305 }),
      house(2, 6, { items: [{ materialId: 'metal_cans', estimatedKg: 3 }, { materialId: 'glass', estimatedKg: 5 }], mode: 'paid', day: d1, slot: 'afternoon', address: 'شارع مكرم عبيد، مدينة نصر', addressEn: 'Makram Ebeid St, Nasr City', lat: 30.054, lng: 31.3335 }),
      house(3, 9, { items: [{ materialId: 'cooking_oil', estimatedKg: 6 }], mode: 'free', day: d2, slot: 'morning', address: 'شارع الطيران، مدينة نصر', addressEn: 'El Tayaran St, Nasr City', landmark: 'قدام مدرسة الطيران', landmarkEn: 'In front of El Tayaran School', lat: 30.059, lng: 31.335 }),
      house(4, 20, { items: [{ materialId: 'e_waste', estimatedKg: 2 }, { materialId: 'organics', estimatedKg: 3 }], mode: 'free', day: d2, slot: 'afternoon', address: 'شارع الحجاز، مدينة نصر', addressEn: 'El Hegaz St, Nasr City', lat: 30.052, lng: 31.327 }),
    ],
    prices: [
      price('pet_plastic', 5),
      price('paper_cardboard', 3),
      price('metal_cans', 12),
      price('glass', 1),
      price('e_waste', null),
      price('cooking_oil', 10),
      price('organics', null),
    ],
    collectors: {},
    bins: [
      bin({ id: 'BIN-011', name: 'صندوق شارع عباس العقاد', nameEn: 'Abbas El Akkad St bin', kind: 'street', fillPct: 34, tempC: 29, batteryV: 3.9, state: 'ok', lastSeenAt: iso(now - 0.2 * HOUR), lat: 30.0568, lng: 31.3312, address: 'شارع عباس العقاد', addressEn: 'Abbas El Akkad St' }),
      bin({ id: 'BIN-012', name: 'صندوق شارع الطيران', nameEn: 'El Tayaran St bin', kind: 'street', fillPct: 94, tempC: 31, batteryV: 3.8, state: 'full', lastSeenAt: iso(now - 0.4 * HOUR), lat: 30.0585, lng: 31.3342, address: 'شارع الطيران', addressEn: 'El Tayaran St' }),
      bin({ id: 'BIN-013', name: 'صندوق شارع مكرم عبيد', nameEn: 'Makram Ebeid St bin', kind: 'street', fillPct: 61, tempC: 63, batteryV: 3.7, state: 'hot', lastSeenAt: iso(now - 0.1 * HOUR), lat: 30.0545, lng: 31.3328, address: 'شارع مكرم عبيد', addressEn: 'Makram Ebeid St' }),
      bin({ id: 'BIN-014', name: 'صندوق شارع الحجاز', nameEn: 'El Hegaz St bin', kind: 'street', fillPct: 48, tempC: 30, batteryV: 3.3, state: 'low_battery', lastSeenAt: iso(now - 1 * HOUR), lat: 30.0522, lng: 31.3282, address: 'شارع الحجاز', addressEn: 'El Hegaz St' }),
      bin({ id: 'BIN-015', name: 'صندوق شارع الثورة', nameEn: 'El Thawra St bin', kind: 'street', state: 'offline', lastSeenAt: iso(now - 30 * HOUR), lat: 30.0608, lng: 31.3318, address: 'شارع الثورة', addressEn: 'El Thawra St' }),
      bin({ id: 'BIN-016', name: 'صندوق شارع يوسف عباس', nameEn: 'Youssef Abbas St bin', kind: 'street', fillPct: 22, tempC: 28, batteryV: 4, state: 'ok', lastSeenAt: iso(now - 0.3 * HOUR), lat: 30.0551, lng: 31.3376, address: 'شارع يوسف عباس', addressEn: 'Youssef Abbas St' }),
      bin({ id: 'HUB-001', name: 'نقطة تجميع الحي', nameEn: 'District collection hub', kind: 'hub', fillPct: 55, tempC: 30, batteryV: 4.1, state: 'ok', lastSeenAt: iso(now - 0.5 * HOUR), lat: 30.0558, lng: 31.3295, address: 'ناصية شارع عباس العقاد', addressEn: 'Corner of Abbas El Akkad St' }),
    ],
    counters: { pickup: 3101, weighing: 1, collector: 1 },
  };
}

// One in-flight load shared by every caller (same reason as the main mock database).
let loading: Promise<CityCycleDb> | null = null;

async function readOrSeed(): Promise<CityCycleDb> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CityCycleDb;
  } catch {
    // fall through to a fresh seed
  }
  const seed = buildCityCycleSeed();
  await persist(seed);
  return seed;
}

export function loadCityCycleDb(): Promise<CityCycleDb> {
  return (loading ??= readOrSeed());
}

async function persist(db: CityCycleDb): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // persistence is best-effort in the mock
  }
}

export async function saveCityCycleDb(db: CityCycleDb): Promise<void> {
  loading = Promise.resolve(db);
  await persist(db);
}

/** Wipes the persisted CityCycle mock data (the next load re-seeds). */
export async function resetCityCycleDb(): Promise<void> {
  loading = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
