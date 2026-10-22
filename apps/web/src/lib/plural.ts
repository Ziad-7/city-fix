import { getLang } from '@/i18n';
import { toArabicDigits } from '@/utils/digits';

/** "مفيش بلاغات" / "بلاغ واحد" / "بلاغين" / "٥ بلاغات" / "١٢ بلاغ": the Arabic count forms, never "١ بلاغات". */
export function reportsCountAr(n: number): string {
  if (n === 0) return 'مفيش بلاغات';
  if (n === 1) return 'بلاغ واحد';
  if (n === 2) return 'بلاغين';
  return `${toArabicDigits(n)} ${n <= 10 ? 'بلاغات' : 'بلاغ'}`;
}

/** "No reports" / "1 report" / "5 reports". */
export function reportsCountEn(n: number): string {
  if (n === 0) return 'No reports';
  return n === 1 ? '1 report' : `${n} reports`;
}

/** Count in the current language (call during the render of a component that used useLang/useTr). */
export const reportsCount = (n: number): string => (getLang() === 'en' ? reportsCountEn(n) : reportsCountAr(n));
