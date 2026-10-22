import { ApiError, http } from '@/lib/http';
import type {
  Collector,
  CollectorStatus,
  MaterialId,
  MaterialPrice,
  PickupStatus,
  RecyclingPickup,
  RecyclingSummary,
} from '@/domain/citycycle-types';
import { MATERIAL_IDS } from '@/domain/citycycle-types';

/**
 * CityCycle admin API. Routes marked "assumed" are not in docs/api-contract.md yet
 * (the contract lists the pickups queue as "admin view"); when the server answers
 * 404/405/501 the service falls back to an in-memory demo so the pages still work.
 */
let demoMode = false;
export const isCityCycleDemo = (): boolean => demoMode;
export const resetCityCycleDemo = (): void => {
  demoMode = false;
  mock = seed();
};

const MISSING = new Set([404, 405, 501]);

async function withFallback<T>(live: () => Promise<T>, demo: () => T): Promise<T> {
  try {
    const r = await live();
    return r;
  } catch (e) {
    if (e instanceof ApiError && MISSING.has(e.status)) {
      demoMode = true;
      return demo();
    }
    throw e;
  }
}

// ---- demo store -------------------------------------------------------------
interface Store {
  pickups: RecyclingPickup[];
  collectors: Collector[];
  prices: MaterialPrice[];
}

function seed(): Store {
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  return {
    pickups: [
      { id: 'RCY-3001', items: [{ materialId: 'pet_plastic', estimatedKg: 6 }], location: { address: 'شارع الطيران، مدينة نصر' }, day, slot: 'morning', mode: 'paid', status: 'requested', createdAt: now },
      { id: 'RCY-3002', items: [{ materialId: 'paper_cardboard', estimatedKg: 12 }, { materialId: 'metal_cans', estimatedKg: 3 }], location: { address: 'شارع الحجاز، مصر الجديدة' }, day, slot: 'afternoon', mode: 'free', status: 'accepted', collectorId: 'COL-1', collectorName: 'محمود', createdAt: now },
      { id: 'RCY-3003', items: [{ materialId: 'glass', estimatedKg: 8 }], location: { address: 'شارع عباس العقاد' }, day, slot: 'morning', mode: 'paid', status: 'weighed', collectorId: 'COL-1', collectorName: 'محمود', totalKg: 7.5, createdAt: now },
    ],
    collectors: [
      { id: 'COL-1', name: 'محمود', district: 'مدينة نصر', status: 'verified', materials: ['pet_plastic', 'paper_cardboard', 'glass'], vehicle: 'تروسيكل', joinedAt: now },
      { id: 'COL-2', name: 'سعيد', district: 'مصر الجديدة', status: 'pending', materials: ['metal_cans'], vehicle: 'ميكروباص', joinedAt: now },
    ],
    prices: MATERIAL_IDS.map((materialId) => ({ materialId, district: 'مدينة نصر', priceEgpPerKg: null })),
  };
}
let mock: Store = seed();

// ---- pickups (assumed routes) -----------------------------------------------
export async function getPickups(status?: PickupStatus): Promise<RecyclingPickup[]> {
  const qs = status ? `?status=${status}` : '';
  return withFallback(
    async () => (await http<RecyclingPickup[]>('GET', `/admin/recycling/pickups${qs}`)) ?? [],
    () => mock.pickups.filter((p) => !status || p.status === status),
  );
}

export async function patchPickup(
  id: string,
  body: { status: PickupStatus; collectorId?: string; note?: string },
): Promise<RecyclingPickup> {
  return withFallback(
    async () => {
      const r = await http<RecyclingPickup>('PATCH', `/admin/recycling/pickups/${encodeURIComponent(id)}`, body);
      if (!r) throw new ApiError(500, 'empty');
      return r;
    },
    () => {
      const p = mock.pickups.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'مش موجود');
      p.status = body.status;
      if (body.note) p.note = body.note;
      return { ...p };
    },
  );
}

// ---- collectors -------------------------------------------------------------
export async function getCollectors(status?: CollectorStatus): Promise<Collector[]> {
  const qs = status ? `?status=${status}` : '';
  return withFallback(
    async () => (await http<Collector[]>('GET', `/admin/collectors${qs}`)) ?? [],
    () => mock.collectors.filter((c) => !status || c.status === status),
  );
}

export async function patchCollector(id: string, body: { status: CollectorStatus; note?: string }): Promise<Collector> {
  return withFallback(
    async () => {
      const r = await http<Collector>('PATCH', `/admin/collectors/${encodeURIComponent(id)}`, body);
      if (!r) throw new ApiError(500, 'empty');
      return r;
    },
    () => {
      const c = mock.collectors.find((x) => x.id === id);
      if (!c) throw new ApiError(404, 'مش موجود');
      c.status = body.status;
      return { ...c };
    },
  );
}

// ---- price list -------------------------------------------------------------
export async function getMaterialPrices(district?: string): Promise<MaterialPrice[]> {
  const qs = district ? `?district=${encodeURIComponent(district)}` : '';
  return withFallback(
    async () => (await http<MaterialPrice[]>('GET', `/admin/material-prices${qs}`)) ?? [],
    () => mock.prices.map((p) => ({ ...p })),
  );
}

export async function putMaterialPrices(
  district: string,
  prices: { materialId: MaterialId; priceEgpPerKg: number }[],
): Promise<void> {
  await withFallback(
    async () => {
      await http('PUT', '/admin/material-prices', { district, prices });
    },
    () => {
      const at = new Date().toISOString();
      for (const row of prices) {
        const p = mock.prices.find((x) => x.materialId === row.materialId);
        if (p) {
          p.priceEgpPerKg = row.priceEgpPerKg;
          p.updatedAt = at;
        }
      }
    },
  );
}

// ---- impact -----------------------------------------------------------------
export async function getRecyclingSummary(): Promise<RecyclingSummary> {
  return withFallback(
    async () => {
      const r = await http<Partial<RecyclingSummary> & { totalTonnes?: number }>('GET', '/admin/recycling/summary');
      return {
        totalKg: r?.totalKg ?? (r?.totalTonnes != null ? r.totalTonnes * 1000 : 0),
        pickups: r?.pickups ?? 0,
        avgResponseMinutes: r?.avgResponseMinutes,
        byMaterial: r?.byMaterial ?? [],
        byDistrict: r?.byDistrict ?? [],
      };
    },
    () => ({
      totalKg: 1240,
      pickups: mock.pickups.length,
      avgResponseMinutes: 95,
      byMaterial: [
        { materialId: 'pet_plastic', kg: 430 },
        { materialId: 'paper_cardboard', kg: 610 },
        { materialId: 'glass', kg: 200 },
      ],
      byDistrict: [{ district: 'مدينة نصر', kg: 800 }, { district: 'مصر الجديدة', kg: 440 }],
    }),
  );
}
