import type { IncidentStatus } from '@/domain/types';
import type { WorkOrderStatus } from '@/domain/admin-types';
import { priorityLevel, PRIORITY_LABEL_AR } from '@/logic/priority';
import { STATUS_LABEL_AR } from '@/domain/types';

const WORK_ORDER_LABEL_AR: Record<WorkOrderStatus, string> = {
  open: 'اتسلّم',
  assigned: 'اتوزّع',
  in_progress: 'شغالين عليه',
  done: 'اتحلّت',
};

export type StatusChipProps =
  | { kind: 'incident'; status: IncidentStatus }
  | { kind: 'workorder'; status: WorkOrderStatus }
  | { kind: 'critical' }
  | { kind: 'priority'; score: number; levelOnly?: boolean };

/**
 * Map status/priority to tone (CSS class suffix).
 * Exported so tests can verify the mapping.
 */
export const STATUS_CHIP: Record<string, { tone: string; label: string }> = {
  'incident-received': { tone: 'received', label: STATUS_LABEL_AR.received },
  'incident-triaged': { tone: 'received', label: STATUS_LABEL_AR.triaged },
  'incident-assigned': { tone: 'assigned', label: STATUS_LABEL_AR.assigned },
  'incident-in_progress': { tone: 'progress', label: STATUS_LABEL_AR.in_progress },
  'incident-resolved': { tone: 'resolved', label: STATUS_LABEL_AR.resolved },
  'incident-closed': { tone: 'resolved', label: STATUS_LABEL_AR.closed },
  'workorder-open': { tone: 'received', label: WORK_ORDER_LABEL_AR.open },
  'workorder-assigned': { tone: 'assigned', label: WORK_ORDER_LABEL_AR.assigned },
  'workorder-in_progress': { tone: 'progress', label: WORK_ORDER_LABEL_AR.in_progress },
  'workorder-done': { tone: 'resolved', label: WORK_ORDER_LABEL_AR.done },
  'critical': { tone: 'critical', label: 'خطر' },
};

export function StatusChip(props: StatusChipProps) {
  let tone: string;
  let label: string;

  if (props.kind === 'critical') {
    tone = 'critical';
    label = 'خطر';
  } else if (props.kind === 'incident') {
    const key = `incident-${props.status}`;
    const mapping = STATUS_CHIP[key];
    tone = mapping.tone;
    label = mapping.label;
  } else if (props.kind === 'workorder') {
    const key = `workorder-${props.status}`;
    const mapping = STATUS_CHIP[key];
    tone = mapping.tone;
    label = mapping.label;
  } else {
    // priority
    const level = priorityLevel(props.score);
    if (props.levelOnly) {
      label = PRIORITY_LABEL_AR[level];
    } else {
      const scoreStr = props.score.toString();
      label = `${PRIORITY_LABEL_AR[level]} · ${scoreStr}`;
    }

    if (level === 'critical') tone = 'critical';
    else if (level === 'high') tone = 'progress';
    else tone = 'received';
  }

  return <span className={`ftc-chip ftc-chip--${tone}`}>{label}</span>;
}
