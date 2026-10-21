import Link from 'next/link';
import { getCategory } from '@/domain/categories';
import { SERVICES } from '@/domain/services-catalog';
import { isCriticalIncident } from '@/logic/priority';
import type { RequestItem } from '@/store';
import { relativeTimeAr } from '@/utils/time';
import { StatusChips } from './StatusChip';
import { Thumb } from './Thumb';

export const itemIcon = (item: RequestItem) =>
  item.kind === 'report' ? getCategory(item.categoryId).icon : (SERVICES.find((s) => s.serviceType === item.request.serviceType)?.icon ?? 'clipboard');

export const itemPhoto = (item: RequestItem) => (item.kind === 'report' ? item.report.photoUris[0] : undefined);

export const itemCritical = (item: RequestItem) => item.kind === 'report' && !!item.incident && isCriticalIncident(item.incident);

/** Compact request row (home "آخر التحديثات"). */
export function RequestRow({ item }: { item: RequestItem }) {
  return (
    <Link className="w-rowcard" href={`/requests/${item.id}`} data-testid={`request-${item.id}`}>
      <Thumb uri={itemPhoto(item)} icon={itemIcon(item)} />
      <span className="w-grow">
        <span className="w-t">{item.title}</span>
        <span className="w-m"><bdi dir="ltr">#{item.id}</bdi> · {relativeTimeAr(item.createdAt)}</span>
      </span>
      <span className="a-chips"><StatusChips status={item.status} critical={itemCritical(item)} /></span>
    </Link>
  );
}
