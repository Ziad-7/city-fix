import {
  estimateValue,
  firstName,
  impactFromPickups,
  inRange,
  priceOf,
  sumKg,
  valueOf,
  weighingTotals,
  type Bin,
  type Collector,
  type CollectorJob,
  type Earnings,
  type MaterialId,
  type PickupStatus,
  type RecyclingPickup,
  type WasteClassification,
  type Weighing,
} from '@/domain/citycycle';
import { getLang, tr } from '@/i18n';
import { haversineM } from '@/utils/geo';
import type { BinService, CollectorService, RecyclingService, WasteAiService } from '../interfaces';
import { ApiError } from '../api/http';
import { delay } from './db';
import { createMockIncidentService } from './incident-service';
import { loadCityCycleDb, saveCityCycleDb, type CityCycleDb, type DbBin, type DbPickup, type DbPickupTimelineEntry } from './citycycle-db';

const num = (n: number) => String(n).padStart(4, '0');

// ---- Read-time localisation: the mock answers in the app language and returns the plain API types ----

export function pickupView(p: DbPickup): RecyclingPickup {
  const { addressEn, landmarkEn, timeline, ...rest } = p;
  const en = getLang() === 'en';
  return {
    ...rest,
    location: en ? { ...p.location, address: addressEn ?? p.location.address, landmark: landmarkEn ?? p.location.landmark } : p.location,
    timeline: timeline.map((e) => ({
      status: e.status,
      at: e.at,
      note: en && e.noteEn ? e.noteEn : e.note,
      actor: en && e.actorEn ? e.actorEn : e.actor,
    })),
  };
}

function binView(b: DbBin): Bin {
  const { nameEn, addressEn, ...rest } = b;
  const en = getLang() === 'en';
  return { ...rest, name: en ? (nameEn ?? b.name) : b.name, location: en && addressEn ? { ...b.location, address: addressEn } : b.location };
}

function entry(status: PickupStatus, actor: string, actorEn: string, note: string, noteEn: string): DbPickupTimelineEntry {
  return { status, at: new Date().toISOString(), actor, actorEn, note, noteEn };
}

/** The mock has no real approximation of a pin: round to ~100 m so an open job does not show the exact door. */
const approx = (n: number) => Math.round(n * 1000) / 1000;

function retotal(p: DbPickup): DbPickup {
  const t = weighingTotals(p.weighings);
  return { ...p, totalKg: t.totalKg, totalValueEgp: t.hasUnpriced && t.totalValueEgp === 0 ? undefined : t.totalValueEgp };
}

async function mutate<T>(fn: (db: CityCycleDb) => T): Promise<T> {
  const db = await loadCityCycleDb();
  const out = fn(db);
  await saveCityCycleDb(db);
  return out;
}

const conflict = (ar: string, en: string) => new ApiError(409, tr(ar, en));
const forbidden = () => new ApiError(403, tr('مش مسموح لك بده', 'You are not allowed to do that'));
const notFound = () => new ApiError(404, tr('الطلب مش موجود', "We couldn't find that pickup"));

// ---- Households ----

