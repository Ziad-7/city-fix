import { binStateFromReading } from '@/domain/bins';
import { type MaterialId, type WasteClassification, type WasteSize } from '@/domain/citycycle';
import {
  aggregateWeighings,
  computeImpact,
  demoPriceList,
  estimatedValue,
  normalizeItems,
  PICKUP_LIMITS,
  roundKg,
} from '@/domain/materials';
import { tr } from '@/i18n';
import { CityCycleInputError } from '../citycycle-errors';
import type { CityCycleService } from '../interfaces';
import { acceptPickup, addWeighing, completePickup, findCollector, notFound } from './citycycle-core';
import { binView, pickupView } from './citycycle-localize';
import { pickupTimelineEntry } from './citycycle-timeline';
import { delay, loadDb, saveDb } from './db';
import { createMockIncidentService } from './incident-service';
import type { DbPickup } from './citycycle-seed';
import { DEMO_COLLECTOR_USER_ID } from './citycycle-seed';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CLASSIFY_SIZES: Record<WasteSize, [number, number]> = { small: [0.5, 2], medium: [2, 6], large: [6, 15] };

/** A stable number from text, so the same photo path always gets the same mock suggestion. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const KEYWORDS: [RegExp, MaterialId][] = [
  [/bottle|pet|plastic|water|juice|ازاز|إزاز|بلاستيك/i, 'pet_plastic'],
  [/box|carton|paper|news|card|كرتون|ورق/i, 'paper_cardboard'],
  [/can|tin|metal|علب|معدن/i, 'metal_cans'],
  [/glass|jar|برطمان/i, 'glass'],
  [/phone|charger|cable|electr|laptop|موبايل|شاحن/i, 'e_waste'],
  [/oil|زيت/i, 'cooking_oil'],
  [/food|veg|fruit|organic|اكل|أكل|خضار/i, 'organics'],
];

const ALL: MaterialId[] = ['pet_plastic', 'paper_cardboard', 'metal_cans', 'glass', 'e_waste', 'cooking_oil', 'organics'];

export function mockClassification(path: string): WasteClassification {
  const h = hash(path);
  const keyword = KEYWORDS.find(([re]) => re.test(path))?.[1];
  const top = keyword ?? ALL[h % ALL.length];
  const rest = ALL.filter((m) => m !== top);
  const second = rest[(h >>> 3) % rest.length];
  const third = rest.filter((m) => m !== second)[(h >>> 6) % (rest.length - 1)];
  const size: WasteSize = (['small', 'medium', 'large'] as const)[(h >>> 9) % 3];
  return {
    materials: [
      { materialId: top, confidence: 0.72 },
      { materialId: second, confidence: 0.15 },
      { materialId: third, confidence: 0.07 },
    ],
    size,
    estimatedKgRange: CLASSIFY_SIZES[size],
    source: 'model',
  };
}

export function createMockCityCycleService(): CityCycleService {
  return {
    async listPrices(district) {
      await delay(150);
      return demoPriceList(district);
    },

    async createPickup(userId, input) {
      await delay();
      const items = normalizeItems(input.items);
      if (items.length === 0) {
        throw new CityCycleInputError(tr('لازم خامة واحدة على الأقل بوزن تقريبي', 'Add at least one material with an approximate weight'));
      }
      if (items.some((i) => i.estimatedKg > PICKUP_LIMITS.maxKgPerMaterial)) {
        throw new CityCycleInputError(tr('الوزن كبير أوي، قسّمه على أكتر من طلب', 'That is a lot of weight. Please split it into more than one pickup'));
      }
      if (!DAY_RE.test(input.day)) throw new CityCycleInputError(tr('اليوم مش مظبوط', 'The day is not valid'));
      if (input.mode !== 'free' && input.mode !== 'paid') throw new CityCycleInputError(tr('اختار مجانًا أو بمقابل', 'Choose free or paid'));
      const db = await loadDb();
      const now = new Date().toISOString();
      const estimated = estimatedValue(items, demoPriceList());
      const row: DbPickup = {
        id: `RCY-${db.pickupCounter++}`,
        citizenId: userId,
        items,
        photoUris: input.photoUris ?? [],
        location: input.location,
        day: input.day,
        slot: input.slot,
        mode: input.mode,
        ...(estimated !== undefined ? { estimatedValueEgp: estimated } : {}),
        status: 'requested',
        weighings: [],
        timeline: [pickupTimelineEntry('requested', now)],
        createdAt: now,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      };
      db.pickups = [row, ...db.pickups];
      await saveDb(db);
      return pickupView(row);
    },

    async listMyPickups(userId) {
      await delay();
      const db = await loadDb();
      return db.pickups
        .filter((p) => p.citizenId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(pickupView);
    },

    async getPickup(id) {
      const db = await loadDb();
      const row = db.pickups.find((p) => p.id === id);
      return row ? pickupView(row) : null;
    },

    async cancelPickup(userId, id, note) {
      await delay();
      const db = await loadDb();
      const row = db.pickups.find((p) => p.id === id && p.citizenId === userId);
      if (!row) throw notFound();
      if (row.status === 'cancelled') return pickupView(row);
      if (row.status !== 'requested') throw new CityCycleInputError(tr('الطلب اتقبل بالفعل، مش هينفع يتلغى', 'A collector already accepted this pickup, so it can’t be cancelled'));
      const updated: DbPickup = {
        ...row,
        status: 'cancelled',
        timeline: [...row.timeline, pickupTimelineEntry('cancelled', new Date().toISOString())],
        ...(note?.trim() ? { note: note.trim() } : {}),
      };
      db.pickups = db.pickups.map((p) => (p.id === id ? updated : p));
      await saveDb(db);
      return pickupView(updated);
    },

    async confirmPickup(userId, id) {
      await delay();
      const db = await loadDb();
      const row = db.pickups.find((p) => p.id === id && p.citizenId === userId);
      if (!row) throw notFound();
      if (row.status !== 'completed') throw new CityCycleInputError(tr('لسه الاستلام ما خلصش', 'This pickup is not finished yet'));
      if (row.confirmedAt) return pickupView(row);
      const updated: DbPickup = { ...row, confirmedAt: new Date().toISOString() };
      db.pickups = db.pickups.map((p) => (p.id === id ? updated : p));
      await saveDb(db);
      return pickupView(updated);
    },

    async getMyImpact(userId) {
      await delay(150);
      const db = await loadDb();
      const collector = db.collectors.find((c) => c.userId === userId);
      const done = db.pickups.filter((p) => p.status === 'completed' && (collector ? p.collectorId === collector.id : p.citizenId === userId));
      return computeImpact(done.flatMap((p) => p.weighings), done.length, { includeEarned: !!collector });
    },

    async listBins() {
      await delay(200);
      const db = await loadDb();
      const now = Date.now();
      // The map feels alive: every refresh the filling bins gain a few points, like a new reading arrived.
      db.bins = db.bins.map((b) => {
        const fillPct = Math.min(100, (b.fillPct ?? 0) + b.driftPct);
        const lastSeenAt = new Date(now).toISOString();
        const next = { ...b, fillPct, lastSeenAt, seq: b.seq + 1 };
        return { ...next, state: binStateFromReading(next, now) };
      });
      await saveDb(db);
      return db.bins.map(binView);
    },

    async reportFullBin(userId, binId, input) {
      await delay();
      const db = await loadDb();
      const bin = db.bins.find((b) => b.id === binId);
      if (!bin) throw new CityCycleInputError(tr('الصندوق مش موجود', "We couldn't find that bin"));
      const dayAgo = Date.now() - 24 * 3_600_000;
      if (db.binReports.some((r) => r.binId === binId && r.userId === userId && Date.parse(r.at) > dayAgo)) return;
      const name = bin.name ?? bin.id;
      const { report } = await createMockIncidentService().submitReport(userId, {
        categoryId: 'garbage',
        description: `${tr(`الصندوق ممتلي: ${name}`, `Bin is full: ${bin.nameEn ?? name}`)}${input?.note?.trim() ? `. ${input.note.trim()}` : ''}`,
        photoUris: input?.photoUri ? [input.photoUri] : [],
        location: bin.location,
        anonymous: false,
        blurFaces: true,
      });
      // submitReport saved its own copy of the database object: write ours again on top of it.
      const fresh = await loadDb();
      fresh.binReports = [...(fresh.binReports ?? []), { id: `BR-${fresh.binReports.length + 1}`, binId, userId, reportId: report.id, note: input?.note, at: new Date().toISOString() }];
      await saveDb(fresh);
    },

    async classifyWaste(path) {
      await delay(700);
      return mockClassification(path);
    },

    async simulatePickupProgress(id) {
      const db = await loadDb();
      const row = db.pickups.find((p) => p.id === id);
      if (!row) throw notFound();
      const col = findCollector(db, DEMO_COLLECTOR_USER_ID);
      let next: DbPickup = row;
      if (row.status === 'requested') next = acceptPickup(db, col, id);
      else if (row.status === 'accepted') {
        // The collector weighs about what the household estimated (a little under).
        row.items.forEach((it, i) =>
          addWeighing(db, col, id, { materialId: it.materialId, kg: roundKg(it.estimatedKg * 0.92), source: 'manual', clientId: `sim-${id}-${i}` }),
        );
        next = db.pickups.find((p) => p.id === id) as DbPickup;
      } else if (row.status === 'weighed') {
        next = completePickup(db, col, id, { paidToHouseholdEgp: row.mode === 'paid' ? aggregateWeighings(row.weighings).valueEgp : 0 });
      }
      await saveDb(db);
      return pickupView(next);
    },
  };
}

