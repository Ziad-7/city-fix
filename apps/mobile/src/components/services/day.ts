import { WEEKDAYS_AR, formatDateAr } from '@/utils/time';
import { toArabicDigits } from '@/utils/digits';

/** Parses an ISO day (YYYY-MM-DD) as a local date, so the weekday never shifts with the time zone. */
export function parseIsoDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** { weekday: "الأربع", dayOfMonth: "٢٢" } for the day picker tiles. */
export function dayParts(day: string): { weekday: string; dayOfMonth: string } {
  const d = parseIsoDay(day);
  return { weekday: WEEKDAYS_AR[d.getDay()], dayOfMonth: toArabicDigits(d.getDate()) };
}

/** "الأربع ٢٢ أكتوبر" */
export function dayLabel(day: string): string {
  const d = parseIsoDay(day);
  return `${WEEKDAYS_AR[d.getDay()]} ${formatDateAr(d)}`;
}
