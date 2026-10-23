import type { BinForecastItem } from '@/domain/admin-types';
import { dual, formatDecimal, formatNumber } from '@/lib/format';

/** One short Arabic line for "time until full", honest about why there may be no number. */
export function hoursToFullLabel(item: BinForecastItem): string {
  if (item.reason === 'stale') return 'القراءات قديمة';
  if (item.reason === 'insufficient_data') return 'بيانات مش كفاية';
  const h = item.hoursToFull;
  if (h === 0) return 'ممتلئة دلوقتي';
  if (item.reason === 'non_increasing' || h == null) return 'مش بتزيد';
  if (h < 1) return 'أقل من ساعة';
  if (h < 48) return dual(Math.round(h), 'ساعة', 'ساعتين', (n) => `${n} ساعات`, (n) => `${formatNumber(n)} ساعة`);
  const days = h / 24;
  if (Number.isInteger(days)) return dual(days, 'يوم', 'يومين', (n) => `${n} أيام`, (n) => `${formatNumber(n)} يوم`);
  return `${formatDecimal(days)} يوم`;
}
