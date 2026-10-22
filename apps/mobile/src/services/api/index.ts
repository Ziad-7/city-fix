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
import { tr } from '@/i18n';
import { cleanTriageSummary } from '@/logic/triage-mock';
import type { Incident, MapPin, Report, ServiceRequest, Session, TriageSuggestion } from '@/domain/types';
import type { Services } from '../interfaces';
import { ApiError, http, setApiToken } from './http';
import { createUploadService } from './uploads';

/** Request options carrying the `Idempotency-Key` header (unknown headers are harmless to a server without support). */
const idemOptions = (key?: string) => (key ? { headers: { 'Idempotency-Key': key } } : {});

/** GET by id: 404 (missing) or 403 (someone else's) means "not found" on the detail screen, not a load error with a retry. */
async function orNull<T>(p: Promise<T | null>): Promise<T | null> {
  try {
    return (await p) ?? null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

/**
 * Real backend (FastAPI), following docs/api-contract.md.
 * Not wired by default: set the app's API_MODE=api and API_URL env (EXPO_PUBLIC_* on mobile, NEXT_PUBLIC_* on the website).
 * The bearer token lives in the persisted session (store/useSession) and is handed to http.ts from there.
 */
export function createApiServices(): Services {
  const incidents: Services['incidents'] = {
    submitReport: (_userId, input, idempotencyKey) =>
      http<{ report: Report; incident: Incident }>('POST', '/reports', input, idemOptions(idempotencyKey)),
    listMyReports: () => http<Report[]>('GET', '/reports'),
    getReport: (_userId, id) => orNull(http<Report | null>('GET', `/reports/${encodeURIComponent(id)}`)),
    listIncidents: () => http<Incident[]>('GET', '/incidents'),
    getIncident: (id) => orNull(http<Incident | null>('GET', `/incidents/${encodeURIComponent(id)}`)),
    listMapPins: () => http<MapPin[]>('GET', '/map/incidents'),
    async listFollowing() {
      // Proposed contract field: `Incident.isFollowing` for the authenticated caller.
      const all = await http<Incident[]>('GET', '/incidents');
      return all.filter((i) => i.isFollowing).map((i) => i.id);
    },
    followIncident: (_userId, id) => http<Incident>('POST', `/incidents/${encodeURIComponent(id)}/follow`),
    simulateProgress: () => Promise.reject(new Error(tr('simulateProgress متاح في وضع mock بس', 'simulateProgress is only available in mock mode'))),
    reopenIncident: (_userId, id, note) => http<Incident>('POST', `/incidents/${encodeURIComponent(id)}/reopen`, { note }),
  };

  const enc = encodeURIComponent;
  const query = (params: Record<string, string | number | undefined>): string => {
    const q = Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${enc(String(v))}`)
      .join('&');
    return q ? `?${q}` : '';
  };

  return {
    auth: {
      async requestCode(phone, channel) {
        await http<unknown>('POST', '/auth/otp', { phone, channel });
      },
      async verifyCode(phone, code) {
        const res = await http<Session & { token: string }>('POST', '/auth/verify', { phone, code });
        return { userId: res.userId, phone: res.phone, name: res.name, token: res.token };
      },
      async signOut() {
        setApiToken(null);
      },
    },
    incidents,
    serviceRequests: {
      book: (_userId, input) => http<ServiceRequest>('POST', '/service-requests', input),
      listMine: () => http<ServiceRequest[]>('GET', '/service-requests'),
      get: (id) => orNull(http<ServiceRequest | null>('GET', `/service-requests/${encodeURIComponent(id)}`)),
      simulateProgress: () => Promise.reject(new Error(tr('simulateProgress متاح في وضع mock بس', 'simulateProgress is only available in mock mode'))),
    },
    triage: {
      async analyze({ userId: _userId, ...body }) {
        // The backend knows the caller from the token and leaves out their own and followed incidents.
        const res = await http<TriageSuggestion>(
          'POST',
          '/triage',
          body,
          { timeoutMs: 6000 },
        );
        return { ...cleanTriageSummary(res), duplicates: res.duplicates ?? [], alreadyReported: res.alreadyReported ?? [] };
      },
    },
    uploads: createUploadService(),
    // POST /ai/transcribe with the uploaded voice-note path.
    transcription: {
      transcribe: (path) => http('POST', '/ai/transcribe', { path }, { timeoutMs: 25000 }),
    },
    // CityCycle (contract: "CityCycle — proposed"). The caller is known from the token, so `userId` is not sent.
    recycling: {
      materials: (district) => http<MaterialPrice[]>('GET', `/recycling/materials${query({ district })}`),
      create: (_userId, input, idempotencyKey) => http<RecyclingPickup>('POST', '/recycling/pickups', input, idemOptions(idempotencyKey)),
      listMine: () => http<RecyclingPickup[]>('GET', '/recycling/pickups'),
      get: (id) => orNull(http<RecyclingPickup | null>('GET', `/recycling/pickups/${enc(id)}`)),
      cancel: (_userId, id, note) => http<RecyclingPickup>('POST', `/recycling/pickups/${enc(id)}/cancel`, { note }),
      confirm: (_userId, id) => http<RecyclingPickup>('POST', `/recycling/pickups/${enc(id)}/confirm`),
      // `as=citizen`: one account can be both a citizen and a collector, so the citizen screen names its role.
      impact: () => http<Impact>('GET', `/me/impact${query({ as: 'citizen' })}`),
    },
    collector: {
      apply: (_userId, input) => http<Collector>('POST', '/collectors/apply', input),
      me: () => orNull(http<Collector | null>('GET', '/collectors/me')),
      jobs: (_userId, q) => http<CollectorJob[]>('GET', `/collector/jobs${query({ lat: q.lat, lng: q.lng, radiusM: q.radiusM, materialId: q.materialId })}`),
      myPickups: () => http<RecyclingPickup[]>('GET', '/collector/pickups'),
      accept: (_userId, id) => http<RecyclingPickup>('POST', `/collector/jobs/${enc(id)}/accept`),
      addWeighing: (_userId, id, input) => http<Weighing>('POST', `/collector/jobs/${enc(id)}/weighings`, input),
      complete: (_userId, id, paidToHouseholdEgp) => http<RecyclingPickup>('POST', `/collector/jobs/${enc(id)}/complete`, { paidToHouseholdEgp }),
      earnings: (_userId, range) => http<Earnings>('GET', `/collector/earnings${query({ from: range.from, to: range.to })}`),
      simulateVerify: () => Promise.reject(new Error(tr('simulateVerify متاح في وضع mock بس', 'simulateVerify is only available in mock mode'))),
    },
    bins: {
      list: () => http<Bin[]>('GET', '/bins'),
      async reportFull(_userId, binId, input) {
        await http<unknown>('POST', `/bins/${enc(binId)}/report-full`, input);
      },
    },
    waste: {
      // A suggestion only: on any failure the app carries on without one (the contract also returns `source: "fallback"`).
      async classify(path, photoConsent = false) {
        if (!photoConsent) return { materials: [], size: 'medium', source: 'fallback' };
        try {
          return await http<WasteClassification>('POST', '/ai/waste-classify', { path, photoConsent: true });
        } catch {
          return { materials: [], size: 'medium', source: 'fallback' };
        }
      },
    },
  };
}
