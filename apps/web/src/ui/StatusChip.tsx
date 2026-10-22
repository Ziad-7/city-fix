import { STATUS_LABEL_AR, type IncidentStatus } from '@/domain/types';
import { statusLabel, useTr } from '@/i18n';

const CHIP_CLASS: Record<IncidentStatus, string> = {
  received: 'ftc-chip--received',
  triaged: 'ftc-chip--received',
  assigned: 'ftc-chip--assigned',
  in_progress: 'ftc-chip--progress',
  resolved: 'ftc-chip--resolved',
  closed: 'ftc-chip--received',
};

/** Pin and legend colours: the same status language as the chips (apps/mobile StatusChip). */
export const STATUS_COLOR: Record<IncidentStatus, string> = {
  received: '#3D4A50',
  triaged: '#3D4A50',
  assigned: '#1E4F87',
  in_progress: '#7A5A00',
  resolved: '#1F6B33',
  closed: '#3D4A50',
};
export const CRITICAL_COLOR = '#A50E25';

/** Pill with a dot and an Arabic word: status is never colour-only. */
export function StatusChip({ status }: { status: IncidentStatus }) {
  useTr();
  return <span className={`ftc-chip ${CHIP_CLASS[status]}`}>{statusLabel(status, STATUS_LABEL_AR[status])}</span>;
}

/** Status chip, plus the red "خطر" chip first when the incident is critical. */
export function StatusChips({ status, critical }: { status: IncidentStatus; critical?: boolean }) {
  const tr = useTr();
  return (
    <>
      {critical ? <span className="ftc-chip ftc-chip--critical">{tr('خطر', 'Danger')}</span> : null}
      <StatusChip status={status} />
    </>
  );
}

export function DangerTag() {
  const tr = useTr();
  return <span className="ftc-tag-danger">{tr('خطر', 'Danger')}</span>;
}
