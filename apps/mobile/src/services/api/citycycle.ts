import type {
  Bin,
  Collector,
  CollectorJob,
  Earnings,
  Impact,
  MaterialPrice,
  RecyclingPickup,
  WasteClassification,
  Weighing,
} from '@/domain/citycycle';
import type { CityCycleService, CollectorService } from '../interfaces';
import { AlreadyTakenError, isAlreadyTaken } from '../citycycle-errors';
import { ApiError, http } from './http';
import { orNull } from './orNull';

const enc = encodeURIComponent;

function query(params: Record<string, string | number | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${enc(String(v))}`)
    .join('&');
  return q ? `?${q}` : '';
}

/** The contract's answer when the model is down: never an error for the person (source "fallback"). */
const FALLBACK: WasteClassification = { materials: [], size: 'medium', source: 'fallback' };

/** Citizen side: /recycling/*, /me/impact, /bins, /ai/waste-classify (docs/api-contract.md#citycycle--proposed). */
export function createApiCityCycleService(): CityCycleService {
  return {
    listPrices: (district) => http<MaterialPrice[]>('GET', `/recycling/materials${query({ district })}`),
    createPickup: (_userId, input) => http<RecyclingPickup>('POST', '/recycling/pickups', input),
    listMyPickups: () => http<RecyclingPickup[]>('GET', '/recycling/pickups'),
    getPickup: (id) => orNull(http<RecyclingPickup | null>('GET', `/recycling/pickups/${enc(id)}`)),
    cancelPickup: (_userId, id, note) => http<RecyclingPickup>('POST', `/recycling/pickups/${enc(id)}/cancel`, { note }),
    confirmPickup: (_userId, id) => http<RecyclingPickup>('POST', `/recycling/pickups/${enc(id)}/confirm`),
    getMyImpact: () => http<Impact>('GET', '/me/impact'),
    // Proposed: `bbox` is optional here (the map asks for the whole district).
    listBins: () => http<Bin[]>('GET', '/bins'),
    async reportFullBin(_userId, binId, input) {
      await http<unknown>('POST', `/bins/${enc(binId)}/report-full`, input ? { note: input.note, photoUri: input.photoUri } : {});
    },
    async classifyWaste(path) {
      try {
        const res = await http<WasteClassification>('POST', '/ai/waste-classify', { path });
        return res?.materials ? res : FALLBACK;
      } catch {
        return FALLBACK;
      }
    },
    simulatePickupProgress: () => Promise.reject(new Error('simulatePickupProgress متاح في وضع mock بس')),
  };
}

/** Collector side: /collectors/me and /collector/*. The backend knows the caller from the token. */
export function createApiCollectorService(): CollectorService {
  return {
    getProfile: () => http<Collector>('GET', '/collectors/me'),
    listNearbyJobs: (_userId, q) =>
      http<CollectorJob[]>('GET', `/collector/jobs${query({ lat: q.lat, lng: q.lng, radiusM: q.radiusM, materialId: q.materialId })}`),
    // Proposed endpoint (not in the contract yet): the collector's own accepted and finished pickups.
    listMyJobs: () => http<RecyclingPickup[]>('GET', '/collector/pickups'),
    async acceptJob(_userId, jobId) {
      try {
        return await http<RecyclingPickup>('POST', `/collector/jobs/${enc(jobId)}/accept`);
      } catch (e) {
        // 409: someone else was first. Say it in the app language, whatever the server wrote.
        if (e instanceof ApiError && isAlreadyTaken(e)) throw new AlreadyTakenError();
        throw e;
      }
    },
    // Proposed endpoint.
    startJob: (_userId, jobId) => http<RecyclingPickup>('POST', `/collector/jobs/${enc(jobId)}/start`),
    recordWeighing: (_userId, jobId, input) => http<Weighing>('POST', `/collector/jobs/${enc(jobId)}/weighings`, input),
    completeJob: (_userId, jobId, input) => http<RecyclingPickup>('POST', `/collector/jobs/${enc(jobId)}/complete`, input ?? {}),
    getEarnings: (_userId, q) => http<Earnings>('GET', `/collector/earnings${query({ from: q.from, to: q.to })}`),
  };
}
