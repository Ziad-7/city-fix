import { aggregateWeighings } from '@/domain/materials';
import { isActivePickup } from '@/domain/citycycle';
import { haversineM } from '@/utils/geo';
import type { CollectorService } from '../interfaces';
import { acceptPickup, addWeighing, completePickup, findCollector, startPickup } from './citycycle-core';
import { collectorView, jobView, pickupView } from './citycycle-localize';
import { delay, loadDb, saveDb } from './db';
import type { DbPickup } from './citycycle-seed';

const DEFAULT_RADIUS_M = 5000;

/** Time the collector finished a job: the last timeline entry. */
const finishedAt = (p: DbPickup) => p.timeline[p.timeline.length - 1]?.at ?? p.createdAt;

/** `to` as a plain date means the end of that day. */
const endOf = (to: string) => (/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to);

export function createMockCollectorService(): CollectorService {
  return {
    async getProfile(userId) {
      await delay(150);
      const db = await loadDb();
      return collectorView(findCollector(db, userId));
    },

    async listNearbyJobs(userId, query) {
      await delay();
      const db = await loadDb();
      const col = findCollector(db, userId);
      const radius = query.radiusM ?? DEFAULT_RADIUS_M;
      return db.pickups
        .filter((p) => p.status === 'requested')
        .filter((p) => !query.materialId || p.items.some((i) => i.materialId === query.materialId))
        .map((p) => ({ p, d: haversineM(query, p.location) }))
        .filter(({ d }) => d <= radius && col.status === 'verified')
        .sort((a, b) => a.d - b.d)
        .map(({ p, d }) => jobView(p, Math.round(d)));
    },

    async listMyJobs(userId) {
      await delay();
      const db = await loadDb();
      const col = findCollector(db, userId);
      const mine = db.pickups.filter((p) => p.collectorId === col.id);
      const active = mine.filter((p) => isActivePickup(p.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const done = mine.filter((p) => !isActivePickup(p.status)).sort((a, b) => finishedAt(b).localeCompare(finishedAt(a)));
      return [...active, ...done].map(pickupView);
    },

    async acceptJob(userId, jobId) {
      await delay();
      const db = await loadDb();
      const row = acceptPickup(db, findCollector(db, userId), jobId);
      await saveDb(db);
      return pickupView(row);
    },

    async startJob(userId, jobId) {
      await delay(150);
      const db = await loadDb();
      const row = startPickup(db, findCollector(db, userId), jobId);
      await saveDb(db);
      return pickupView(row);
    },

    async recordWeighing(userId, jobId, input) {
      await delay(150);
      const db = await loadDb();
      const weighing = addWeighing(db, findCollector(db, userId), jobId, input);
      await saveDb(db);
      return { ...weighing };
    },

    async completeJob(userId, jobId, input) {
      await delay();
      const db = await loadDb();
      const row = completePickup(db, findCollector(db, userId), jobId, input);
      await saveDb(db);
      return pickupView(row);
    },

    async getEarnings(userId, query) {
      await delay(150);
      const db = await loadDb();
      const col = findCollector(db, userId);
      const to = endOf(query.to);
      const jobs = db.pickups.filter((p) => p.collectorId === col.id && p.status === 'completed' && finishedAt(p) >= query.from && finishedAt(p) <= to);
      const agg = aggregateWeighings(jobs.flatMap((p) => p.weighings));
      return {
        period: { from: query.from, to: query.to },
        totalKg: agg.totalKg,
        valueEgp: agg.valueEgp,
        paidToHouseholdsEgp: Math.round(jobs.reduce((s, p) => s + (p.paidToHouseholdEgp ?? 0), 0) * 100) / 100,
        byMaterial: agg.byMaterial,
        jobs: jobs.length,
      };
    },
  };
}
