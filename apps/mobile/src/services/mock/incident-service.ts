import { getCategory } from '@/domain/categories';
import { findDistrict, GOVERNORATES } from '@/domain/locations';
import type { IncidentStatus, MapPin, NewReportInput } from '@/domain/types';
import { tr } from '@/i18n';
import { computePriority } from '@/logic/priority';
import { daysBetween } from '@/utils/time';
import type { IncidentService } from '../interfaces';
import { delay, loadDb, saveDb } from './db';
import { incidentView, reportView } from './localize';
import type { DbIncident, DbReport } from './seed';
import { etaFor, incidentTimelineEntry, nextStatus } from './timeline';

const pad = (n: number) => String(n).padStart(4, '0');

function reprioritize<T extends DbIncident>(i: T): T {
  const cat = getCategory(i.categoryId);
  return {
    ...i,
    priority: computePriority({
      severity: i.severity,
      nearSensitivePlace: !!i.sensitivePlace,
      reporters: i.linkedReportIds.length,
      daysOpen: daysBetween(i.createdAt),
      targetDays: cat.targetDays,
      areaUnderserved: i.areaUnderserved,
    }),
  };
}

function underservedFor(governorate?: string, district?: string): boolean {
  if (governorate && district) return findDistrict(governorate, district)?.underserved ?? false;
  return GOVERNORATES[0].districts[0].underserved;
}

export function createMockIncidentService(): IncidentService {
  return {
    async submitReport(userId, input: NewReportInput) {
      await delay();
      const db = await loadDb();
      const now = new Date().toISOString();
      const reportId = `FTC-${pad(db.counters.report++)}`;
      let incident: DbIncident | undefined = input.linkToIncidentId
        ? db.incidents.find((i) => i.id === input.linkToIncidentId)
        : undefined;

      if (incident) {
        // Linking makes the reporter a follower, once: no extra follower if they already follow or reported it.
        const linked = incident;
        const alreadyFollowing =
          (db.following[userId] ?? []).includes(linked.id) || db.reports.some((r) => r.reporterId === userId && r.incidentId === linked.id);
        incident = reprioritize({
          ...incident,
          linkedReportIds: [...incident.linkedReportIds, reportId],
          followers: incident.followers + (alreadyFollowing ? 0 : 1),
          updatedAt: now,
        });
        const target = incident;
        db.incidents = db.incidents.map((i) => (i.id === target.id ? target : i));
        db.following[userId] = [...new Set([...(db.following[userId] ?? []), target.id])];
      } else {
        const cat = getCategory(input.categoryId);
        const severity = input.severity ?? cat.defaultSeverity;
        const base = { categoryId: input.categoryId, severity, department: cat.department };
        const fresh: DbIncident = {
          id: `INC-${pad(db.counters.incident++)}`,
          ...base,
          title: `${cat.labelAr}${input.location.address ? ` · ${input.location.address.split(/[،,]/)[0].trim()}` : ''}`,
          priority: { score: 0, factors: [] },
          status: 'received',
          estimatedCostEgp: cat.estimatedCostEgp,
          linkedReportIds: [reportId],
          followers: 1,
          location: input.location,
          areaUnderserved: underservedFor(input.governorate, input.district),
          eta: etaFor('received'),
          timeline: [incidentTimelineEntry('received', base, now)],
          createdAt: now,
          updatedAt: now,
        };
        incident = reprioritize(fresh);
        db.incidents = [incident, ...db.incidents];
        db.following[userId] = [...new Set([...(db.following[userId] ?? []), incident.id])];
      }

      const report: DbReport = {
        id: reportId,
        reporterId: userId,
        incidentId: incident.id,
        categoryId: input.categoryId,
        description: input.description,
        photoUris: input.photoUris,
        location: input.location,
        anonymous: input.anonymous,
        blurFaces: input.blurFaces,
        createdAt: now,
        voiceNoteUri: input.voiceNoteUri,
      };
      db.reports = [report, ...db.reports];
      await saveDb(db);
      return { report: reportView(report), incident: incidentView(incident) };
    },

    async listMyReports(userId) {
      await delay();
      const db = await loadDb();
      return db.reports
        .filter((r) => r.reporterId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(reportView);
    },

    async getReport(userId, id) {
      const db = await loadDb();
      // Like the API (403 -> null): only the reporter can open a report.
      const found = db.reports.find((r) => r.id === id && r.reporterId === userId);
      return found ? reportView(found) : null;
    },

    async listIncidents() {
      await delay();
      return (await loadDb()).incidents.map(incidentView);
    },

    async getIncident(id) {
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === id);
      return found ? incidentView(found) : null;
    },

    async listMapPins(): Promise<MapPin[]> {
      await delay();
      const db = await loadDb();
      return db.incidents.map(incidentView).map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        title: i.title,
        status: i.status,
        severity: i.severity,
        lat: i.location.lat,
        lng: i.location.lng,
      }));
    },

    async listFollowing(userId) {
      await delay(120);
      const db = await loadDb();
      return [...new Set([...(db.following[userId] ?? []), ...db.reports.filter((r) => r.reporterId === userId).map((r) => r.incidentId)])];
    },

    async followIncident(userId, incidentId) {
      await delay(120);
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === incidentId);
      if (!found) throw new Error(tr('البلاغ مش موجود', "We couldn't find that report"));
      const already = (db.following[userId] ?? []).includes(incidentId);
      if (already) return incidentView(found);
      const updated: DbIncident = { ...found, followers: found.followers + 1 };
      db.incidents = db.incidents.map((i) => (i.id === incidentId ? updated : i));
      db.following[userId] = [...(db.following[userId] ?? []), incidentId];
      await saveDb(db);
      return incidentView(updated);
    },

    async simulateProgress(incidentId) {
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === incidentId);
      if (!found) throw new Error(tr('البلاغ مش موجود', "We couldn't find that report"));
      const status: IncidentStatus = nextStatus(found.status);
      if (status === found.status) return incidentView(found);
      const at = new Date().toISOString();
      const updated: DbIncident = {
        ...found,
        status,
        eta: etaFor(status),
        workOrderId: status === 'assigned' && !found.workOrderId ? `WO-${300 + Math.floor(db.counters.incident % 100)}` : found.workOrderId,
        timeline: [...found.timeline, incidentTimelineEntry(status, found, at)],
        updatedAt: at,
      };
      db.incidents = db.incidents.map((i) => (i.id === incidentId ? updated : i));
      await saveDb(db);
      return incidentView(updated);
    },

    async reopenIncident(_userId, incidentId, note) {
      await delay(120);
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === incidentId);
      if (!found) throw new Error(tr('البلاغ مش موجود', "We couldn't find that report"));
      if (found.status !== 'resolved') throw new Error(tr('مينفعش نفتح البلاغ ده تاني، لأنه لسه مش متصلّح', "We can't reopen this report because it isn't fixed yet"));
      const at = new Date().toISOString();
      const clean = note.trim();
      const updated: DbIncident = {
        ...found,
        status: 'received',
        eta: etaFor('received'),
        timeline: [
          ...found.timeline,
          {
            status: 'received',
            at,
            actor: 'مواطن',
            note: clean ? `اتفتح تاني: ${clean}` : 'اتفتح تاني',
            actorEn: 'Citizen',
            noteEn: clean ? `Reopened: ${clean}` : 'Reopened',
          },
        ],
        updatedAt: at,
      };
      db.incidents = db.incidents.map((i) => (i.id === incidentId ? updated : i));
      await saveDb(db);
      return incidentView(updated);
    },
  };
}
