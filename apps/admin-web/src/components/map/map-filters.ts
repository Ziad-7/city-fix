import type { AdminIncident } from '@/domain/admin-types';
import { pinKind, type PinKind } from './map-utils';

export type Period = '7d' | 'today' | '30d' | 'custom';

export const PERIOD_LABEL: Record<Period, string> = {
  '7d': 'آخر 7 أيام',
  today: 'النهارده',
  '30d': 'آخر 30 يوم',
  custom: 'في الفترة دي',
};

export const PIN_KINDS: PinKind[] = ['received', 'assigned', 'progress', 'resolved', 'critical'];

const OPEN = ['received', 'triaged', 'assigned', 'in_progress'];
const DAY_MS = 86_400_000;

export function isOpenIncident(i: Pick<AdminIncident, 'status'>): boolean {
  return OPEN.includes(i.status);
}

/** YYYY-MM-DD in Cairo time. */
export function cairoDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(ms));
}

/**
 * All open incidents are always shown; resolved/closed ones only when
 * `updatedAt` falls in the selected period.
 */
export function inPeriod(
  inc: Pick<AdminIncident, 'status' | 'updatedAt'>,
  period: Period,
  from: string,
  to: string,
  now = Date.now(),
): boolean {
  if (isOpenIncident(inc)) return true;
  const t = new Date(inc.updatedAt).getTime();
  switch (period) {
    case 'today':
      return cairoDay(t) === cairoDay(now);
    case '7d':
      return t >= now - 7 * DAY_MS;
    case '30d':
      return t >= now - 30 * DAY_MS;
    case 'custom': {
      const d = cairoDay(t);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
  }
}

export function countByKind(incidents: AdminIncident[]): Record<PinKind, number> {
  const counts: Record<PinKind, number> = { received: 0, assigned: 0, progress: 0, resolved: 0, critical: 0 };
  incidents.forEach((i) => {
    counts[pinKind(i)]++;
  });
  return counts;
}

/** Case-insensitive match on id or street address. */
export function searchIncidents(incidents: AdminIncident[], q: string): AdminIncident[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return incidents.filter(
    (i) => i.id.toLowerCase().includes(needle) || i.location.address.toLowerCase().includes(needle),
  );
}
