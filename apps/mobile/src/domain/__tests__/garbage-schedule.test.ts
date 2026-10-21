import { findGarbageSchedule, nextCollection, scheduleSummary } from '../garbage-schedule';

// 2026-10-21 is a Wednesday (local time).
const wed = new Date(2026, 9, 21, 12);

describe('garbage schedule', () => {
  it('has the Nasr City 1 demo schedule', () => {
    const s = findGarbageSchedule('مدينة نصر أول')!;
    expect(s.days).toEqual(['sun', 'tue', 'thu']);
    expect(scheduleSummary(s)).toBe('الحد، التلات، الخميس · ٨ م – ١١ م');
    expect(findGarbageSchedule('مكان غير موجود')).toBeNull();
  });

  it('finds tomorrow, today, the day after and next week', () => {
    const days = ['sun', 'tue', 'thu'] as const;
    expect(nextCollection([...days], wed)).toMatchObject({ code: 'thu', inDays: 1, label: 'بكرة الخميس' });
    expect(nextCollection([...days], new Date(2026, 9, 22))).toMatchObject({ code: 'thu', inDays: 0, label: 'النهارده الخميس' });
    expect(nextCollection(['fri', 'sat'], wed)).toMatchObject({ code: 'fri', inDays: 2, label: 'بعد بكرة الجمعة' });
    expect(nextCollection(['wed'], new Date(2026, 9, 22))).toMatchObject({ inDays: 6, label: 'الأربع الجاي' });
  });

  it('wraps over the weekend', () => {
    expect(nextCollection(['sun', 'tue', 'thu'], new Date(2026, 9, 23))).toMatchObject({ code: 'sun', inDays: 2 });
  });

  it('returns null without days', () => {
    expect(nextCollection([], wed)).toBeNull();
  });
});
