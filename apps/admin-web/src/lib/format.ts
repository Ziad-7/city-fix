/**
 * Formatting helpers for Egyptian Arabic with Western digits.
 * All functions are pure; `now` is injectable (default Date.now()) for testability.
 */

const CAIRO_TZ = 'Africa/Cairo';

// Weekday names (Sunday-first)
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Month names
const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/**
 * Egyptian Arabic plural helper.
 * Selects based on: 1 → one, 2 → two, 3–10 → few(n), ≥11 → many(n)
 */
export function dual(
  n: number,
  one: string,
  two: string,
  few: (n: number) => string,
  many: (n: number) => string,
): string {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return few(n);
  return many(n);
}

/**
 * Format a number with Western digits and thousand separators.
 * 128 → "128", 1800 → "1,800"
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

/**
 * Format Egyptian pounds.
 * 1800 → "1,800 جنيه"
 */
export function formatEgp(n: number): string {
  return `${formatNumber(n)} جنيه`;
}

/**
 * Format thousands nicely: 300000 → "300 ألف", 1500 → "1.5 ألف", 500 → "500 جنيه"
 */
export function formatThousands(n: number): string {
  if (n < 1000) return formatEgp(n);
  const thousands = n / 1000;
  const formatted =
    thousands % 1 === 0 ? formatNumber(thousands) : formatDecimal(thousands, 1);
  return `${formatted} ألف`;
}

/**
 * Format a decimal number, removing trailing zeros and the decimal if it's .0.
 */
export function formatDecimal(n: number, digits = 1): string {
  const rounded = Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
  const str = rounded.toFixed(digits);
  return str.replace(/\.?0+$/, '');
}

/**
 * Format days (e.g., average resolution time).
 * 2.4 → "2.4 يوم"
 */
export function formatDays(n: number): string {
  return `${formatDecimal(n, 1)} يوم`;
}

/**
 * Format percentage from a part and total.
 */
export function formatPercent(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

/**
 * Format a delta (change). Positive gets "+", negative gets "−" (U+2212).
 */
export function formatDelta(n: number): string {
  if (n === 0) return '0';
  if (n > 0) return `+${formatNumber(n)}`;
  return `−${formatNumber(-n)}`;
}

/**
 * Format number of citizens using dual form.
 */
export function formatCitizens(n: number): string {
  return dual(
    n,
    'مواطن واحد',
    'مواطنين اتنين',
    (n) => `${n} مواطنين`,
    (n) => `${n} مواطن`,
  );
}

/**
 * Format work days target.
 */
export function formatWorkDays(n: number): string {
  return dual(
    n,
    'يوم عمل',
    'يومين عمل',
    (n) => `${n} أيام عمل`,
    (n) => `${n} أيام عمل`,
  );
}

/**
 * Format available spots.
 */
export function formatSpots(n: number): string {
  return dual(
    n,
    'مكان واحد',
    'مكانين',
    (n) => `${n} أماكن`,
    (n) => `${n} أماكن`,
  );
}

/**
 * Format budget nicely.
 */
export function formatBudget(n: number): string {
  if (n % 1000 === 0) {
    return `${formatNumber(n / 1000)} ألف جنيه`;
  }
  return formatEgp(n);
}

/**
 * Get the hour and minute parts in Cairo time.
 */
function getCairoTimeParts(date: Date): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour, minute };
}

/**
 * Get date parts in Cairo time.
 */
function getCairoDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CAIRO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026', 10);
  return { year, month, day };
}

/**
 * Format time in 24-hour Cairo time.
 * "2026-10-21T06:30:00Z" → "09:30"
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { hour, minute } = getCairoTimeParts(date);
  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = minute.toString().padStart(2, '0');
  return `${hourStr}:${minuteStr}`;
}

/**
 * Format date and time.
 * "2026-10-20T12:20:00Z" → "20 أكتوبر 15:20"
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDateTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { day, month } = getCairoDateParts(date);
  const { hour, minute } = getCairoTimeParts(date);
  const monthName = MONTHS[month - 1];
  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = minute.toString().padStart(2, '0');
  return `${day} ${monthName} ${hourStr}:${minuteStr}`;
}

/**
 * Format date with weekday and day/month in Cairo time, no zero-padding.
 * tomorrow → "الخميس 22/10"
 * today → "النهارده 21/10"
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDayDM(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { day: dateDay, month: dateMonth } = getCairoDateParts(date);
  const { day: todayDay, month: todayMonth } = getCairoDateParts(new Date(now));

  let label = '';
  if (dateDay === todayDay && dateMonth === todayMonth) {
    label = 'النهارده';
  } else {
    const weekday = WEEKDAYS[date.getUTCDay()];
    label = weekday;
  }

  return `${label} ${dateDay}/${dateMonth}`;
}

/**
 * Format long date (with weekday and full month).
 * now → "الأربعاء 21 أكتوبر"
 */
export function formatLongDate(isoOrNow: string | number = Date.now()): string {
  const ms = typeof isoOrNow === 'string' ? new Date(isoOrNow).getTime() : isoOrNow;
  const date = new Date(ms);
  const weekday = WEEKDAYS[date.getUTCDay()];
  const { day, month } = getCairoDateParts(date);
  const monthName = MONTHS[month - 1];
  return `${weekday} ${day} ${monthName}`;
}

