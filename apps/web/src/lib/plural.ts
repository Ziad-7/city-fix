import { toArabicDigits } from '@/utils/digits';

/** "مفيش بلاغات" / "بلاغ واحد" / "بلاغين" / "٥ بلاغات" / "١٢ بلاغ": the Arabic count forms, never "١ بلاغات". */
export function reportsCountAr(n: number): string {
  if (n === 0) return 'مفيش بلاغات';
  if (n === 1) return 'بلاغ واحد';
  if (n === 2) return 'بلاغين';
  return `${toArabicDigits(n)} ${n <= 10 ? 'بلاغات' : 'بلاغ'}`;
}
