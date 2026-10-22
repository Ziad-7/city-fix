/**
 * Pure helpers for the smart-bin map layer, the bin detail screen and the Home "nearest bins" list.
 * No React, no I/O: everything here is unit-tested.
 */
import { binDisplayState, type BinDisplayState } from './bins';
import type { Bin } from './citycycle';
import type { LatLng } from './types';
import { haversineM } from '@/utils/geo';

/** What the map tab shows. */
export type MapLayer = 'problems' | 'bins';

export const MAP_LAYERS: { id: MapLayer; labelAr: string; labelEn: string; icon: 'alert-triangle' | 'trash' }[] = [
  { id: 'problems', labelAr: 'المشاكل', labelEn: 'Problems', icon: 'alert-triangle' },
  { id: 'bins', labelAr: 'الصناديق الذكية', labelEn: 'Smart bins', icon: 'trash' },
];

/** The mock fill drifts on every refresh; real bins report every ~30 min. */
export const BIN_REFRESH_MS = 45_000;

/** How often to refresh while a layer is showing; `null` = never (the problems layer has its own refresh). */
export const binPollMs = (layer: MapLayer): number | null => (layer === 'bins' ? BIN_REFRESH_MS : null);

/** Same bin may be reported full once in 24 h per person. */
export const BIN_REPORT_WINDOW_MS = 24 * 3_600_000;

/** Time left before this person may report the bin again; 0 when they can report now. */
export function reportCooldownMs(lastReportedAt: string | undefined, now: number = Date.now()): number {
  if (!lastReportedAt) return 0;
  const t = Date.parse(lastReportedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t + BIN_REPORT_WINDOW_MS - now);
}

export const canReportFull = (lastReportedAt: string | undefined, now?: number): boolean => reportCooldownMs(lastReportedAt, now) === 0;

/** Whole hours (rounded up) in a cooldown, for "try again in about N hours". Never below 1. */
export const cooldownHours = (ms: number): number => Math.max(1, Math.ceil(ms / 3_600_000));

export type BinWithDistance = { bin: Bin; state: BinDisplayState; distanceM: number };

/** Nearest bins first. Bins that don't report any fill still count: the card shows their state. */
export function nearestBins(bins: readonly Bin[], from: LatLng, limit = 3): BinWithDistance[] {
  return bins
    .map((bin) => ({ bin, state: binDisplayState(bin), distanceM: haversineM(from, bin.location) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

export type BinFilter = 'all' | 'needs_attention';

/** Full, heat and offline bins need somebody to look at them. */
export const needsAttention = (s: BinDisplayState): boolean => s === 'full' || s === 'hot' || s === 'offline';

export function filterBins(bins: readonly Bin[], filter: BinFilter): Bin[] {
  return filter === 'all' ? [...bins] : bins.filter((b) => needsAttention(binDisplayState(b)));
}

/** Count of bins per display state, only states that appear. */
export function binCounts(bins: readonly Bin[]): Partial<Record<BinDisplayState, number>> {
  const out: Partial<Record<BinDisplayState, number>> = {};
  for (const b of bins) {
    const s = binDisplayState(b);
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

/** Legend order: calm to urgent. */
export const BIN_LEGEND_ORDER: BinDisplayState[] = ['ok', 'filling', 'full', 'hot', 'low_battery', 'offline'];

/** Fill clamped to 0..100 and rounded; `undefined` when the bin never reported a fill. */
export const fillPercent = (b: Pick<Bin, 'fillPct'>): number | undefined =>
  b.fillPct === undefined ? undefined : Math.max(0, Math.min(100, Math.round(b.fillPct)));

/** Readable names from a bin: name, else the id. */
export const binTitle = (b: Pick<Bin, 'id' | 'name'>): string => b.name ?? b.id;
