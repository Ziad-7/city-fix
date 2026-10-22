import type { CompletePickupInput, Weighing, WeighingInput } from '@/domain/citycycle';
import { aggregateWeighings, DEMO_MATERIAL_PRICES, isMaterialId, PICKUP_LIMITS, roundEgp, weighingValue } from '@/domain/materials';
import { tr } from '@/i18n';
import { AlreadyTakenError, CityCycleInputError } from '../citycycle-errors';
import { pickupTimelineEntry } from './citycycle-timeline';
import type { DbCollector, DbPickup } from './citycycle-seed';
import type { MockDb } from './seed';

/**
 * The rules of a pickup's life on the mock "server": one place, used by the citizen service, the collector service and
 * the dev `simulatePickupProgress`. Every function changes `db` in place and returns the new row; the caller saves.
 */

export const notFound = () => new CityCycleInputError(tr('الطلب مش موجود', "We couldn't find that pickup"));

const replace = (db: MockDb, row: DbPickup): DbPickup => {
  db.pickups = db.pickups.map((p) => (p.id === row.id ? row : p));
  return row;
};

const firstName = (c: DbCollector) => c.name.split(' ')[0];
const firstNameEn = (c: DbCollector) => c.nameEn.split(' ')[0];
const who = (c: DbCollector) => ({ collectorName: firstName(c), collectorNameEn: firstNameEn(c) });

function mine(db: MockDb, col: DbCollector, id: string): DbPickup {
  const row = db.pickups.find((p) => p.id === id);
  if (!row) throw notFound();
  if (row.collectorId !== col.id) throw new CityCycleInputError(tr('الطلب ده مش بتاعك', 'This job is not yours'));
  return row;
}

export function findCollector(db: MockDb, userId: string): DbCollector {
  const col = db.collectors.find((c) => c.userId === userId);
  if (!col) throw new CityCycleInputError(tr('مفيش حساب جامع لحسابك', 'Your account is not a collector account'));
  return col;
}

/** First accept wins: anyone after that gets `AlreadyTakenError`. Accepting your own job again is a no-op. */
export function acceptPickup(db: MockDb, col: DbCollector, id: string, now = new Date()): DbPickup {
  const row = db.pickups.find((p) => p.id === id);
  if (!row) throw notFound();
  if (col.status !== 'verified') throw new CityCycleInputError(tr('حسابك لسه متوثّقش', 'Your account is not verified yet'));
  if (row.collectorId === col.id && row.status !== 'requested') return row;
  if (row.status !== 'requested') throw new AlreadyTakenError();
  return replace(db, {
    ...row,
    status: 'accepted',
    collectorId: col.id,
    ...who(col),
    timeline: [...row.timeline, pickupTimelineEntry('accepted', now.toISOString(), who(col))],
  });
}

/** "On my way": records `startedAt` and one timeline entry. */
export function startPickup(db: MockDb, col: DbCollector, id: string, now = new Date()): DbPickup {
  const row = mine(db, col, id);
  if (row.startedAt || (row.status !== 'accepted' && row.status !== 'weighed')) return row;
  const at = now.toISOString();
  return replace(db, { ...row, startedAt: at, timeline: [...row.timeline, pickupTimelineEntry('accepted', at, who(col), { kind: 'started' })] });
}

/** Adds a weighing (idempotent on `clientId`) and moves the pickup to `weighed`. The price is the one at this moment. */
export function addWeighing(db: MockDb, col: DbCollector, id: string, input: WeighingInput, now = new Date()): Weighing {
  const row = mine(db, col, id);
  const dup = row.weighings.find((w) => w.clientId === input.clientId);
  if (dup) return dup;
  if (row.status !== 'accepted' && row.status !== 'weighed') {
    throw new CityCycleInputError(tr('الطلب ده مش مفتوح للوزن', 'This job can no longer be weighed'));
  }
  if (!input.clientId) throw new CityCycleInputError(tr('clientId مطلوب', 'clientId is required'));
  if (!isMaterialId(input.materialId)) throw new CityCycleInputError(tr('الخامة مش معروفة', 'Unknown material'));
  if (!Number.isFinite(input.kg) || input.kg <= 0 || input.kg > PICKUP_LIMITS.maxKgPerMaterial) {
    throw new CityCycleInputError(tr('الوزن لازم يكون أكبر من صفر', 'The weight must be more than zero'));
  }
  const price = DEMO_MATERIAL_PRICES[input.materialId];
  const kg = Math.round(input.kg * 100) / 100;
  const at = now.toISOString();
  const weighing: Weighing = {
    id: `W-${id.replace('RCY-', '')}-${row.weighings.length + 1}`,
    pickupId: id,
    materialId: input.materialId,
    kg,
    source: input.source,
    ...(input.scaleId ? { scaleId: input.scaleId } : {}),
    priceEgpPerKg: price,
    valueEgp: weighingValue(kg, price),
    clientId: input.clientId,
    at,
  };
  const weighings = [...row.weighings, weighing];
  const agg = aggregateWeighings(weighings);
  // One "weighed" entry: later weighings update its total instead of adding more lines.
  const last = row.timeline[row.timeline.length - 1];
  const entry = pickupTimelineEntry('weighed', at, who(col), { totalKg: agg.totalKg });
  const timeline = last && last.status === entry.status ? [...row.timeline.slice(0, -1), entry] : [...row.timeline, entry];
  replace(db, { ...row, status: 'weighed', weighings, totalKg: agg.totalKg, totalValueEgp: agg.valueEgp, timeline });
  return weighing;
}

/** Finishes the job: needs at least one weighing. The cash paid to the household is only logged, never processed. */
export function completePickup(db: MockDb, col: DbCollector, id: string, input: CompletePickupInput = {}, now = new Date()): DbPickup {
  const row = mine(db, col, id);
  if (row.status === 'completed') return row;
  if (row.status !== 'weighed' || row.weighings.length === 0) {
    throw new CityCycleInputError(tr('وزّن الخامات الأول', 'Weigh the materials first'));
  }
  const paid = input.paidToHouseholdEgp ?? 0;
  if (!Number.isFinite(paid) || paid < 0 || paid > 100_000) throw new CityCycleInputError(tr('المبلغ مش مظبوط', 'That amount is not valid'));
  const at = now.toISOString();
  return replace(db, {
    ...row,
    status: 'completed',
    ...(paid > 0 ? { paidToHouseholdEgp: roundEgp(paid) } : {}),
    timeline: [...row.timeline, pickupTimelineEntry('completed', at, who(col), { paidEgp: paid })],
  });
}
