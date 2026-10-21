import type { IncidentStatus, TimelineEntry } from '@/domain/types';
import { tr } from '@/i18n';

export type StepState = 'done' | 'current' | 'future';

export type TimelineStep = {
  key: string;
  state: StepState;
  title: string;
  /** Actor or explanation under the title. */
  detail?: string;
  /** ISO timestamp, only for steps that already happened. */
  at?: string;
};

const ORDER: IncidentStatus[] = ['received', 'triaged', 'assigned', 'in_progress', 'resolved'];

type FutureLabels = Partial<Record<IncidentStatus, { title: string; detail?: string }>>;

// Functions, so the language is read when the steps are built (the screen rebuilds them on a language switch).
const futureReport = (): FutureLabels => ({
  triaged: { title: tr('اتصنّف', 'Reviewed') },
  assigned: { title: tr('اتحوّل للجهة المسؤولة', 'Sent to the responsible team') },
  in_progress: { title: tr('الفريق في الموقع', 'The team is on site') },
  resolved: {
    title: tr('اتصلّحت', 'Fixed'),
    detail: tr('هنبلّغك أول ما تتصلّح، وتقدر تفتح البلاغ تاني لو المشكلة لسه موجودة.', "We'll tell you as soon as it's fixed. You can reopen the report if the problem is still there."),
  },
});

const futureService = (): FutureLabels => ({
  triaged: { title: tr('مراجعة الطلب', 'Request review') },
  assigned: { title: tr('تحديد الفريق والميعاد', 'Team and time set') },
  in_progress: { title: tr('العربية في الطريق', 'The truck is on the way') },
  resolved: {
    title: tr('اتنفّذ الطلب', 'Request completed'),
    detail: tr('لو فيه أي مشكلة في التنفيذ تقدر تتواصل مع خدمات الحي.', 'If anything went wrong, you can contact District Services.'),
  },
});

/**
 * Maps a request timeline to display steps: every recorded entry is "done", except the latest
 * one of a still-open request, which is "current"; the stages that have not happened yet follow as "future".
 */
export function buildTimelineSteps(
  entries: TimelineEntry[],
  kind: 'report' | 'service',
  status: IncidentStatus,
): TimelineStep[] {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at));
  const finished = status === 'resolved' || status === 'closed';
  const steps: TimelineStep[] = sorted.map((e, i) => ({
    key: `${e.status}-${i}`,
    state: i === sorted.length - 1 && !finished ? 'current' : 'done',
    title: e.note,
    detail: e.actor,
    at: e.at,
  }));
  if (finished) return steps;

  const last = sorted.length ? sorted[sorted.length - 1].status : status;
  const reached = ORDER.indexOf(last);
  const labels = kind === 'report' ? futureReport() : futureService();
  for (const s of ORDER.slice(reached + 1)) {
    const l = labels[s];
    if (l) steps.push({ key: `future-${s}`, state: 'future', title: l.title, detail: l.detail });
  }
  return steps;
}
