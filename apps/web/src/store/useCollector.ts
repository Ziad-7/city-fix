import { create } from 'zustand';
import {
  periodRange,
  valueOf,
  priceOf,
  weighingTotals,
  firstName,
  type Collector,
  type CollectorApplication,
  type CollectorJob,
  type Earnings,
  type EarningsPeriod,
  type NewWeighingInput,
  type RecyclingPickup,
  type Weighing,
} from '@/domain/citycycle';
import { tr } from '@/i18n';
import { services } from '@/services';
import { classifyFailure } from '@/services/media';
import { isOffline } from '@/services/network';
import { newClientId, useCollectorQueue } from './collectorQueue';
import { useRecycling } from './useRecycling';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** `done`: the server has it. `queued`: saved on the phone, it will be sent when the network is back. */
export type ActionResult = 'done' | 'queued';

type CollectorState = {
  meStatus: LoadStatus;
  /** null = never applied. */
  collector: Collector | null;
  jobsStatus: LoadStatus;
  jobsError: string | null;
  jobs: CollectorJob[];
  /** Pickups this collector accepted, newest first (includes optimistic changes still waiting in the queue). */
  mine: RecyclingPickup[];
  mineStatus: LoadStatus;
  earnings: Partial<Record<EarningsPeriod, Earnings>>;
  earningsStatus: LoadStatus;
  loadMe: () => Promise<void>;
  apply: (input: CollectorApplication) => Promise<void>;
  /** Dev (mock) only. */
  simulateVerify: () => Promise<void>;
  refreshJobs: (center: { lat: number; lng: number }, radiusM: number) => Promise<void>;
  refreshMine: () => Promise<void>;
  accept: (job: CollectorJob) => Promise<ActionResult>;
  weigh: (pickupId: string, input: Omit<NewWeighingInput, 'clientId'>) => Promise<ActionResult>;
  complete: (pickupId: string, paidToHouseholdEgp?: number) => Promise<ActionResult>;
  loadEarnings: (period: EarningsPeriod) => Promise<void>;
  reset: () => void;
};

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error(tr('لازم تسجّل دخول الأول', 'Please sign in first'));
  return id;
};

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));

const upsert = (list: RecyclingPickup[], p: RecyclingPickup): RecyclingPickup[] =>
  list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list];

/** Should this failure be kept for later (network or server trouble) instead of shown to the person? */
const keepForLater = (e: unknown): boolean => classifyFailure(e) === 'retry';

