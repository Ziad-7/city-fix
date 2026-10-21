import type { IncidentStatus } from '@/domain/types';
import { tr } from '@/i18n';
import type { ServiceRequestService } from '../interfaces';
import { delay, loadDb, saveDb } from './db';
import { requestView } from './localize';
import type { DbServiceRequest } from './seed';
import { nextStatus, serviceTimelineEntry } from './timeline';

export function createMockServiceRequestService(): ServiceRequestService {
  return {
    async book(userId, input) {
      await delay();
      const db = await loadDb();
      const now = new Date().toISOString();
      const req: DbServiceRequest = {
        ...input,
        citizenId: userId,
        id: `SRV-${db.counters.service++}`,
        status: 'received',
        timeline: [serviceTimelineEntry('received', now, input.serviceType)],
        createdAt: now,
      };
      db.serviceRequests = [req, ...db.serviceRequests];
      await saveDb(db);
      return requestView(req);
    },

    async listMine(userId) {
      await delay();
      const db = await loadDb();
      return db.serviceRequests
        .filter((r) => r.citizenId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(requestView);
    },

    async get(id) {
      const db = await loadDb();
      const found = db.serviceRequests.find((r) => r.id === id);
      return found ? requestView(found) : null;
    },

    async simulateProgress(id) {
      const db = await loadDb();
      const found = db.serviceRequests.find((r) => r.id === id);
      if (!found) throw new Error(tr('الطلب مش موجود', "We couldn't find that request"));
      const status: IncidentStatus = nextStatus(found.status);
      if (status === found.status) return requestView(found);
      const updated: DbServiceRequest = {
        ...found,
        status,
        timeline: [...found.timeline, serviceTimelineEntry(status, new Date().toISOString(), found.serviceType)],
      };
      db.serviceRequests = db.serviceRequests.map((r) => (r.id === id ? updated : r));
      await saveDb(db);
      return requestView(updated);
    },
  };
}
