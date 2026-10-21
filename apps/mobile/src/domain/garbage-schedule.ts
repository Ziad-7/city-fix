import { toArabicDigits } from '@/utils/digits';

export type WeekdayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type GarbageSchedule = {
  district: string;
  /** Collection days of the week. */
  days: WeekdayCode[];
  /** Pickup window, e.g. "٨ م – ١١ م". */
  window: string;
  note?: string;
};

/** Index = Date#getDay(). */
export const WEEKDAY_CODES: WeekdayCode[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const WEEKDAY_NAME_AR: Record<WeekdayCode, string> = {
  sun: 'الحد',
  mon: 'الاتنين',
  tue: 'التلات',
  wed: 'الأربع',
  thu: 'الخميس',
  fri: 'الجمعة',
  sat: 'السبت',
};

const WINDOW_EVENING = '٨ م – ١١ م';

/** Static demo data (the backend endpoint is a proposal, see docs/api-contract.md). */
export const GARBAGE_SCHEDULES: GarbageSchedule[] = [
  { district: 'مدينة نصر أول', days: ['sun', 'tue', 'thu'], window: WINDOW_EVENING },
  { district: 'مدينة نصر ثان', days: ['mon', 'wed', 'sat'], window: WINDOW_EVENING },
  { district: 'مصر الجديدة', days: ['sun', 'tue', 'thu'], window: '٧ م – ١٠ م' },
  { district: 'المعادي', days: ['mon', 'wed', 'sat'], window: '٩ م – ١٢ ص' },
  { district: 'عين شمس', days: ['sun', 'tue', 'thu'], window: '٦ م – ٩ م', note: 'لو العربية اتأخرت أكتر من ساعتين، بلّغ من الزرار تحت.' },
  { district: 'شبرا', days: ['sun', 'mon', 'wed', 'thu'], window: '٧ م – ١٠ م' },
  { district: 'الدقي', days: ['sun', 'tue', 'thu'], window: WINDOW_EVENING },
  { district: 'المهندسين', days: ['mon', 'wed', 'sat'], window: WINDOW_EVENING },
  { district: 'الهرم', days: ['sun', 'tue', 'thu'], window: '٧ م – ١٠ م' },
  { district: 'فيصل', days: ['mon', 'wed', 'sat'], window: '٧ م – ١٠ م' },
  { district: 'إمبابة', days: ['sun', 'tue', 'thu'], window: '٦ م – ٩ م' },
];

/** Used when a district has no published schedule yet. */
export const DEFAULT_GARBAGE_SCHEDULE: Omit<GarbageSchedule, 'district'> = { days: ['sun', 'tue', 'thu'], window: WINDOW_EVENING };

export function findGarbageSchedule(district: string): GarbageSchedule | null {
  return GARBAGE_SCHEDULES.find((s) => s.district === district) ?? null;
}

export type NextCollection = {
  code: WeekdayCode;
  /** 0 = today, 1 = tomorrow, ... */
  inDays: number;
  /** "النهارده الخميس" / "بكرة الخميس" / "بعد بكرة التلات" / "التلات الجاي". */
  label: string;
};

/**
 * The next collection day from `from` (today counts: the truck usually comes in the evening).
 * Returns null when the schedule has no days.
 */
export function nextCollection(days: WeekdayCode[], from: Date = new Date()): NextCollection | null {
  if (days.length === 0) return null;
  const today = from.getDay();
  for (let offset = 0; offset < 7; offset++) {
    const code = WEEKDAY_CODES[(today + offset) % 7];
    if (!days.includes(code)) continue;
    const name = WEEKDAY_NAME_AR[code];
    const label =
      offset === 0 ? `النهارده ${name}` : offset === 1 ? `بكرة ${name}` : offset === 2 ? `بعد بكرة ${name}` : `${name} الجاي`;
    return { code, inDays: offset, label };
  }
  return null;
}

/** "الحد، التلات، الخميس · ٨ م – ١١ م" */
export function scheduleSummary(s: Pick<GarbageSchedule, 'days' | 'window'>): string {
  const ordered = WEEKDAY_CODES.filter((c) => s.days.includes(c));
  return `${ordered.map((c) => WEEKDAY_NAME_AR[c]).join('، ')} · ${s.window}`;
}

/** Number of collections per week in Arabic-Indic digits, e.g. "٣ مرات في الأسبوع". */
export function perWeekAr(n: number): string {
  if (n === 1) return 'مرة في الأسبوع';
  if (n === 2) return 'مرتين في الأسبوع';
  return `${toArabicDigits(n)} مرات في الأسبوع`;
}
