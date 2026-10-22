/**
 * Smart-bin states from a reading. The device sends fill %, temperature and battery; the server decides the alert
 * (`Bin.state`). The app derives the same view when it needs to (mock mode, or to add "filling" on top of `ok`).
 */
import type { Bin, BinState } from './citycycle';
import type { IconName, IncidentStatus } from './types';

/**
 * Thresholds. TO VERIFY on the bench and with the district: the hardware brief gives 80 % and 60 C as example values,
 * and the real ones are served by the API (`fullPct`, `heatC` in the readings response).
 */
export const BIN_THRESHOLDS = {
  /** From here the bin shows as "filling" (amber). */
  fillingPct: 60,
  /** From here the bin is full. */
  fullPct: 80,
  /** Waste temperature that raises the heat alert. */
  heatC: 60,
  /** Below this the battery is low. */
  lowBatteryV: 3.5,
  /** No reading for this long: offline. */
  offlineAfterMin: 180,
} as const;

/** What the map shows: the contract states plus `filling`. */
export type BinDisplayState = BinState | 'filling';

export type BinSignal = { fillPct?: number; tempC?: number; batteryV?: number; lastSeenAt?: string };

/**
 * State of a bin from its latest reading. Most urgent first: offline, heat alert, full, low battery, filling, ok.
 */
export function binStateFromReading(r: BinSignal, now: number = Date.now()): BinState {
  if (r.lastSeenAt) {
    const age = (now - Date.parse(r.lastSeenAt)) / 60_000;
    if (age > BIN_THRESHOLDS.offlineAfterMin) return 'offline';
  }
  if (r.tempC !== undefined && r.tempC >= BIN_THRESHOLDS.heatC) return 'hot';
  if (r.fillPct !== undefined && r.fillPct >= BIN_THRESHOLDS.fullPct) return 'full';
  if (r.batteryV !== undefined && r.batteryV < BIN_THRESHOLDS.lowBatteryV) return 'low_battery';
  return 'ok';
}

/** `ok` that is getting full shows as `filling`. The server state wins when it is not `ok`. */
export function binDisplayState(bin: Pick<Bin, 'state' | 'fillPct'>): BinDisplayState {
  if (bin.state !== 'ok') return bin.state;
  return bin.fillPct !== undefined && bin.fillPct >= BIN_THRESHOLDS.fillingPct ? 'filling' : 'ok';
}

/** Full and heat alerts need a collection soon; the report-full button is pointless on these. */
export const isBinAlert = (s: BinDisplayState): boolean => s === 'full' || s === 'hot';

/** `StatusChip` colour per state (green, amber, red; grey for the device states). Never rely on colour alone: add the label. */
export const BIN_CHIP_KIND: Record<BinDisplayState, IncidentStatus | 'critical'> = {
  ok: 'resolved',
  filling: 'in_progress',
  full: 'critical',
  hot: 'critical',
  low_battery: 'received',
  offline: 'closed',
};

/** Icon per state (all in the icon set). */
export const BIN_ICON: Record<BinDisplayState, IconName> = {
  ok: 'check',
  filling: 'trash',
  full: 'alert-triangle',
  hot: 'flame',
  low_battery: 'zap',
  offline: 'wifi',
};

/** Arabic state words (English: i18n/labels `binStateLabel`). Colour is never the only signal. */
export const BIN_STATE_LABEL_AR: Record<BinDisplayState, string> = {
  ok: 'تمام',
  filling: 'بيمتلي',
  full: 'ممتلي',
  hot: 'حرارة عالية',
  low_battery: 'البطارية ضعيفة',
  offline: 'مش بيبعت',
};
