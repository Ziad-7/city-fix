import type { Incident, MapPin, Report, ServiceRequest, Session, TriageSuggestion } from '@/domain/types';
import type { Services } from '../interfaces';
import { http, setApiToken } from './http';

/**
 * Real backend (FastAPI), following docs/api-contract.md.
 * Not wired by default: set EXPO_PUBLIC_API_MODE=api and EXPO_PUBLIC_API_URL.
 * The bearer token lives in the persisted session (store/useSession) and is handed to http.ts from there.
 */
export function createApiServices(): Services {
  const incidents: Services['incidents'] = {
    submitReport: (_userId, input) => http<{ report: Report; incident: Incident }>('POST', '/reports', input),
    listMyReports: () => http<Report[]>('GET', '/reports'),
    getReport: (id) => http<Report | null>('GET', `/reports/${encodeURIComponent(id)}`),
    listIncidents: () => http<Incident[]>('GET', '/incidents'),
    getIncident: (id) => http<Incident | null>('GET', `/incidents/${encodeURIComponent(id)}`),
    listMapPins: () => http<MapPin[]>('GET', '/map/incidents'),
    async listFollowing() {
      // Proposed contract field: `Incident.isFollowing` for the authenticated caller.
      const all = await http<Incident[]>('GET', '/incidents');
      return all.filter((i) => i.isFollowing).map((i) => i.id);
    },
    followIncident: (_userId, id) => http<Incident>('POST', `/incidents/${encodeURIComponent(id)}/follow`),
    simulateProgress: () => Promise.reject(new Error('simulateProgress متاح في وضع mock بس')),
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
      get: (id) => http<ServiceRequest | null>('GET', `/service-requests/${encodeURIComponent(id)}`),
      simulateProgress: () => Promise.reject(new Error('simulateProgress متاح في وضع mock بس')),
    },
    triage: {
      async analyze({ userId: _userId, ...body }) {
        // The backend knows the caller from the token and leaves out their own and followed incidents.
        const res = await http<TriageSuggestion>('POST', '/triage', body);
        return { ...res, duplicates: res.duplicates ?? [], alreadyReported: res.alreadyReported ?? [] };
      },
    },
  };
}
