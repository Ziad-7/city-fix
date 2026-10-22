import {
  BIN_REFRESH_MS, BIN_REPORT_WINDOW_MS, binCounts, binPollMs, binTitle, canReportFull, cooldownHours, fillPercent, filterBins,
  nearestBins, needsAttention, reportCooldownMs,
} from './bin-map';
import type { Bin } from './citycycle';

const bin = (id: string, lat: number, over: Partial<Bin> = {}): Bin => ({
  id, kind: 'street', state: 'ok', fillPct: 10, location: { lat, lng: 31.33, address: id }, ...over,
});
const from = { lat: 30.05, lng: 31.33 };
const bins = [
  bin('far', 30.09),
  bin('near', 30.051, { state: 'full', fillPct: 90 }),
  bin('mid', 30.06, { fillPct: 65 }),
  bin('off', 30.07, { state: 'offline' }),
];

describe('bin refresh interval', () => {
  it('polls only while the bins layer is showing, every 30-60 s', () => {
    expect(binPollMs('bins')).toBe(BIN_REFRESH_MS);
    expect(binPollMs('problems')).toBeNull();
    expect(BIN_REFRESH_MS).toBeGreaterThanOrEqual(30_000);
    expect(BIN_REFRESH_MS).toBeLessThanOrEqual(60_000);
  });
});

describe('report-full cooldown (once per 24 h)', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  it('allows a first report', () => {
    expect(canReportFull(undefined, now)).toBe(true);
    expect(reportCooldownMs('garbage', now)).toBe(0);
  });
  it('blocks inside the window and reports the time left', () => {
    const at = new Date(now - 3 * 3_600_000).toISOString();
    expect(canReportFull(at, now)).toBe(false);
    expect(reportCooldownMs(at, now)).toBe(BIN_REPORT_WINDOW_MS - 3 * 3_600_000);
    expect(cooldownHours(reportCooldownMs(at, now))).toBe(21);
  });
  it('allows again after 24 h', () => {
    expect(canReportFull(new Date(now - 25 * 3_600_000).toISOString(), now)).toBe(true);
  });
  it('never shows less than one hour', () => {
    expect(cooldownHours(60_000)).toBe(1);
  });
});

describe('nearestBins', () => {
  it('sorts by distance, limits, and carries the display state', () => {
    const r = nearestBins(bins, from, 3);
    expect(r.map((x) => x.bin.id)).toEqual(['near', 'mid', 'off']);
    expect(r[0].state).toBe('full');
    expect(r[1].state).toBe('filling');
    expect(r[0].distanceM).toBeLessThan(r[1].distanceM);
  });
  it('handles an empty list', () => {
    expect(nearestBins([], from)).toEqual([]);
  });
});

describe('layer filtering and counts', () => {
  it('needs attention = full, hot, offline', () => {
    expect(needsAttention('full')).toBe(true);
    expect(needsAttention('hot')).toBe(true);
    expect(needsAttention('offline')).toBe(true);
    expect(needsAttention('filling')).toBe(false);
    expect(needsAttention('low_battery')).toBe(false);
  });
  it('filters bins', () => {
    expect(filterBins(bins, 'all')).toHaveLength(4);
    expect(filterBins(bins, 'needs_attention').map((b) => b.id)).toEqual(['near', 'off']);
  });
  it('counts per display state', () => {
    expect(binCounts(bins)).toEqual({ ok: 1, full: 1, filling: 1, offline: 1 });
  });
});

describe('small helpers', () => {
  it('clamps and rounds the fill', () => {
    expect(fillPercent({ fillPct: 104.4 })).toBe(100);
    expect(fillPercent({ fillPct: 47.6 })).toBe(48);
    expect(fillPercent({})).toBeUndefined();
  });
  it('falls back to the id for the title', () => {
    expect(binTitle({ id: 'BIN-1' })).toBe('BIN-1');
    expect(binTitle({ id: 'BIN-1', name: 'Gate 2' })).toBe('Gate 2');
  });
});
