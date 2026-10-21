import { toArabicDigits } from '@/utils/digits';

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
