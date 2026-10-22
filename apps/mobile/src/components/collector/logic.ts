/**
 * Pure helpers of collector mode (CityCycle track C2): no React, no stores, so they are easy to test.
 * Text that depends on the language lives in the components.
 */
import type { AppMode, Earnings, MaterialId, MaterialPrice, PickupMode, Weighing, WeighingSource } from '@/domain/citycycle';
import { suggestedPaymentEgp } from '@/domain/citycycle';
import { aggregateWeighings, priceOf, roundEgp, roundKg, weighingValue, PICKUP_LIMITS } from '@/domain/materials';

// ---- Mode redirect ----

/** The citizen tab roots: in collector mode these are replaced by the collector tabs. */
export const CITIZEN_TAB_ROOTS: readonly string[] = ['/', '/map', '/requests', '/profile'];

export const COLLECTOR_HOME = '/collector';

export const isCollectorPath = (pathname: string): boolean => pathname === COLLECTOR_HOME || pathname.startsWith(`${COLLECTOR_HOME}/`);

/**
 * Where to send the person so the screens match their mode, or `null` to stay.
 * Collector mode on a citizen tab root -> the collector home. Citizen mode inside /collector -> the citizen home.
 * Other citizen routes (a request opened from a notification, a deep link) are left alone in both modes.
 */
export function modeRedirect(pathname: string, mode: AppMode): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (mode === 'collector') return CITIZEN_TAB_ROOTS.includes(path) ? COLLECTOR_HOME : null;
  return isCollectorPath(path) ? '/' : null;
}

// ---- Number pad (kg with one decimal, EGP) ----

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

export type PadOptions = { maxDecimals: number; max: number };

/** kg: one decimal, up to the per-material limit. */
export const KG_PAD: PadOptions = { maxDecimals: 1, max: PICKUP_LIMITS.maxKgPerMaterial };
/** EGP paid to the household: whole pounds and piasters, up to a sane cap. */
export const EGP_PAD: PadOptions = { maxDecimals: 2, max: 100_000 };

/** Applies one key to the typed text. Keeps it a valid number: no leading zeros, a single dot, limited decimals and size. */
export function pressKey(current: string, key: PadKey, opts: PadOptions): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') {
    if (opts.maxDecimals === 0 || current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  let next = current === '0' ? key : current + key;
  if (next.includes('.') && next.length - next.indexOf('.') - 1 > opts.maxDecimals) return current;
  if (next.length > 9) return current;
  if (Number(next) > opts.max) return current;
  if (next === '00') next = '0';
  return next;
}

/** The typed text as a number (0 for empty or a lone dot). */
export const parseAmount = (text: string): number => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Text for a number the pad can show again (no trailing zeros): 2.5 -> "2.5", 3 -> "3", 0 -> "". */
export const padText = (n: number): string => (n > 0 ? String(Math.round(n * 100) / 100) : '');

/** +/- stepper on the typed value: rounds to 0.1 kg (or the unit's step) and stays between 0 and `max`. */
export function stepValue(text: string, delta: number, opts: PadOptions): string {
  const base = parseAmount(text);
  const unit = opts.maxDecimals >= 1 ? 10 ** Math.min(opts.maxDecimals, 1) : 1;
  const next = Math.min(opts.max, Math.max(0, Math.round((base + delta) * unit) / unit));
  return padText(next);
}

// ---- Weighing totals ----

type WeighingRow = Pick<Weighing, 'materialId' | 'kg' | 'valueEgp'>;

export type WeighingTotals = {
  totalKg: number;
  valueEgp: number;
  byMaterial: { materialId: MaterialId; kg: number; valueEgp: number }[];
  /** At least one weighing has no price yet: the value is a lower bound. */
  hasUnpriced: boolean;
};

export function weighingTotals(weighings: readonly WeighingRow[]): WeighingTotals {
  const agg = aggregateWeighings(weighings);
  return { ...agg, hasUnpriced: weighings.some((w) => w.valueEgp === null) };
}

/** A weighing saved on the phone while offline. */
export type PendingWeighing = { clientId: string; materialId: MaterialId; kg: number; source: WeighingSource; scaleId?: string; at: string };

/**
 * What the collector sees: the server's weighings plus the ones still waiting to be sent (de-duplicated by `clientId`;
 * a queued one is priced at the list price on this phone). Returns each row with a `pending` flag.
 */
export function mergeWeighings(
  server: readonly Weighing[],
  pending: readonly PendingWeighing[],
  prices: readonly Pick<MaterialPrice, 'materialId' | 'priceEgpPerKg'>[],
  pickupId = '',
): (Weighing & { pending: boolean })[] {
  const seen = new Set(server.map((w) => w.clientId));
  const queued = pending
    .filter((p) => !seen.has(p.clientId))
    .map((p) => {
      const price = priceOf(prices, p.materialId);
      return { id: `local-${p.clientId}`, pickupId, materialId: p.materialId, kg: roundKg(p.kg), source: p.source, ...(p.scaleId ? { scaleId: p.scaleId } : {}), priceEgpPerKg: price, valueEgp: weighingValue(roundKg(p.kg), price), clientId: p.clientId, at: p.at, pending: true };
    });
  return [...server.map((w) => ({ ...w, pending: false })), ...queued];
}

// ---- Payment ----

/** Text to prefill the "paid to the household" pad with: the weighed value for "get paid", empty (0) for "give for free". */
export function paymentPrefill(mode: PickupMode, totalValueEgp: number | undefined): string {
  return padText(suggestedPaymentEgp({ mode, totalValueEgp }));
}

/** The amount to send on complete; undefined for 0 (free pickup). */
export const paymentInput = (text: string): { paidToHouseholdEgp?: number } => {
  const n = roundEgp(parseAmount(text));
  return n > 0 ? { paidToHouseholdEgp: n } : {};
};

// ---- Earnings ----

/** What the collector keeps: the value of what was collected minus the cash paid to households. */
export const netEarningsEgp = (e: Pick<Earnings, 'valueEgp' | 'paidToHouseholdsEgp'>): number => roundEgp(e.valueEgp - e.paidToHouseholdsEgp);

// ---- Simulated hub scale (mock mode only) ----

export const SIM_SCALE_ID = 'SIM-HUB-01';

/** A believable reading near the estimate, 0.1 kg steps; `n` is the press count so each press differs. Simulation only. */
export function simulatedScaleKg(estimatedKg: number, n: number): number {
  const base = estimatedKg > 0 ? estimatedKg : 2;
  const factors = [0.92, 1.06, 0.97, 1.12, 1.0];
  return Math.min(PICKUP_LIMITS.maxKgPerMaterial, Math.max(0.1, Math.round(base * factors[Math.abs(n) % factors.length] * 10) / 10));
}

// ---- Navigation link ----

/** A link that opens the phone's maps app at the approximate pin: geo: on Android, Apple Maps on iOS, Google Maps on web. */
export function navigationUrl(os: string, lat: number, lng: number, label?: string): string {
  const q = `${lat},${lng}`;
  if (os === 'android') return `geo:${q}?q=${q}${label ? `(${encodeURIComponent(label)})` : ''}`;
  if (os === 'ios') return `maps://?daddr=${q}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}
