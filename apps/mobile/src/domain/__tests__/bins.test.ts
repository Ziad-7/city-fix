import { BIN_THRESHOLDS, binDisplayState, binStateFromReading, isBinAlert } from '../bins';

const NOW = Date.parse('2026-10-22T10:00:00Z');
const recent = new Date(NOW - 5 * 60_000).toISOString();

describe('bin status', () => {
  it('is ok below the filling threshold', () => {
    expect(binStateFromReading({ fillPct: 20, tempC: 30, batteryV: 3.9, lastSeenAt: recent }, NOW)).toBe('ok');
    expect(binDisplayState({ state: 'ok', fillPct: BIN_THRESHOLDS.fillingPct - 1 })).toBe('ok');
  });

  it('shows filling between the filling and full thresholds', () => {
    const s = binStateFromReading({ fillPct: BIN_THRESHOLDS.fillingPct + 1, lastSeenAt: recent }, NOW);
    expect(s).toBe('ok');
    expect(binDisplayState({ state: s, fillPct: BIN_THRESHOLDS.fillingPct + 1 })).toBe('filling');
  });

  it('is full from the full threshold', () => {
    expect(binStateFromReading({ fillPct: BIN_THRESHOLDS.fullPct - 1 }, NOW)).toBe('ok');
    expect(binStateFromReading({ fillPct: BIN_THRESHOLDS.fullPct }, NOW)).toBe('full');
    expect(binStateFromReading({ fillPct: 100 }, NOW)).toBe('full');
  });

  it('heat beats full', () => {
    expect(binStateFromReading({ fillPct: 95, tempC: BIN_THRESHOLDS.heatC }, NOW)).toBe('hot');
    expect(binStateFromReading({ fillPct: 10, tempC: BIN_THRESHOLDS.heatC - 1 }, NOW)).toBe('ok');
  });

  it('low battery and offline', () => {
    expect(binStateFromReading({ fillPct: 10, batteryV: BIN_THRESHOLDS.lowBatteryV - 0.1 }, NOW)).toBe('low_battery');
    const old = new Date(NOW - (BIN_THRESHOLDS.offlineAfterMin + 1) * 60_000).toISOString();
    expect(binStateFromReading({ fillPct: 99, tempC: 90, lastSeenAt: old }, NOW)).toBe('offline');
  });

  it('keeps the server state when it is not ok, and flags the alerts', () => {
    expect(binDisplayState({ state: 'hot', fillPct: 10 })).toBe('hot');
    expect(binDisplayState({ state: 'ok' })).toBe('ok');
    expect(isBinAlert('full')).toBe(true);
    expect(isBinAlert('hot')).toBe(true);
    expect(isBinAlert('filling')).toBe(false);
  });
});
