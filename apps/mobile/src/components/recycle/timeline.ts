import { PICKUP_STATUS_ORDER, type PickupMode, type PickupStatus } from '@/domain/citycycle';
import type { TimelineEntry } from '@/domain/types';
import { tr } from '@/i18n';
import type { TimelineStep } from '@/components/requests/timeline';

type Future = { title: string; detail?: string };

// Functions, so the language is read when the steps are built.
const futureStep = (status: PickupStatus, mode: PickupMode): Future | null => {
  switch (status) {
    case 'accepted':
      return { title: tr('جامع يقبل طلبك', 'A collector accepts your request'), detail: tr('هنبلّغك أول ما حد يقبله.', "We'll tell you as soon as one does.") };
    case 'weighed':
      return { title: tr('الجامع يعدّي عليك ويوزن الخامات', 'The collector comes and weighs your materials') };
    case 'completed':
      return {
        title: tr('تسلّم الخامات', 'Handover done'),
        detail: mode === 'paid' ? tr('الجامع بيدفعلك كاش على الوزن الفعلي.', 'The collector pays you cash for the weighed amount.') : tr('بتتسلّم مجانًا. تسلم إيدك!', 'You give them for free. Thank you!'),
      };
    default:
      return null;
  }
};

/**
 * Timeline of a pickup: every recorded entry is "done" except the latest one of an active pickup ("current");
 * the stages that have not happened yet follow as "future" (nothing after a cancel or a completion).
 */
export function buildPickupSteps(p: { timeline: TimelineEntry[]; status: PickupStatus; mode: PickupMode }): TimelineStep[] {
  const sorted = [...p.timeline].sort((a, b) => a.at.localeCompare(b.at));
  const finished = p.status === 'completed' || p.status === 'cancelled';
  const steps: TimelineStep[] = sorted.map((e, i) => ({
    key: `${e.status}-${i}`,
    state: i === sorted.length - 1 && !finished ? 'current' : 'done',
    title: e.note,
    detail: e.actor,
    at: e.at,
  }));
  if (finished) return steps;
  const reached = PICKUP_STATUS_ORDER.indexOf(p.status);
  for (const s of PICKUP_STATUS_ORDER.slice(reached + 1)) {
    const f = futureStep(s, p.mode);
    if (f) steps.push({ key: `future-${s}`, state: 'future', title: f.title, detail: f.detail });
  }
  return steps;
}
