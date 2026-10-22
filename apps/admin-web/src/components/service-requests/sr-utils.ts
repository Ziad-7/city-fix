import type { AdminServiceRequest } from '@/domain/admin-types';
import type { ServiceType } from '@/domain/types';
import { PAYMENT_LABEL_AR } from '@/lib/text';

export const CAP = 6;
const DAY_MS = 86_400_000;

export type TypeChip = 'all' | ServiceType | 'today';

export interface SrFilters {
  q: string;
  chip: TypeChip;
  payment: string;
  status: string;
}

export const EMPTY_FILTERS: SrFilters = { q: '', chip: 'all', payment: '', status: '' };

/** YYYY-MM-DD in Cairo time. */
export function cairoToday(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date(now));
}

export function isDone(r: Pick<AdminServiceRequest, 'status'>): boolean {
  return r.status === 'resolved' || r.status === 'closed';
}

export function paymentLabel(r: AdminServiceRequest): string {
  const method = r.details.payment;
  if (!method) return 'مجاني'; // free district services (tree_maintenance) carry no payment
  const base = PAYMENT_LABEL_AR[method] ?? method;
  if (method === 'cash') return base;
  if (r.paid) return `${base} · مدفوع`;
  return method === 'wallet' ? base : `${base} · مستنية الدفع`;
}

/** Chip counts are over the unfiltered list. */
export function chipCounts(list: AdminServiceRequest[], now = Date.now()) {
  const today = cairoToday(now);
  return {
    all: list.length,
    bulky_waste: list.filter((r) => r.serviceType === 'bulky_waste').length,
    tree_maintenance: list.filter((r) => r.serviceType === 'tree_maintenance').length,
    today: list.filter((r) => r.details.day === today).length,
  };
}

export function filterRequests(list: AdminServiceRequest[], f: SrFilters, now = Date.now()): AdminServiceRequest[] {
  const today = cairoToday(now);
  const q = f.q.trim().toLowerCase();
  return list.filter((r) => {
    if (f.chip === 'today' && r.details.day !== today) return false;
    if (f.chip === 'bulky_waste' && r.serviceType !== 'bulky_waste') return false;
    if (f.chip === 'tree_maintenance' && r.serviceType !== 'tree_maintenance') return false;
    if (f.payment && r.details.payment !== f.payment) return false;
    if (f.status) {
      // "وصل" also covers triaged; "اتصلّح" also covers closed
      const s = r.status === 'triaged' ? 'received' : r.status === 'closed' ? 'resolved' : r.status;
      if (s !== f.status) return false;
    }
    if (q && !(r.id.toLowerCase().includes(q) || r.location.address.toLowerCase().includes(q))) return false;
    return true;
  });
}

function resolvedAt(r: AdminServiceRequest): number | null {
  if (!isDone(r)) return null;
  const e = [...r.timeline].reverse().find((t) => t.status === 'resolved' || t.status === 'closed');
  return e ? new Date(e.at).getTime() : null;
}

export function computeKpis(list: AdminServiceRequest[], now = Date.now()) {
  const today = cairoToday(now);
  const todays = list.filter((r) => r.details.day === today);
  const doneIn = (from: number, to: number) =>
    list.filter((r) => {
      const t = resolvedAt(r);
      return t !== null && t > from && t <= to;
    }).length;
  return {
    fresh: list.filter((r) => r.status === 'received').length,
    today: todays.length,
    todayInProgress: todays.filter((r) => r.status === 'in_progress').length,
    awaitingPayment: list.filter(
      (r) => (r.details.payment === 'fawry' || r.details.payment === 'instapay') && !r.paid && !isDone(r),
    ).length,
    doneThisWeek: doneIn(now - 7 * DAY_MS, now),
    doneLastWeek: doneIn(now - 14 * DAY_MS, now - 7 * DAY_MS),
  };
}

/** Requests booked in the same day+slot that are not finished. */
export function bookedCount(list: AdminServiceRequest[], day: string, slot: string): number {
  return list.filter((r) => r.details.day === day && r.details.slot === slot && !isDone(r)).length;
}

export const TRUCKS: Record<ServiceType, string[]> = {
  bulky_waste: ['عربية نظافة 7 · 3 أفراد', 'عربية نظافة 4', 'فريق مخلفات البناء 1'],
  tree_maintenance: ['فريق الحدائق 1'],
};
