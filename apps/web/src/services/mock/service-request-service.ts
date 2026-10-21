import type { IncidentStatus, ServiceRequest } from '@/domain/types';
import type { ServiceRequestService } from '../interfaces';
import { delay, loadDb, saveDb } from './db';
import { nextStatus, serviceTimelineEntry } from './timeline';

export function createMockServiceRequestService(): ServiceRequestService {
  return {
    async book(userId, input) {
      await delay();
      const db = await loadDb();
      const now = new Date().toISOString();
      const req: ServiceRequest = {
        ...input,
        citizenId: userId,
        id: `SRV-${db.counters.service++}`,
        status: 'received',
        timeline: [serviceTimelineEntry('received', now)],
        createdAt: now,
      };
      db.serviceRequests = [req, ...db.serviceRequests];
      await saveDb(db);
      return req;
    },

    async listMine(userId) {
      await delay();
      const db = await loadDb();
      return db.serviceRequests
        .filter((r) => r.citizenId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async get(id) {
      const db = await loadDb();
      return db.serviceRequests.find((r) => r.id === id) ?? null;
    },

    async simulateProgress(id) {
      const db = await loadDb();
      const found = db.serviceRequests.find((r) => r.id === id);
      if (!found) throw new Error('الطلب مش موجود');
      const status: IncidentStatus = nextStatus(found.status);
      if (status === found.status) return found;
      const updated: ServiceRequest = {
        ...found,
        status,
        timeline: [...found.timeline, serviceTimelineEntry(status, new Date().toISOString())],
      };
      db.serviceRequests = db.serviceRequests.map((r) => (r.id === id ? updated : r));
      await saveDb(db);
      return updated;
    },
  };
}