export const useCollector = create<CollectorState>((set, get) => {
  const patchMine = (pickupId: string, fn: (p: RecyclingPickup) => RecyclingPickup) =>
    set((s) => ({ mine: s.mine.map((p) => (p.id === pickupId ? fn(p) : p)) }));

  return {
    meStatus: 'idle',
    collector: null,
    jobsStatus: 'idle',
    jobsError: null,
    jobs: [],
    mine: [],
    mineStatus: 'idle',
    earnings: {},
    earningsStatus: 'idle',

    async loadMe() {
      set({ meStatus: get().meStatus === 'ready' ? 'ready' : 'loading' });
      try {
        set({ collector: await services.collector.me(uid()), meStatus: 'ready' });
      } catch {
        set({ meStatus: 'error' });
      }
    },

    async apply(input) {
      set({ collector: await services.collector.apply(uid(), input), meStatus: 'ready' });
    },

    async simulateVerify() {
      set({ collector: await services.collector.simulateVerify(uid()) });
    },

    async refreshJobs(center, radiusM) {
      set({ jobsStatus: get().jobsStatus === 'ready' ? 'ready' : 'loading', jobsError: null });
      try {
        set({ jobs: await services.collector.jobs(uid(), { lat: center.lat, lng: center.lng, radiusM }), jobsStatus: 'ready' });
      } catch (e) {
        set({ jobsStatus: 'error', jobsError: errText(e) });
      }
    },

    async refreshMine() {
      set({ mineStatus: get().mineStatus === 'ready' ? 'ready' : 'loading' });
      try {
        set({ mine: await services.collector.myPickups(uid()), mineStatus: 'ready' });
      } catch {
        set({ mineStatus: get().mine.length ? 'ready' : 'error' });
      }
    },

    async accept(job) {
      const userId = uid();
      const queueIt = (): ActionResult => {
        const collector = get().collector;
        const now = new Date().toISOString();
        // Show it as accepted right away (approximate pin until the server answers); sent when the network is back.
        const optimistic: RecyclingPickup = {
          id: job.id,
          citizenId: '',
          items: job.items,
          photoUris: [],
          location: job.location,
          day: job.day,
          slot: job.slot,
          mode: job.mode,
          note: job.note,
          estimatedValueEgp: job.estimatedValueEgp,
          status: 'accepted',
          collectorId: collector?.id,
          collectorName: collector ? firstName(collector.name) : undefined,
          weighings: [],
          timeline: [],
          createdAt: now,
        };
        set((s) => ({ mine: upsert(s.mine, optimistic), jobs: s.jobs.filter((j) => j.id !== job.id) }));
        useCollectorQueue.getState().enqueue(userId, { kind: 'accept', pickupId: job.id }, newClientId());
        return 'queued';
      };
      if (await isOffline()) return queueIt();
      try {
        const p = await services.collector.accept(userId, job.id);
        set((s) => ({ mine: upsert(s.mine, p), jobs: s.jobs.filter((j) => j.id !== job.id) }));
        return 'done';
      } catch (e) {
        if (keepForLater(e)) return queueIt();
        throw e;
      }
    },

    async weigh(pickupId, input) {
      const userId = uid();
      const full: NewWeighingInput = { ...input, clientId: newClientId() };
      const queueIt = (): ActionResult => {
        const price = priceOf(useRecycling.getState().prices, full.materialId);
        const local: Weighing = {
          id: `local-${full.clientId}`,
          pickupId,
          materialId: full.materialId,
          kg: full.kg,
          source: full.source,
          scaleId: full.scaleId,
          priceEgpPerKg: price,
          valueEgp: valueOf(full.kg, price),
          clientId: full.clientId,
          at: new Date().toISOString(),
        };
        patchMine(pickupId, (p) => {
          const weighings = [...p.weighings, local];
          const t = weighingTotals(weighings);
          return { ...p, status: 'weighed', weighings, totalKg: t.totalKg, totalValueEgp: t.totalValueEgp };
        });
        useCollectorQueue.getState().enqueue(userId, { kind: 'weigh', pickupId, weighing: full }, full.clientId);
        return 'queued';
      };
      if (await isOffline()) return queueIt();
      try {
        const w = await services.collector.addWeighing(userId, pickupId, full);
        patchMine(pickupId, (p) => {
          const weighings = p.weighings.some((x) => x.clientId === w.clientId) ? p.weighings : [...p.weighings, w];
          const t = weighingTotals(weighings);
          return { ...p, status: 'weighed', weighings, totalKg: t.totalKg, totalValueEgp: t.totalValueEgp };
        });
        return 'done';
      } catch (e) {
        if (keepForLater(e)) return queueIt();
        throw e;
      }
    },

    async complete(pickupId, paidToHouseholdEgp) {
      const userId = uid();
      const queueIt = (): ActionResult => {
        patchMine(pickupId, (p) => ({ ...p, paidToHouseholdEgp: p.mode === 'paid' ? paidToHouseholdEgp : undefined, collectorFinishedAt: new Date().toISOString() }));
        useCollectorQueue.getState().enqueue(userId, { kind: 'complete', pickupId, paidToHouseholdEgp }, newClientId());
        return 'queued';
      };
      if (await isOffline()) return queueIt();
      try {
        const p = await services.collector.complete(userId, pickupId, paidToHouseholdEgp);
        set((s) => ({ mine: upsert(s.mine, p) }));
        return 'done';
      } catch (e) {
        if (keepForLater(e)) return queueIt();
        throw e;
      }
    },

    async loadEarnings(period) {
      set({ earningsStatus: get().earnings[period] ? 'ready' : 'loading' });
      try {
        const e = await services.collector.earnings(uid(), periodRange(period));
        set((s) => ({ earnings: { ...s.earnings, [period]: e }, earningsStatus: 'ready' }));
      } catch {
        set({ earningsStatus: 'error' });
      }
    },

    reset: () =>
      set({ meStatus: 'idle', collector: null, jobsStatus: 'idle', jobsError: null, jobs: [], mine: [], mineStatus: 'idle', earnings: {}, earningsStatus: 'idle' }),
  };
});