export function createMockRecyclingService(): RecyclingService {
  return {
    async materials(district) {
      await delay(150);
      const db = await loadCityCycleDb();
      return db.prices.map((p) => ({ ...p, district }));
    },

    async create(userId, input) {
      await delay();
      return mutate((db) => {
        const now = new Date().toISOString();
        const est = estimateValue(input.items, db.prices);
        const pickup: DbPickup = {
          id: `RCY-${db.counters.pickup++}`,
          citizenId: userId,
          items: input.items,
          photoUris: input.photoUris ?? [],
          location: input.location,
          day: input.day,
          slot: input.slot,
          mode: input.mode,
          note: input.note?.trim() || undefined,
          estimatedValueEgp: est.valueEgp,
          status: 'requested',
          weighings: [],
          timeline: [{ ...entry('requested', 'سيتي سايكل', 'CityCycle', 'طلبك وصل وبندوّر على جامع قريب', 'Your request is in. We’re looking for a nearby collector'), at: now }],
          createdAt: now,
        };
        db.pickups = [pickup, ...db.pickups];
        return pickupView(pickup);
      });
    },

    async listMine(userId) {
      await delay();
      const db = await loadCityCycleDb();
      return db.pickups
        .filter((p) => p.citizenId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(pickupView);
    },

    async get(id) {
      const db = await loadCityCycleDb();
      const found = db.pickups.find((p) => p.id === id);
      return found ? pickupView(found) : null;
    },

    async cancel(userId, id, note) {
      await delay();
      return mutate((db) => {
        const p = db.pickups.find((x) => x.id === id);
        if (!p) throw notFound();
        if (p.citizenId !== userId) throw forbidden();
        if (p.status !== 'requested') throw conflict('مينفعش تلغي الطلب بعد ما جامع قبله', 'You can only cancel before a collector accepts');
        const updated: DbPickup = {
          ...p,
          status: 'cancelled',
          timeline: [...p.timeline, entry('cancelled', 'مواطن', 'Citizen', note?.trim() ? `الطلب اتلغى: ${note.trim()}` : 'الطلب اتلغى', note?.trim() ? `Cancelled: ${note.trim()}` : 'The request was cancelled')],
        };
        db.pickups = db.pickups.map((x) => (x.id === id ? updated : x));
        return pickupView(updated);
      });
    },

    async confirm(userId, id) {
      await delay();
      return mutate((db) => {
        const p = db.pickups.find((x) => x.id === id);
        if (!p) throw notFound();
        if (p.citizenId !== userId) throw forbidden();
        if (p.confirmedAt) return pickupView(p);
        if (p.status !== 'weighed' || !p.collectorFinishedAt) throw conflict('لسه الجامع مخلّصش', 'The collector has not finished yet');
        const updated: DbPickup = {
          ...p,
          status: 'completed',
          confirmedAt: new Date().toISOString(),
          timeline: [...p.timeline, entry('completed', 'مواطن', 'Citizen', 'اتأكد الوزن، شكرًا إنك بتدوّر', 'Weighing confirmed. Thanks for recycling')],
        };
        db.pickups = db.pickups.map((x) => (x.id === id ? updated : x));
        return pickupView(updated);
      });
    },

    async impact(userId) {
      await delay();
      const db = await loadCityCycleDb();
      return impactFromPickups(db.pickups.filter((p) => p.citizenId === userId));
    },
  };
}

// ---- Collectors ----

const requireVerified = (db: CityCycleDb, userId: string): Collector => {
  const c = db.collectors[userId];
  if (!c) throw new ApiError(403, tr('سجّل كجامع الأول', 'Apply as a collector first'));
  if (c.status !== 'verified') throw new ApiError(403, tr('حسابك لسه متوثقش', 'Your account is not verified yet'));
  return c;
};

const mineOf = (db: CityCycleDb, c: Collector, id: string): DbPickup => {
  const p = db.pickups.find((x) => x.id === id);
  if (!p) throw notFound();
  if (p.collectorId !== c.id) throw forbidden();
  return p;
};

export function createMockCollectorService(): CollectorService {
  return {
    async apply(userId, input) {
      await delay();
      return mutate((db) => {
        const existing = db.collectors[userId];
        if (existing) return existing;
        const c: Collector = {
          id: `COL-${num(db.counters.collector++)}`,
          name: input.name.trim(),
          district: input.district,
          status: 'pending',
          materials: input.materials,
          vehicle: input.vehicle,
          joinedAt: new Date().toISOString(),
        };
        db.collectors[userId] = c;
        return c;
      });
    },

    async me(userId) {
      await delay(150);
      const db = await loadCityCycleDb();
      return db.collectors[userId] ?? null;
    },

    async jobs(userId, query) {
      await delay();
      const db = await loadCityCycleDb();
      requireVerified(db, userId);
      const here = { lat: query.lat, lng: query.lng };
      // Mock only: the user's own pickups are listed too, so one phone can play both the household and the collector.
      const jobs: CollectorJob[] = db.pickups
        .filter((p) => p.status === 'requested' && (!query.materialId || p.items.some((i) => i.materialId === query.materialId)))
        .map((p) => {
          const v = pickupView(p);
          return {
            id: v.id,
            items: v.items,
            location: { ...v.location, lat: approx(v.location.lat), lng: approx(v.location.lng) },
            day: v.day,
            slot: v.slot,
            mode: v.mode,
            note: v.note,
            estimatedKg: sumKg(v.items),
            estimatedValueEgp: v.estimatedValueEgp,
            distanceM: Math.round(haversineM(here, v.location)),
          };
        })
        .filter((j) => (j.distanceM ?? 0) <= query.radiusM)
        .sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
      return jobs;
    },

    async myPickups(userId) {
      await delay();
      const db = await loadCityCycleDb();
      const c = db.collectors[userId];
      if (!c) return [];
      return db.pickups
        .filter((p) => p.collectorId === c.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(pickupView);
    },

    async accept(userId, pickupId) {
      await delay();
      return mutate((db) => {
        const c = requireVerified(db, userId);
        const p = db.pickups.find((x) => x.id === pickupId);
        if (!p) throw notFound();
        if (p.collectorId === c.id) return pickupView(p); // same collector again: idempotent
        if (p.status !== 'requested') throw conflict('اتاخد خلاص', 'Already taken');
        const first = firstName(c.name);
        const updated: DbPickup = {
          ...p,
          status: 'accepted',
          collectorId: c.id,
          collectorName: first,
          timeline: [...p.timeline, entry('accepted', first, first, `${first} قبل الطلب وجاي لك`, `${first} accepted your pickup and is on the way`)],
        };
        db.pickups = db.pickups.map((x) => (x.id === pickupId ? updated : x));
        return pickupView(updated);
      });
    },

    async addWeighing(userId, pickupId, input) {
      await delay(150);
      return mutate((db) => {
        const c = requireVerified(db, userId);
        const p = mineOf(db, c, pickupId);
        const dup = p.weighings.find((w) => w.clientId === input.clientId);
        if (dup) return dup; // a retry after a lost answer
        if (p.collectorFinishedAt || (p.status !== 'accepted' && p.status !== 'weighed')) throw conflict('الطلب ده خلص', 'This pickup is already finished');
        if (!(input.kg > 0)) throw new ApiError(400, tr('الوزن لازم يكون أكبر من صفر', 'The weight must be more than zero'));
        const price = priceOf(db.prices, input.materialId);
        const weighing: Weighing = {
          id: `WGH-${num(db.counters.weighing++)}`,
          pickupId,
          materialId: input.materialId,
          kg: input.kg,
          source: input.source,
          scaleId: input.scaleId,
          priceEgpPerKg: price,
          valueEgp: valueOf(input.kg, price),
          clientId: input.clientId,
          at: new Date().toISOString(),
        };
        const first = p.status === 'accepted';
        const updated = retotal({
          ...p,
          status: 'weighed',
          weighings: [...p.weighings, weighing],
          timeline: first ? [...p.timeline, entry('weighed', firstName(c.name), firstName(c.name), 'الجامع وزن الخامات', 'The collector weighed the materials')] : p.timeline,
        });
        db.pickups = db.pickups.map((x) => (x.id === pickupId ? updated : x));
        return weighing;
      });
    },

    async complete(userId, pickupId, paidToHouseholdEgp) {
      await delay();
      return mutate((db) => {
        const c = requireVerified(db, userId);
        const p = mineOf(db, c, pickupId);
        if (p.collectorFinishedAt) return pickupView(p);
        if (p.weighings.length === 0) throw conflict('اوزن الخامات الأول', 'Weigh the materials first');
        if (paidToHouseholdEgp !== undefined && !(paidToHouseholdEgp >= 0)) throw new ApiError(400, tr('المبلغ مش صح', 'That amount is not valid'));
        const first = firstName(c.name);
        const updated: DbPickup = {
          ...p,
          paidToHouseholdEgp: p.mode === 'paid' ? paidToHouseholdEgp : undefined,
          collectorFinishedAt: new Date().toISOString(),
          timeline: [...p.timeline, entry('weighed', first, first, 'الجامع خلّص، ومستني تأكيدك للوزن', 'The collector is done and is waiting for your confirmation')],
        };
        db.pickups = db.pickups.map((x) => (x.id === pickupId ? updated : x));
        return pickupView(updated);
      });
    },

    async earnings(userId, range) {
      await delay();
      const db = await loadCityCycleDb();
      const c = db.collectors[userId];
      const mine = c ? db.pickups.filter((p) => p.collectorId === c.id) : [];
      const inPeriod = mine.flatMap((p) => p.weighings).filter((w) => inRange(w.at, range));
      const totals = weighingTotals(inPeriod);
      const pickupIds = new Set(inPeriod.map((w) => w.pickupId));
      const paid = mine
        .filter((p) => p.collectorFinishedAt && inRange(p.collectorFinishedAt, range))
        .reduce((s, p) => s + (p.paidToHouseholdEgp ?? 0), 0);
      const out: Earnings = {
        period: range,
        totalKg: totals.totalKg,
        valueEgp: totals.totalValueEgp,
        paidToHouseholdsEgp: Math.round(paid * 100) / 100,
        byMaterial: totals.byMaterial as { materialId: MaterialId; kg: number; valueEgp: number }[],
        jobs: pickupIds.size,
      };
      return out;
    },

    async simulateVerify(userId) {
      await delay(150);
      return mutate((db) => {
        const c = db.collectors[userId];
        if (!c) throw notFound();
        const updated: Collector = { ...c, status: 'verified' };
        db.collectors[userId] = updated;
        return updated;
      });
    },
  };
}

// ---- Smart bins ----

export function createMockBinService(): BinService {
  const incidents = createMockIncidentService();
  return {
    async list() {
      await delay(150);
      const db = await loadCityCycleDb();
      return db.bins.map(binView);
    },

    async reportFull(userId, binId, input) {
      const db = await loadCityCycleDb();
      const bin = db.bins.find((b) => b.id === binId);
      if (!bin) throw new ApiError(404, tr('الصندوق مش موجود', "We couldn't find that bin"));
      const name = bin.name ?? bin.id;
      const note = input.note?.trim();
      // The real backend creates the linked garbage incident itself; the mock does it through the FixFirst mock.
      await incidents.submitReport(userId, {
        categoryId: 'garbage',
        description: `${name} (${bin.id}) مليان${note ? `: ${note}` : ''}`,
        photoUris: [],
        location: bin.location,
        anonymous: false,
        blurFaces: false,
      });
    },
  };
}

// ---- AI waste photo check ----

/** Canned suggestions (the real model is member 5's `/ai/waste-classify`); chosen from the photo path so a retry repeats. */
const CANNED: WasteClassification[] = [
  { materials: [{ materialId: 'pet_plastic', confidence: 0.78 }, { materialId: 'metal_cans', confidence: 0.12 }, { materialId: 'glass', confidence: 0.05 }], size: 'medium', estimatedKgRange: [2, 4], source: 'model' },
  { materials: [{ materialId: 'paper_cardboard', confidence: 0.83 }, { materialId: 'pet_plastic', confidence: 0.09 }, { materialId: 'organics', confidence: 0.03 }], size: 'large', estimatedKgRange: [5, 10], source: 'model' },
  { materials: [{ materialId: 'glass', confidence: 0.71 }, { materialId: 'metal_cans', confidence: 0.18 }, { materialId: 'pet_plastic', confidence: 0.06 }], size: 'small', estimatedKgRange: [1, 2], source: 'model' },
];

export function createMockWasteAiService(): WasteAiService {
  return {
    async classify(path) {
      await delay(600);
      let h = 0;
      for (let i = 0; i < path.length; i++) h = (h * 31 + path.charCodeAt(i)) >>> 0;
      return CANNED[h % CANNED.length];
    },
  };
}
