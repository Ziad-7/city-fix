import type { Bin, Collector, CollectorJob, RecyclingPickup } from '@/domain/citycycle';
import type { TimelineEntry } from '@/domain/types';
import { getLang } from '@/i18n';
import { placeName } from '@/i18n/labels';
import { totalEstimatedKg } from '@/domain/materials';
import type { DbBin, DbCollector, DbPickup } from './citycycle-seed';
import type { DbTimelineEntry } from './timeline';

/** Read-time localisation for the CityCycle mock rows, like ./localize.ts: plain API types out, no internal fields. */

const en = () => getLang() === 'en';

function entry(e: DbTimelineEntry): TimelineEntry {
  return en() && e.noteEn && e.actorEn ? { status: e.status, note: e.noteEn, actor: e.actorEn, at: e.at } : { status: e.status, note: e.note, actor: e.actor, at: e.at };
}

export function pickupView(p: DbPickup): RecyclingPickup {
  const { addressEn, landmarkEn, collectorNameEn, timeline, ...rest } = p;
  return {
    ...rest,
    ...(rest.collectorName ? { collectorName: en() ? (collectorNameEn ?? rest.collectorName) : rest.collectorName } : {}),
    location: en() ? { ...p.location, address: addressEn ?? p.location.address, landmark: landmarkEn ?? p.location.landmark } : p.location,
    weighings: p.weighings.map((w) => ({ ...w })),
    photoUris: [...p.photoUris],
    timeline: timeline.map(entry),
  };
}

/** What a collector sees of an open pickup: no citizen id, an approximate pin (about 100 m), the address and landmark. */
export function jobView(p: DbPickup, distanceM?: number): CollectorJob {
  const view = pickupView(p);
  return {
    id: p.id,
    items: p.items.map((i) => ({ ...i })),
    location: { ...view.location, lat: Math.round(p.location.lat * 1000) / 1000, lng: Math.round(p.location.lng * 1000) / 1000 },
    day: p.day,
    slot: p.slot,
    mode: p.mode,
    estimatedKg: totalEstimatedKg(p.items),
    ...(p.estimatedValueEgp !== undefined ? { estimatedValueEgp: p.estimatedValueEgp } : {}),
    ...(distanceM !== undefined ? { distanceM } : {}),
    approxPin: true,
  };
}

export function binView(b: DbBin): Bin {
  const { nameEn, addressEn, driftPct: _d, seq: _s, ...rest } = b;
  return {
    ...rest,
    name: en() ? (nameEn ?? b.name) : b.name,
    location: en() ? { ...b.location, address: addressEn ?? b.location.address } : { ...b.location },
  };
}

export function collectorView(c: DbCollector): Collector {
  const { userId: _u, nameEn, vehicleEn, ...rest } = c;
  return { ...rest, name: en() ? nameEn : c.name, district: placeName(c.district), ...(c.vehicle ? { vehicle: en() ? (vehicleEn ?? c.vehicle) : c.vehicle } : {}) };
}
