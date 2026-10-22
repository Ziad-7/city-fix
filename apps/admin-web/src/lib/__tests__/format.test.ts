import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatEgp,
  formatThousands,
  formatDecimal,
  formatDays,
  formatDelta,
  formatCitizens,
  formatWorkDays,
  formatSpots,
  formatBudget,
  formatTime,
  formatDateTime,
  formatDayDM,
  formatLongDate,
  formatWhen,
  formatDayWithTime,
  formatDueField,
  formatSlot,
  formatSpan,
  formatDueLabel,
  formatRelative,
  shortAddress,
} from '../format';

describe('Number and Money Formatting', () => {
  it('formatNumber', () => {
    expect(formatNumber(128)).toBe('128');
    expect(formatNumber(1800)).toBe('1,800');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('formatEgp', () => {
    expect(formatEgp(1800)).toBe('1,800 جنيه');
    expect(formatEgp(0)).toBe('0 جنيه');
    expect(formatEgp(7500)).toBe('7,500 جنيه');
    expect(formatEgp(162300)).toBe('162,300 جنيه');
  });

  it('formatThousands', () => {
    expect(formatThousands(300000)).toBe('300 ألف');
    expect(formatThousands(150000)).toBe('150 ألف');
    expect(formatThousands(1500)).toBe('1.5 ألف');
    expect(formatThousands(500)).toBe('500 جنيه');
  });

  it('formatDecimal', () => {
    expect(formatDecimal(2.4)).toBe('2.4');
    expect(formatDecimal(3)).toBe('3');
    expect(formatDecimal(0.6)).toBe('0.6');
    expect(formatDecimal(2.45, 1)).toBe('2.5');
  });

  it('formatDays', () => {
    expect(formatDays(2.4)).toBe('2.4 يوم');
    expect(formatDays(3)).toBe('3 يوم');
    expect(formatDays(0.6)).toBe('0.6 يوم');
    expect(formatDays(1)).toBe('1 يوم');
  });

  it('formatPercent', () => {
    // Skipping this test as formatPercent is not exported
  });

  it('formatDelta', () => {
    expect(formatDelta(14)).toBe('+14');
    expect(formatDelta(-3)).toBe('−3');
    expect(formatDelta(0)).toBe('0');
  });

  it('formatCitizens', () => {
    expect(formatCitizens(1)).toBe('مواطن واحد');
    expect(formatCitizens(7)).toBe('7 مواطنين');
    expect(formatCitizens(11)).toBe('11 مواطن');
  });

  it('formatWorkDays', () => {
    expect(formatWorkDays(1)).toBe('يوم عمل');
    expect(formatWorkDays(2)).toBe('يومين عمل');
    expect(formatWorkDays(3)).toBe('3 أيام عمل');
    expect(formatWorkDays(7)).toBe('7 أيام عمل');
  });

  it('formatSpots', () => {
    expect(formatSpots(1)).toBe('مكان واحد');
    expect(formatSpots(2)).toBe('مكانين');
    expect(formatSpots(4)).toBe('4 أماكن');
  });

  it('formatBudget', () => {
    expect(formatBudget(300000)).toBe('300 ألف جنيه');
    expect(formatBudget(150000)).toBe('150 ألف جنيه');
    expect(formatBudget(612500)).toBe('612,500 جنيه');
  });
});

describe('Date and Time Formatting', () => {
  // Fixture: 2026-10-21T10:00:00Z (13:00 Cairo time, Wednesday)
  const now = new Date('2026-10-21T10:00:00Z').getTime();

  it('formatTime', () => {
    expect(formatTime('2026-10-21T06:30:00Z')).toBe('09:30');
    expect(formatTime('2026-10-20T12:20:00Z')).toBe('15:20');
  });

  it('formatDateTime', () => {
    expect(formatDateTime('2026-10-20T12:20:00Z')).toBe('20 أكتوبر 15:20');
    expect(formatDateTime('2026-10-21T06:48:00Z')).toBe('21 أكتوبر 09:48');
  });

  it('formatDayDM', () => {
    expect(formatDayDM('2026-10-22T00:00:00Z', now)).toBe('الخميس 22/10');
    expect(formatDayDM('2026-10-21T00:00:00Z', now)).toBe('النهارده 21/10');
    expect(formatDayDM('2026-10-19T00:00:00Z', now)).toBe('الاثنين 19/10');
    expect(formatDayDM('2026-10-18T00:00:00Z', now)).toBe('الأحد 18/10');
  });

  it('formatLongDate', () => {
    expect(formatLongDate(now)).toBe('الأربعاء 21 أكتوبر');
  });

  it('formatWhen', () => {
    expect(formatWhen('2026-10-21T06:30:00Z', now)).toMatch(/النهارده/);
    expect(formatWhen('2026-10-20T12:20:00Z', now)).toMatch(/أمس/);
    expect(formatWhen('2026-10-19T12:20:00Z', now)).toMatch(/19 أكتوبر/);
  });

  it('formatDayWithTime', () => {
    expect(formatDayWithTime('2026-10-21T05:40:00Z', now)).toBe('النهارده 08:40');
    expect(formatDayWithTime('2026-10-18T00:00:00Z', now)).toMatch(/الأحد/);
  });

  it('formatDueField', () => {
    expect(formatDueField('2026-10-21T12:20:00Z')).toMatch(/الأربعاء 21 أكتوبر · 15:20/);
  });

  it('formatSlot', () => {
    expect(formatSlot('morning')).toBe('9 ص – 12 ظ');
    expect(formatSlot('afternoon')).toBe('2 م – 5 م');
  });

  it('formatSpan', () => {
    expect(formatSpan(5 * 60000)).toBe('5 د');
    expect(formatSpan(19 * 60000)).toBe('19 د');
    expect(formatSpan(40 * 60000)).toBe('40 د');
    expect(formatSpan(24 * 60 * 60000)).toBe('1 يوم');
    expect(formatSpan(48 * 60 * 60000)).toBe('2 يوم');
    expect(formatSpan(3 * 24 * 60 * 60000)).toBe('3 أيام');
    expect(formatSpan(5 * 24 * 60 * 60000)).toBe('5 أيام');
    expect(formatSpan(11 * 24 * 60 * 60000)).toBe('11 يوم');
  });

  it('formatDueLabel', () => {
    expect(formatDueLabel(-4.6)).toBe('باقي 5 س');
    expect(formatDueLabel(-0.2)).toBe('باقي 1 س');
    expect(formatDueLabel(-30)).toBe('باقي يوم');
    expect(formatDueLabel(-50)).toBe('باقي يومين');
    expect(formatDueLabel(5.6)).toBe('متأخر 6 س');
    expect(formatDueLabel(0.3)).toBe('متأخر 1 س');
    expect(formatDueLabel(26)).toBe('متأخر يوم');
    expect(formatDueLabel(49)).toBe('متأخر يومين');
    expect(formatDueLabel(80)).toBe('متأخر 3 أيام');
    expect(formatDueLabel(300)).toBe('متأخر 12 يوم');
  });

  it('formatRelative', () => {
    expect(formatRelative(new Date(now).toISOString(), now)).toBe('دلوقتي');
    expect(formatRelative(new Date(now - 60000).toISOString(), now)).toMatch(/من دقيقة/);
    expect(formatRelative(new Date(now - 24 * 60 * 60000).toISOString(), now)).toBe('امبارح');
  });

  it('shortAddress', () => {
    expect(shortAddress('شارع يوسف عباس، الحي السابع، مدينة نصر')).toBe('شارع يوسف عباس');
  });
});
