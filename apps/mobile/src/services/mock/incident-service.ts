import { getCategory } from '@/domain/categories';
import { findDistrict, GOVERNORATES } from '@/domain/locations';
import type { Incident, IncidentStatus, MapPin, NewReportInput, Report } from '@/domain/types';
import { findDuplicates } from '@/logic/duplicates';
import { computePriority } from '@/logic/priority';
import { daysBetween } from '@/utils/time';
import type { IncidentService } from '../interfaces';
import { delay, loadDb, saveDb } from './db';
import { etaFor, incidentTimelineEntry, nextStatus } from './timeline';

const pad = (n: number) => String(n).padStart(4, '0');

function reprioritize(i: Incident): Incident {
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
      let incident: Incident | undefined = input.linkToIncidentId
        ? db.incidents.find((i) => i.id === input.linkToIncidentId)
        : undefined;

      if (incident) {
        incident = reprioritize({
          ...incident,
          linkedReportIds: [...incident.linkedReportIds, reportId],
          followers: incident.followers + 1,
          updatedAt: now,
        });
        const target = incident;
        db.incidents = db.incidents.map((i) => (i.id === target.id ? target : i));
        db.following[userId] = [...new Set([...(db.following[userId] ?? []), target.id])];
      } else {
        const cat = getCategory(input.categoryId);
        const severity = input.severity ?? cat.defaultSeverity;
        const base = { categoryId: input.categoryId, severity, department: cat.department };
        const fresh: Incident = {
          id: `INC-${db.counters.incident++}`,
          ...base,
          title: `${cat.labelAr}${input.location.address ? ` · ${input.location.address.split('،')[0]}` : ''}`,
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
      }

      const report: Report = {
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
      return { report, incident };
    },

    async listMyReports(userId) {
      await delay();
      const db = await loadDb();
      return db.reports.filter((r) => r.reporterId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async getReport(id) {
      const db = await loadDb();
      return db.reports.find((r) => r.id === id) ?? null;
    },

    async listIncidents() {
      await delay();
      return (await loadDb()).incidents;
    },

    async getIncident(id) {
      const db = await loadDb();
      return db.incidents.find((i) => i.id === id) ?? null;
    },

    async listMapPins(): Promise<MapPin[]> {
      await delay();
      const db = await loadDb();
      return db.incidents.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        title: i.title,
        status: i.status,
        severity: i.severity,
        lat: i.location.lat,
        lng: i.location.lng,
      }));
    },

    async findDuplicates(categoryId, at) {
      const db = await loadDb();
      return findDuplicates(db.incidents, categoryId, at);
    },

    async followIncident(userId, incidentId) {
      await delay(120);
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === incidentId);
      if (!found) throw new Error('البلاغ مش موجود');
      const already = (db.following[userId] ?? []).includes(incidentId);
      if (already) return found;
      const updated: Incident = { ...found, followers: found.followers + 1 };
      db.incidents = db.incidents.map((i) => (i.id === incidentId ? updated : i));
      db.following[userId] = [...(db.following[userId] ?? []), incidentId];
      await saveDb(db);
      return updated;
    },

    async simulateProgress(incidentId) {
      const db = await loadDb();
      const found = db.incidents.find((i) => i.id === incidentId);
      if (!found) throw new Error('البلاغ مش موجود');
      const status: IncidentStatus = nextStatus(found.status);
      if (status === found.status) return found;
      const at = new Date().toISOString();
      const updated: Incident = {
        ...found,
        status,
        eta: etaFor(status),
        workOrderId: status === 'assigned' && !found.workOrderId ? `WO-${300 + Math.floor(db.counters.incident % 100)}` : found.workOrderId,
        timeline: [...found.timeline, incidentTimelineEntry(status, found, at)],
        updatedAt: at,
      };
      db.incidents = db.incidents.map((i) => (i.id === incidentId ? updated : i));
      await saveDb(db);
      return updated;
    },
  };
}
