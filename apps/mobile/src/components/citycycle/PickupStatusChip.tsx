import type { PickupStatus } from '@/domain/citycycle';
import { pickupStatusLabel } from '@/domain/citycycle';
import { StatusChip, type ChipKind } from '@/components/ui';
import { useLang } from '@/i18n';

/** Pickup stages share the colours of the report chips: waiting = grey, accepted = blue, weighed = gold, done = green. */
const KIND: Record<PickupStatus, ChipKind> = {
  requested: 'received',
  accepted: 'assigned',
  weighed: 'in_progress',
  completed: 'resolved',
  cancelled: 'closed',
};

export function PickupStatusChip({ status }: { status: PickupStatus }) {
  useLang();
  return <StatusChip status={KIND[status]} label={pickupStatusLabel(status)} />;
}
