import { getLang } from '@/i18n';
import { toArabicDigits } from '@/utils/digits';
import { formatDistanceAr } from '@/utils/geo';

/** "بلاغ كمان" / "بلاغين كمان" / "٧ بلاغات كمان" for the remaining-reports line. */
export function moreReportsAr(n: number): string {
  if (n === 1) return 'بلاغ كمان';
  if (n === 2) return 'بلاغين كمان';
  if (n <= 10) return `${toArabicDigits(n)} بلاغات كمان`;
  return `${toArabicDigits(n)} بلاغ كمان`;
}

/** "بلّغ عنها ٦ مواطنين" */
export function reportedByAr(n: number): string {
  if (n <= 1) return 'بلّغ عنها مواطن';
  if (n === 2) return 'بلّغ عنها مواطنين';
  if (n <= 10) return `بلّغ عنها ${toArabicDigits(n)} مواطنين`;
  return `بلّغ عنها ${toArabicDigits(n)} مواطن`;
}

/** "١٢ جار قالوا أنا كمان" */
export function neighboursAr(n: number): string {
  if (n <= 0) return 'أول واحد يقول أنا كمان';
  if (n === 1) return 'جار قال أنا كمان';
  if (n === 2) return 'جارين قالوا أنا كمان';
  if (n <= 10) return `${toArabicDigits(n)} جيران قالوا أنا كمان`;
  return `${toArabicDigits(n)} جار قالوا أنا كمان`;
}

// ---- Current-language versions (use these in UI; the *Ar ones above are the Arabic wording) ----

/** "1 more report" / "7 more reports" (Arabic: see moreReportsAr). */
export function moreReports(n: number): string {
  if (getLang() !== 'en') return moreReportsAr(n);
  return n === 1 ? '1 more report' : `${n} more reports`;
}

const ME_TOO = 'Me\u00a0too';

/** "Reported by 6 people" */
export function reportedBy(n: number): string {
  if (getLang() !== 'en') return reportedByAr(n);
  return n <= 1 ? 'Reported by 1 person' : `Reported by ${n} people`;
}

/** "12 neighbours said Me too" ("Me too" is kept on one line: it is the button's name). */
export function neighbours(n: number): string {
  if (getLang() !== 'en') return neighboursAr(n);
  if (n <= 0) return `Be the first to say ${ME_TOO}`;
  return n === 1 ? `1 neighbour said ${ME_TOO}` : `${n} neighbours said ${ME_TOO}`;
}

/** "40 m" / "1.2 km" in English, "٤٠ متر" / "١٫٢ كم" in Arabic. */
export function distanceLabel(m: number): string {
  if (getLang() !== 'en') return formatDistanceAr(m);
  if (m < 1000) return `${Math.max(5, Math.round(m / 5) * 5)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
