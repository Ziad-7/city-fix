import { useMemo } from 'react';
import { create } from 'zustand';
import {
  earningsRange,
  isCurrentJob,
  type Collector,
  type CollectorJob,
  type CompletePickupInput,
  type Earnings,
  type Impact,
  type RecyclingPickup,
  type Weighing,
  type WeighingInput,
} from '@/domain/citycycle';
import { aggregateWeighings } from '@/domain/materials';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { LatLng } from '@/domain/types';
import { tr } from '@/i18n';
import { API_MODE, services } from '@/services';
import { isAlreadyTaken } from '@/services/citycycle-errors';
import { DEMO_COLLECTOR_USER_ID } from '@/services/mock';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const msgGeneric = () => tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again');

/**
 * Who the collector calls are made as. Mock mode: the demo collector (the citizen demo user is a different person).
 * API mode: the signed-in user; the backend decides from the token.
 * TODO(api): collector role and profile come from the backend (docs/api-contract.md, CityCycle > Collectors).
 */
export const collectorActorId = (): string => {
  if (API_MODE === 'mock') return DEMO_COLLECTOR_USER_ID;
  const id = useSession.getState().userId;
  if (!id) throw new Error(tr('لازم تسجّل دخول الأول', 'Please sign in first'));
  return id;
};

/** Where to look for jobs when the phone gives no position: the middle of the person's district. */
export function defaultOrigin(): LatLng {
  const { governorate, district } = useSession.getState();
  const d = findDistrict(governorate, district);
  return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
}

let seq = 0;
/** Idempotency key for a weighing; the server de-duplicates on it. */
export const newClientId = (): string => `w-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const upsert = (list: RecyclingPickup[], p: RecyclingPickup) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]);

export type AcceptResult = { ok: true; pickup: RecyclingPickup } | { ok: false; reason: 'taken' };

type CollectorState = {
  status: LoadStatus;
  error: string | null;
  profile: Collector | null;
  /** Open jobs near `origin`, nearest first. Approximate pins and no citizen details. */
  jobs: CollectorJob[];
  origin: LatLng | null;
  /** My accepted jobs (active first) and finished ones, with exact pins. */
  myJobs: RecyclingPickup[];
  earningsToday: Earnings | null;
  earningsWeek: Earnings | null;
  /** The collector's own impact (kg collected, EGP earned). */
  impact: Impact | null;
  refresh: (origin?: LatLng) => Promise<void>;
  refreshJobs: (origin?: LatLng) => Promise<void>;
  refreshEarnings: () => Promise<void>;
  /** First accept wins. `{ ok: false, reason: 'taken' }` means someone else was first ("اتاخد خلاص"): the job list is reloaded. */
  accept: (jobId: string) => Promise<AcceptResult>;
  /** "On my way". */
  start: (jobId: string) => Promise<RecyclingPickup>;
  /** Records one weighing (a `clientId` is added for you) and returns it; the job in `myJobs` is updated. */
  addWeighing: (jobId: string, input: Omit<WeighingInput, 'clientId'> & { clientId?: string }) => Promise<Weighing>;
  /** Finishes the job. Omit the amount for a free pickup. */
  complete: (jobId: string, input?: CompletePickupInput) => Promise<RecyclingPickup>;
  reset: () => void;
};

export const useCollector = create<CollectorState>((set, get) => ({
  status: 'idle',
  error: null,
  profile: null,
  jobs: [],
  origin: null,
  myJobs: [],
  earningsToday: null,
  earningsWeek: null,
  impact: null,

  async refresh(origin) {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const id = collectorActorId();
      const where = origin ?? get().origin ?? defaultOrigin();
      const [profile, jobs, myJobs, today, week, impact] = await Promise.all([
        services.collector.getProfile(id),
        services.collector.listNearbyJobs(id, { lat: where.lat, lng: where.lng }),
        services.collector.listMyJobs(id),
        services.collector.getEarnings(id, earningsRange('today')),
        services.collector.getEarnings(id, earningsRange('week')),
        services.cityCycle.getMyImpact(id),
      ]);
      set({ status: 'ready', origin: where, profile, jobs, myJobs, earningsToday: today, earningsWeek: week, impact });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : msgGeneric() });
    }
  },

  async refreshJobs(origin) {
    const where = origin ?? get().origin ?? defaultOrigin();
    const id = collectorActorId();
    const [jobs, myJobs] = await Promise.all([services.collector.listNearbyJobs(id, { lat: where.lat, lng: where.lng }), services.collector.listMyJobs(id)]);
    set({ jobs, myJobs, origin: where });
  },

  async refreshEarnings() {
    const id = collectorActorId();
    const [today, week, impact] = await Promise.all([
      services.collector.getEarnings(id, earningsRange('today')),
      services.collector.getEarnings(id, earningsRange('week')),
      services.cityCycle.getMyImpact(id),
    ]);
    set({ earningsToday: today, earningsWeek: week, impact });
  },

  async accept(jobId) {
    try {
      const pickup = await services.collector.acceptJob(collectorActorId(), jobId);
      set((s) => ({ myJobs: upsert(s.myJobs, pickup), jobs: s.jobs.filter((j) => j.id !== jobId) }));
      return { ok: true, pickup };
    } catch (e) {
      if (!isAlreadyTaken(e)) throw e;
      set((s) => ({ jobs: s.jobs.filter((j) => j.id !== jobId) }));
      void get().refreshJobs().catch(() => undefined);
      return { ok: false, reason: 'taken' };
    }
  },

  async start(jobId) {
    const pickup = await services.collector.startJob(collectorActorId(), jobId);
    set((s) => ({ myJobs: upsert(s.myJobs, pickup) }));
    return pickup;
  },

  async addWeighing(jobId, input) {
    const weighing = await services.collector.recordWeighing(collectorActorId(), jobId, { ...input, clientId: input.clientId ?? newClientId() });
    set((s) => ({
      myJobs: s.myJobs.map((p) => {
        if (p.id !== jobId) return p;
        // The server answers idempotently: the same clientId never adds a second row.
        const weighings = p.weighings.some((w) => w.clientId === weighing.clientId) ? p.weighings : [...p.weighings, weighing];
        const agg = aggregateWeighings(weighings);
        return { ...p, status: 'weighed', weighings, totalKg: agg.totalKg, totalValueEgp: agg.valueEgp };
      }),
    }));
    return weighing;
  },

  async complete(jobId, input) {
    const pickup = await services.collector.completeJob(collectorActorId(), jobId, input);
    set((s) => ({ myJobs: upsert(s.myJobs, pickup) }));
    await get().refreshEarnings().catch(() => undefined);
    return pickup;
  },

  reset: () =>
    set({ status: 'idle', error: null, profile: null, jobs: [], origin: null, myJobs: [], earningsToday: null, earningsWeek: null, impact: null }),
}));

/** The job in progress (accepted, not finished), if any. */
export function useCurrentJob(): RecyclingPickup | null {
  const myJobs = useCollector((s) => s.myJobs);
  return useMemo(() => myJobs.find(isCurrentJob) ?? null, [myJobs]);
}

/** Finished jobs, most recent first. */
export function useFinishedJobs(): RecyclingPickup[] {
  const myJobs = useCollector((s) => s.myJobs);
  return useMemo(() => myJobs.filter((p) => p.status === 'completed'), [myJobs]);
}
