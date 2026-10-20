import type { CatalogService, ServiceGroup } from '@/domain/services-catalog';

/** Loosens Arabic spelling so "اشجار" finds "أشجار" and "ة" finds "ه". */
export function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase();
}

/** Search + group filter for the CityServe catalog. */
export function filterServices(list: CatalogService[], query: string, group: ServiceGroup | 'all'): CatalogService[] {
  const q = normalizeArabic(query);
  return list.filter((s) => {
    if (group !== 'all' && s.group !== group) return false;
    if (!q) return true;
    return normalizeArabic(`${s.titleAr} ${s.subtitleAr}`).includes(q);
  });
}
