import type { Incident, MapPin, Report, ServiceRequest, Session, TriageSuggestion } from '@/domain/types';
import { findDuplicates } from '@/logic/duplicates';
import type { Services } from '../interfaces';
import { http, setApiToken } from './http';

/**
 * Real backend (FastAPI). Contract from the plan:
 *   POST /reports, GET /reports, GET /incidents, GET /incidents/{id},
 *   POST /service-requests, GET /service-requests, GET /map/incidents.
 * Auth and triage endpoints (/auth/otp, /auth/verify, /triage) are assumed, to be confirmed on Day 3.
 * Not wired by default: set EXPO_PUBLIC_API_MODE=api and EXPO_PUBLIC_API_URL.
 */
export function createApiServices(): Services {
  const incidents: Services['incidents'] = {
    submitReport: (_userId, input) => http<{ report: Report; incident: Incident }>('POST', '/reports', input),
    listMyReports: () => http<Report[]>('GET', '/reports'),
    getReport: (id) => http<Report | null>('GET', `/reports/${encodeURIComponent(id)}`),
    listIncidents: () => http<Incident[]>('GET', '/incidents'),
    getIncident: (id) => http<Incident | null>('GET', `/incidents/${encodeURIComponent(id)}`),
    listMapPins: () => http<MapPin[]>('GET', '/map/incidents'),
    async findDuplicates(categoryId, at) {
      // Server-side duplicate search is not in the contract yet; reuse the client logic.
      return findDuplicates(await http<Incident[]>('GET', '/incidents'), categoryId, at);
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
        setApiToken(res.token);
        return { userId: res.userId, phone: res.phone, name: res.name };
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
      async analyze(input) {
        const res = await http<TriageSuggestion>('POST', '/triage', input);
        return { ...res, duplicates: res.duplicates ?? [] };
      },
    },
  };
}
