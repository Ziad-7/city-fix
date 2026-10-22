'use client';

import type { PickupStatus } from '@/domain/citycycle';
import { pickupStatusLabel } from '@/domain/citycycle';
import { useLang } from '@/i18n';

/** Pickup stages share the colours of the report chips: waiting = grey, accepted = blue, weighed = gold, done = green. */
const CHIP_CLASS: Record<PickupStatus, string> = {
  requested: 'ftc-chip--received',
  accepted: 'ftc-chip--assigned',
  weighed: 'ftc-chip--progress',
  completed: 'ftc-chip--resolved',
  cancelled: 'ftc-chip--received',
};

export function PickupStatusChip({ status }: { status: PickupStatus }) {
  useLang();
  return <span className={`ftc-chip ${CHIP_CLASS[status]}`}>{pickupStatusLabel(status)}</span>;
}
