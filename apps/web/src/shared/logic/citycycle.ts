import {
  PICKUP_STATUS_ORDER,
  firstName,
  materialLabel,
  pickupStatusLabel,
  type PickupStatus,
  type RecyclingPickup,
} from '@/domain/citycycle';
import type { TimelineStep } from '@/components/requests/timeline';
import { tr } from '@/i18n';

const FUTURE: Record<Exclude<PickupStatus, 'cancelled'>, () => { title: string; detail?: string }> = {
  requested: () => ({ title: tr('الطلب وصل', 'Request received') }),
  accepted: () => ({ title: tr('جامع قبل الطلب', 'A collector accepts'), detail: tr('جامع موثّق من الحي هيعدّي عليك.', 'A verified collector from your district will come by.') }),
  weighed: () => ({ title: tr('الوزن اتسجّل', 'Weighing recorded'), detail: tr('الجامع بيوزن الخامات قدامك.', 'The collector weighs the materials in front of you.') }),
  completed: () => ({ title: tr('اتأكد وخلص', 'Confirmed and done'), detail: tr('بتأكّد الوزن من التطبيق وبيتحسب في تأثيرك.', 'You confirm the weight in the app and it counts toward your impact.') }),
};

/** The vertical timeline of a recycling pickup (same shape the report timeline uses). */
export function buildPickupSteps(pickup: Pick<RecyclingPickup, 'status' | 'timeline'>): TimelineStep[] {
  const lastOf = (s: PickupStatus) => [...pickup.timeline].reverse().find((e) => e.status === s);

  if (pickup.status === 'cancelled') {
    const first = lastOf('requested');
    const cancelled = lastOf('cancelled');
    return [
      { key: 'requested', state: 'done', title: FUTURE.requested().title, detail: first?.note, at: first?.at },
      { key: 'cancelled', state: 'current', title: pickupStatusLabel('cancelled'), detail: cancelled?.note, at: cancelled?.at },
    ];
  }

  const idx = PICKUP_STATUS_ORDER.indexOf(pickup.status);
  return PICKUP_STATUS_ORDER.map((s, i): TimelineStep => {
    const entry = i <= idx ? lastOf(s) : undefined;
    const label = FUTURE[s as Exclude<PickupStatus, 'cancelled'>]();
    if (i < idx || (i === idx && s === 'completed')) return { key: s, state: 'done', title: label.title, detail: entry?.note ?? undefined, at: entry?.at };
    if (i === idx) return { key: s, state: 'current', title: label.title, detail: entry?.note ?? label.detail, at: entry?.at };
    return { key: s, state: 'future', title: label.title, detail: label.detail };
  });
}

/** "بلاستيك، ورق + ١" for a card title: the first two materials and how many more. */
export function materialsSummary(items: readonly { materialId: Parameters<typeof materialLabel>[0] }[], plus: (n: number) => string): string {
  const names = items.slice(0, 2).map((i) => materialLabel(i.materialId));
  const more = items.length - names.length;
  return more > 0 ? `${names.join(tr('، ', ', '))} ${plus(more)}` : names.join(tr('، ', ', '));
}

/** What a household may see of the collector: the first name only. */
export const collectorDisplayName = (p: Pick<RecyclingPickup, 'collectorName'>): string | undefined => (p.collectorName ? firstName(p.collectorName) : undefined);

export type PickupListFilter = 'all' | 'reports' | 'services' | 'open' | 'fixed' | 'recycling';

/** Does a recycling pickup belong under this "طلباتي" chip? Open = still moving, fixed = done or cancelled. */
export function pickupInFilter(status: PickupStatus, filter: PickupListFilter): boolean {
  switch (filter) {
    case 'all':
    case 'recycling':
      return true;
    case 'open':
      return status === 'requested' || status === 'accepted' || status === 'weighed';
    case 'fixed':
      return status === 'completed' || status === 'cancelled';
    default:
      return false; // reports and services chips never show pickups
  }
}