/**
 * Format when something happened relative to now.
 * Same day → "النهارده 09:30"
 * Previous day → "أمس 14:10"
 * Older → "20 أكتوبر 15:20"
 */
export function formatWhen(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { day: dateDay, month: dateMonth, year: dateYear } = getCairoDateParts(date);
  const { day: nowDay, month: nowMonth, year: nowYear } = getCairoDateParts(new Date(now));
  const { hour, minute } = getCairoTimeParts(date);
  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = minute.toString().padStart(2, '0');
  const time = `${hourStr}:${minuteStr}`;

  if (dateDay === nowDay && dateMonth === nowMonth && dateYear === nowYear) {
    return `النهارده ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const { day: yestDay, month: yestMonth, year: yestYear } = getCairoDateParts(yesterday);
  if (dateDay === yestDay && dateMonth === yestMonth && dateYear === yestYear) {
    return `أمس ${time}`;
  }

  const monthName = MONTHS[dateMonth - 1];
  return `${dateDay} ${monthName} ${time}`;
}

/**
 * Format day with time if today, otherwise day/month.
 * today → "النهارده 08:40"
 * other → "الأحد 18/10"
 */
export function formatDayWithTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { day: dateDay, month: dateMonth, year: dateYear } = getCairoDateParts(date);
  const { day: nowDay, month: nowMonth, year: nowYear } = getCairoDateParts(new Date(now));

  if (dateDay === nowDay && dateMonth === nowMonth && dateYear === nowYear) {
    const { hour, minute } = getCairoTimeParts(date);
    const hourStr = hour.toString().padStart(2, '0');
    const minuteStr = minute.toString().padStart(2, '0');
    return `النهارده ${hourStr}:${minuteStr}`;
  }

  return formatDayDM(iso, now);
}

/**
 * Format due date field.
 * "2026-10-21T12:20:00Z" → "الأربعاء 21 أكتوبر · 15:20"
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDueField(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const { day, month } = getCairoDateParts(date);
  const { hour, minute } = getCairoTimeParts(date);
  const weekday = WEEKDAYS[date.getUTCDay()];
  const monthName = MONTHS[month - 1];
  const hourStr = hour.toString().padStart(2, '0');
  const minuteStr = minute.toString().padStart(2, '0');
  return `${weekday} ${day} ${monthName} · ${hourStr}:${minuteStr}`;
}

/**
 * Format service request time slot.
 */
export function formatSlot(slot: string): string {
  const map: Record<string, string> = {
    morning: '9 ص – 12 ظ',
    afternoon: '2 م – 5 م',
  };
  return map[slot] || slot;
}

/**
 * Format a span of milliseconds as human-readable duration.
 */
export function formatSpan(ms: number, now = Date.now()): string {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);

  if (minutes === 0) return '1 د';
  if (hours === 0) return `${minutes} د`;
  if (days === 0) return `${hours} س`;

  // Format days with dual form
  return dual(
    days,
    '1 يوم',
    '2 يوم',
    (n) => `${n} أيام`,
    (n) => `${n} يوم`,
  );
}

/**
 * Format a due label from hours late.
 * Negative = hours remaining, positive = hours overdue
 */
export function formatDueLabel(hoursLate: number): string {
  if (hoursLate < 0) {
    // Remaining
    const remaining = Math.ceil(-hoursLate);
    if (remaining < 24) {
      return `باقي ${Math.max(1, remaining)} س`;
    }
    const days = Math.floor(remaining / 24);
    return `باقي ${dual(days, 'يوم', 'يومين', (n) => `${n} أيام`, (n) => `${n} يوم`)}`;
  } else {
    // Overdue
    const rounded = Math.round(hoursLate);
    if (rounded < 24) {
      return `متأخر ${Math.max(1, rounded)} س`;
    }
    const days = Math.floor(hoursLate / 24);
    return `متأخر ${dual(days, 'يوم', 'يومين', (n) => `${n} أيام`, (n) => `${n} يوم`)}`;
  }
}

/**
 * Calculate hours late from dueAt and now.
 */
export function hoursLateOf(dueAt: string, now = Date.now()): number {
  return (now - new Date(dueAt).getTime()) / 3600000;
}

/**
 * Format a time as relative to now.
 */
export function formatRelative(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const elapsed = now - date.getTime();
  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);

  if (minutes < 1) return 'دلوقتي';
  if (hours === 0) {
    return dual(
      minutes,
      'من دقيقة',
      'من دقيقتين',
      (n) => `من ${n} دقايق`,
      (n) => `من ${n} دقيقة`,
    );
  }
  if (days === 0) {
    return dual(
      hours,
      'من ساعة',
      'من ساعتين',
      (n) => `من ${n} ساعات`,
      (n) => `من ${n} ساعة`,
    );
  }

  if (days === 1) return 'امبارح';

  if (days < 30) {
    return dual(
      days,
      'من يوم',
      'من يومين',
      (n) => `من ${n} أيام`,
      (n) => `من ${n} يوم`,
    );
  }

  const months = Math.floor(days / 30);
  return dual(
    months,
    'من شهر',
    'من شهرين',
    (n) => `من ${n} شهور`,
    (n) => `من ${n} شهور`,
  );
}

/**
 * Extract short address (text before first comma).
 */
export function shortAddress(address: string): string {
  const idx = address.indexOf('،');
  return idx >= 0 ? address.substring(0, idx) : address;
}
