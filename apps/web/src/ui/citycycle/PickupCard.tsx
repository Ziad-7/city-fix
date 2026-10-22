'use client';

import Link from 'next/link';
import { dayText, slotLabel } from '@/components/requests/labels';
import { estimateValue, formatEgp, formatKg, sumKg, type RecyclingPickup } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { materialsSummary } from '@/logic/citycycle';
import { useRecycling } from '@/store';
import { localDigits } from '@/utils/digits';
import { relativeTime } from '@/utils/time';
import { Icon } from '../Icon';
import { Thumb } from '../Thumb';
import { PickupStatusChip } from './PickupStatusChip';

/** List row in My requests for a recycling pickup (same row layout as a report or a service). */
export function PickupCard({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  const title = `${tr('جمع تدوير', 'Recycling pickup')} · ${materialsSummary(pickup.items, (n) => tr(`+${localDigits(n)}`, `+${n}`))}`;
  const total = pickup.totalKg ?? sumKg(pickup.items);
  const prices = useRecycling((s) => s.prices);
  const pricesReady = useRecycling((s) => s.pricesStatus === 'ready');
  const partial = pricesReady && pickup.totalValueEgp === undefined && estimateValue(pickup.items, prices).unpriced.length > 0;
  const value = pickup.totalValueEgp ?? pickup.estimatedValueEgp;
  return (
    <Link className="w-rowcard q-row" href={`/requests/${pickup.id}`} data-testid={`request-${pickup.id}`} aria-label={title}>
      <Thumb icon="recycle" />
      <span className="w-grow">
        <span className="w-t">{title}<span className="q-kind">{tr('تدوير', 'Recycling')}</span></span>
        <span className="w-m"><bdi dir="ltr">#{pickup.id}</bdi> · {relativeTime(pickup.createdAt)}</span>
      </span>
      <span className="dep">
        <b>{tr('الميعاد', 'Scheduled')}</b>
        {dayText(pickup.day)} · {slotLabel(pickup.slot)}
        <span className="cc-pickup-kg">
          {pickup.totalKg !== undefined ? tr('الوزن الفعلي', 'Weighed') : tr('تقريبًا', 'About')} {formatKg(total)}
          {pickup.mode === 'paid' && value !== undefined ? ` · ${partial ? tr('من ', 'From ') : ''}${formatEgp(value)}` : ''}
        </span>
      </span>
      <span className="stc a-chips"><PickupStatusChip status={pickup.status} /></span>
      <span className="go"><Icon name="chevron" size={20} /></span>
    </Link>
  );
}
