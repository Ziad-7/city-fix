import type { BinState } from '@/domain/citycycle';

/** Server defaults (backend/app/bin_schemas.py full_pct/heat_c, routers/bins.py battery < 3.3 V). Demo only. */
export const FULL_PCT = 80;
export const HEAT_C = 60;
export const LOW_BATTERY_V = 3.3;

/** What the demo bin senses: how full, how hot, weak battery, no signal. */
export type SimBin = { fillPct: number; tempC: number; lowBattery: boolean; online: boolean };

export const START: SimBin = { fillPct: 45, tempC: 30, lowBattery: false, online: true };

const clampFill = (n: number) => Math.min(100, Math.max(0, n));

/** Same order as the backend (_bin_status): offline > full > hot > low battery > ok. */
export function simBinState(b: SimBin): BinState {
  if (!b.online) return 'offline';
  if (clampFill(b.fillPct) >= FULL_PCT) return 'full';
  if (b.tempC >= HEAT_C) return 'hot';
  if (b.lowBattery) return 'low_battery';
  return 'ok';
}

/** The truck empties the bin. */
export const emptied = (b: SimBin): SimBin => ({ ...b, fillPct: 0 });
