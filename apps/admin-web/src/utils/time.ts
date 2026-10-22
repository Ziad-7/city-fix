import { usePrefs } from '@/store/usePrefs';
import { toArabicDigits } from './digits';

const isEn = (): boolean => usePrefs.getState().lang === 'en';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Arabic (Egyptian) relative time: "دلوقتي", "من ٥ دقايق", "من ساعتين", "امبارح", "من ٣ أيام". */
export function relativeTimeAr(iso: string | number | Date, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MIN) return 'دلوقتي';
  if (diff < HOUR) {
    const m = Math.floor(diff / MIN);
    if (m === 1) return 'من دقيقة';
    if (m === 2) return 'من دقيقتين';
    return `من ${toArabicDigits(m)} ${m <= 10 ? 'دقايق' : 'دقيقة'}`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    if (h === 1) return 'من ساعة';
    if (h === 2) return 'من ساعتين';
    return `من ${toArabicDigits(h)} ${h <= 10 ? 'ساعات' : 'ساعة'}`;
  }
  const d = Math.floor(diff / DAY);
  if (d === 1) return 'امبارح';
  if (d === 2) return 'من يومين';
  if (d <= 10) return `من ${toArabicDigits(d)} أيام`;
  if (d < 30) return `من ${toArabicDigits(d)} يوم`;
  const mo = Math.floor(d / 30);
  if (mo === 1) return 'من شهر';
  if (mo === 2) return 'من شهرين';
  return `من ${toArabicDigits(mo)} شهور`;
}

/** "١٠:١٢ ص" */
export function formatTimeAr(iso: string | number | Date): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${toArabicDigits(h12)}:${toArabicDigits(String(m).padStart(2, '0'))} ${h < 12 ? 'ص' : 'م'}`;
}

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const WEEKDAYS_AR = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];

/** "٢٢ أكتوبر" */
export function formatDateAr(iso: string | number | Date): string {
  const d = new Date(iso);
  return `${toArabicDigits(d.getDate())} ${MONTHS[d.getMonth()]}`;
}

/** "النهارده ١٠:١٢ ص" or "٢٠ أكتوبر · ١٠:١٢ ص" */
export function formatDateTimeAr(iso: string | number | Date, now: number = Date.now()): string {
  const d = new Date(iso);
  const n = new Date(now);
  const same = d.toDateString() === n.toDateString();
  return same ? `النهارده ${formatTimeAr(d)}` : `${formatDateAr(d)} · ${formatTimeAr(d)}`;
}

/** Greeting by local hour: before noon "صباح الفل", otherwise "مساء الفل". */
export function greetingAr(now: Date = new Date()): string {
  return now.getHours() < 12 ? 'صباح الفل' : 'مساء الفل';
}

/** Whole days between two timestamps (>= 0). */
export function daysBetween(fromIso: string | number | Date, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / DAY));
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** English relative time: "just now", "5 min ago", "2 hours ago", "yesterday", "3 days ago". */
export function relativeTimeEn(iso: string | number | Date, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MIN) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const d = Math.floor(diff / DAY);
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  const mo = Math.floor(d / 30);
  return mo === 1 ? '1 month ago' : `${mo} months ago`;
}

/** "10:12 AM" */
export function formatTimeEn(iso: string | number | Date): string {
  const d = new Date(iso);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "22 Oct" */
export function formatDateEn(iso: string | number | Date): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]}`;
}

// Current-language versions: use these in UI.
export const relativeTime = (iso: string | number | Date, now?: number): string => (isEn() ? relativeTimeEn(iso, now) : relativeTimeAr(iso, now));
export const formatTime = (iso: string | number | Date): string => (isEn() ? formatTimeEn(iso) : formatTimeAr(iso));
export const formatDate = (iso: string | number | Date): string => (isEn() ? formatDateEn(iso) : formatDateAr(iso));
/** Weekday name by Date#getDay() index. */
export const weekdayName = (index: number): string => (isEn() ? WEEKDAYS_EN[index] : WEEKDAYS_AR[index]);
/** "Today 10:12 AM" or "20 Oct · 10:12 AM" in English; formatDateTimeAr in Arabic. */
export function formatDateTime(iso: string | number | Date, now: number = Date.now()): string {
  if (!isEn()) return formatDateTimeAr(iso, now);
  const d = new Date(iso);
  const same = d.toDateString() === new Date(now).toDateString();
  return same ? `Today ${formatTimeEn(d)}` : `${formatDateEn(d)} · ${formatTimeEn(d)}`;
}

/** "Good morning" / "Good evening" in English; greetingAr in Arabic. */
export const greeting = (now: Date = new Date()): string => (isEn() ? (now.getHours() < 12 ? 'Good morning' : 'Good evening') : greetingAr(now));
