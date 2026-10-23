import { ApiError, http, isMissingRoute, MSG_GENERIC } from '@/lib/http';
import type {
  Collector,
  CollectorPayout,
  CollectorStatus,
  MaterialId,
  MaterialPrice,
  OptimizeRoutesInput,
  OptimizeRoutesResult,
  PickupStatus,
  RecyclingPickup,
  RecyclingSummary,
} from '@/domain/citycycle-types';
import { MATERIAL_IDS } from '@/domain/citycycle-types';

/**
 * CityCycle admin API. Routes marked "" are not in docs/api-contract.md yet
 * (the contract lists the pickups queue as "admin view"); when the server answers
 * 404/405/501 the service falls back to an in-memory demo so the pages still work.
 */
type Resource = 'pickups' | 'collectors' | 'prices' | 'summary' | 'payouts';
const demo = new Set<Resource>();
const listeners = new Set<() => void>();
export const isCityCycleDemo = (): boolean => demo.size > 0;
export const subscribeCityCycleDemo = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const resetCityCycleDemo = (): void => {
  demo.clear();
  mock = seed();
  listeners.forEach((fn) => fn());
};

/**
 * List GETs decide demo mode once per resource: only when the route itself is missing
 * (404/405/501). Everything else (403, 5xx, network) surfaces as an error.
 */
async function listOrDemo<T>(res: Resource, live: () => Promise<T>, fake: () => T): Promise<T> {
  if (demo.has(res)) return fake();
  try {
    return await live();
  } catch (e) {
    if (isMissingRoute(e)) {
      demo.add(res);
      listeners.forEach((fn) => fn());
      return fake();
    }
    throw e;
  }
}

/** Mutations use the demo store only when that resource's list already switched to demo; never otherwise. */
async function mutate<T>(res: Resource, live: () => Promise<T>, fake: () => T): Promise<T> {
  return demo.has(res) ? fake() : live();
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

// ---- pickups (W3: GET and PATCH /admin/recycling/pickups) ---------------------
export async function getPickups(status?: PickupStatus): Promise<RecyclingPickup[]> {
  const qs = status ? `?status=${status}` : '';
  return listOrDemo(
    'pickups',
    async () => (await http<RecyclingPickup[]>('GET', `/admin/recycling/pickups${qs}`)) ?? [],
    () => mock.pickups.filter((p) => !status || p.status === status),
  );
}

/** Staff can only cancel (requested/accepted); the other transitions belong to collectors and households. */
export async function cancelPickup(id: string, note?: string): Promise<RecyclingPickup> {
  return mutate(
    'pickups',
    async () => {
      const r = await http<RecyclingPickup>('PATCH', `/admin/recycling/pickups/${encodeURIComponent(id)}`, {
        status: 'cancelled',
        note,
      });
      if (!r) throw new ApiError(500, 'empty');
      return r;
    },
    () => {
      const p = mock.pickups.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'مش موجود');
      p.status = 'cancelled';
      return { ...p };
    },
  );
}

// ---- collectors -------------------------------------------------------------
export async function getCollectors(status?: CollectorStatus): Promise<Collector[]> {
  const qs = status ? `?status=${status}` : '';
  return listOrDemo(
    'collectors',
    async () => (await http<Collector[]>('GET', `/admin/collectors${qs}`)) ?? [],
    () => mock.collectors.filter((c) => !status || c.status === status),
  );
}

export async function patchCollector(id: string, body: { status: CollectorStatus; note?: string }): Promise<Collector> {
  return mutate(
    'collectors',
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
  return listOrDemo(
    'prices',
    async () => (await http<MaterialPrice[]>('GET', `/admin/material-prices${qs}`)) ?? [],
    () => mock.prices.map((p) => ({ ...p })),
  );
}

export async function putMaterialPrices(
  district: string,
  prices: { materialId: MaterialId; priceEgpPerKg: number }[],
): Promise<void> {
  await mutate(
    'prices',
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
  return listOrDemo(
    'summary',
    async () => {
      const r = await http<Partial<RecyclingSummary>>('GET', '/admin/recycling/summary');
      return {
        totalKg: r?.totalKg ?? 0,
        pickups: r?.pickups ?? 0,
        avgResponseMinutes: r?.avgResponseMinutes ?? null,
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

// ---- payouts (recorded from weighings and hand-overs; the system pays nothing) --
export async function getPayouts(range?: { from?: string; to?: string }): Promise<CollectorPayout[]> {
  const qs = new URLSearchParams();
  if (range?.from) qs.set('from', range.from);
  if (range?.to) qs.set('to', range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return listOrDemo(
    'payouts',
    async () => (await http<CollectorPayout[]>('GET', `/admin/payouts${suffix}`)) ?? [],
    () => {
      // Only weights already in the demo pickups; no prices or cash are invented.
      const rows = new Map<string, CollectorPayout>();
      for (const p of mock.pickups) {
        if (!p.collectorId || p.totalKg == null || (p.status !== 'weighed' && p.status !== 'completed')) continue;
        const row = rows.get(p.collectorId) ?? {
          collectorId: p.collectorId,
          collectorName: p.collectorName ?? null,
          kg: 0,
          valueEgp: 0,
          paidToHouseholdsEgp: 0,
          jobs: 0,
        };
        row.kg += p.totalKg;
        row.jobs += 1;
        rows.set(p.collectorId, row);
      }
      return [...rows.values()];
    },
  );
}

// ---- route planner (preview only; never falls back to the demo store) ---------
export async function optimizeRoutes(body: OptimizeRoutesInput): Promise<OptimizeRoutesResult> {
  if (demo.has('pickups')) throw new ApiError(501, 'تخطيط المسارات محتاج السيرفر الحقيقي');
  const r = await http<OptimizeRoutesResult>('POST', '/admin/recycling/routes/optimize', body);
  if (!r) throw new ApiError(500, MSG_GENERIC);
  return r;
}

export function optimizeErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : MSG_GENERIC;
  switch (e.status) {
    case 503:
      return 'خدمة تحسين المسارات (OR-Tools) مش متاحة على السيرفر دلوقتي';
    case 409:
      return 'فيه طلب اتغيّر أو اتوزّع، حدّث القائمة وجرّب تاني';
    case 404:
      return 'فيه طلب مش موجود، حدّث القائمة';
    case 405:
    case 501:
      return 'السيرفر ده مفيهوش تخطيط المسارات';
    default:
      return e.message;
  }
}
