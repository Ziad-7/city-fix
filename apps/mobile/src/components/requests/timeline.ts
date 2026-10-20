import type { IncidentStatus, TimelineEntry } from '@/domain/types';

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

const FUTURE_REPORT: Partial<Record<IncidentStatus, { title: string; detail?: string }>> = {
  triaged: { title: 'اتصنّف' },
  assigned: { title: 'اتحوّل للجهة المسؤولة' },
  in_progress: { title: 'الفريق في الموقع' },
  resolved: { title: 'اتصلّحت', detail: 'هنبلّغك أول ما تتصلّح، وتقدر تفتح البلاغ تاني لو المشكلة لسه موجودة.' },
};

const FUTURE_SERVICE: Partial<Record<IncidentStatus, { title: string; detail?: string }>> = {
  triaged: { title: 'مراجعة الطلب' },
  assigned: { title: 'تحديد الفريق والميعاد' },
  in_progress: { title: 'العربية في الطريق' },
  resolved: { title: 'اتنفّذ الطلب', detail: 'لو فيه أي مشكلة في التنفيذ تقدر تتواصل مع خدمات الحي.' },
};

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
  const labels = kind === 'report' ? FUTURE_REPORT : FUTURE_SERVICE;
  for (const s of ORDER.slice(reached + 1)) {
    const l = labels[s];
    if (l) steps.push({ key: `future-${s}`, state: 'future', title: l.title, detail: l.detail });
  }
  return steps;
}
