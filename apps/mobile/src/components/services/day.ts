import { formatDate, weekdayName } from '@/utils/time';
import { localDigits } from '@/utils/digits';

/** Parses an ISO day (YYYY-MM-DD) as a local date, so the weekday never shifts with the time zone. */
export function parseIsoDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** { weekday: "الأربع", dayOfMonth: "٢٢" } (Arabic) or { "Wednesday", "22" } (English) for the day picker tiles. */
export function dayParts(day: string): { weekday: string; dayOfMonth: string } {
  const d = parseIsoDay(day);
  return { weekday: weekdayName(d.getDay()), dayOfMonth: localDigits(d.getDate()) };
}

/** "الأربع ٢٢ أكتوبر" / "Wednesday 22 Oct" */
export function dayLabel(day: string): string {
  const d = parseIsoDay(day);
  return `${weekdayName(d.getDay())} ${formatDate(d)}`;
}
