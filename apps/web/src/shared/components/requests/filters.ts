import { isOpenStatus } from '@/domain/types';
import type { RequestItem } from '@/store';

export type RequestFilter = 'all' | 'reports' | 'services' | 'open' | 'fixed';

export const REQUEST_FILTERS: { id: RequestFilter; labelAr: string }[] = [
  { id: 'all', labelAr: 'الكل' },
  { id: 'reports', labelAr: 'بلاغات' },
  { id: 'services', labelAr: 'خدمات' },
  { id: 'open', labelAr: 'مفتوحة' },
  { id: 'fixed', labelAr: 'اتصلّحت' },
];

type Filterable = Pick<RequestItem, 'kind' | 'status'>;

/** Keeps the order of `items` (already newest first). */
export function filterRequests<T extends Filterable>(items: T[], filter: RequestFilter): T[] {
  switch (filter) {
    case 'reports':
      return items.filter((i) => i.kind === 'report');
    case 'services':
      return items.filter((i) => i.kind === 'service');
    case 'open':
      return items.filter((i) => isOpenStatus(i.status));
    case 'fixed':
      return items.filter((i) => !isOpenStatus(i.status));
    default:
      return items;
  }
}
