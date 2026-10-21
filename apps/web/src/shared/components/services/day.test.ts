import { dayLabel, dayParts, parseIsoDay } from './day';

describe('day helpers', () => {
  it('parses as a local date', () => {
    const d = parseIsoDay('2026-10-21');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 21]);
  });
  it('gives the weekday and Arabic-Indic day of month', () => {
    // 2026-10-21 is a Wednesday
    expect(dayParts('2026-10-21')).toEqual({ weekday: 'الأربع', dayOfMonth: '٢١' });
  });
  it('builds a readable label', () => {
    expect(dayLabel('2026-10-22')).toBe('الخميس ٢٢ أكتوبر');
  });
});
