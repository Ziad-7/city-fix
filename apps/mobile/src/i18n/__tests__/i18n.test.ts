import { CATEGORIES } from '@/domain/categories';
import { nextCollection, scheduleSummary } from '@/domain/garbage-schedule';
import { remainingLine } from '@/domain/medals';
import { priorityReason } from '@/logic/priority';
import { usePrefs } from '@/store/usePrefs';
import { localDigits } from '@/utils/digits';
import { formatDate, formatTime, relativeTime } from '@/utils/time';
import { CATEGORY_EN, categoryLabel, departmentLabel, DEPARTMENT_EN, placeName, statusLabel, tr } from '..';

const setLang = (lang: 'ar' | 'en') => usePrefs.setState({ lang });

describe('i18n', () => {
  afterEach(() => setLang('ar'));

  it('defaults to Arabic', () => {
    expect(usePrefs.getState().lang).toBe('ar');
    expect(tr('أهلًا', 'Hi')).toBe('أهلًا');
  });

  it('switches strings, digits and labels to English', () => {
    setLang('en');
    expect(tr('أهلًا', 'Hi')).toBe('Hi');
    expect(localDigits(42)).toBe('42');
    expect(localDigits('٤٢')).toBe('42');
    expect(statusLabel('in_progress', 'جاري التنفيذ')).toBe('In progress');
    expect(categoryLabel('open_manhole', 'بالوعة مفتوحة')).toBe('Open manhole');
    expect(placeName('مدينة نصر أول')).toBe('Nasr City 1');
    expect(departmentLabel('صيانة الطرق')).toBe('Road Maintenance');
  });

  it('keeps Arabic-Indic digits in Arabic', () => {
    expect(localDigits(42)).toBe('٤٢');
  });

  it('has an English label for every category and department', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_EN[c.id]).toBeTruthy();
      expect(DEPARTMENT_EN[c.department]).toBeTruthy();
    }
  });

  it('formats time and dates in English', () => {
    setLang('en');
    const d = new Date(2026, 9, 22, 10, 12);
    expect(formatTime(d)).toBe('10:12 AM');
    expect(formatDate(d)).toBe('22 Oct');
    expect(relativeTime(d.getTime() - 3 * 86_400_000, d.getTime())).toBe('3 days ago');
  });

  it('builds English sentences in the shared helpers', () => {
    setLang('en');
    expect(remainingLine(2, 'جدع الشارع')).toBe('2 more reports to earn Street Hero');
    const p = { score: 78, factors: [{ key: 'severity', label: '', points: 40, max: 40 }] };
    expect(priorityReason(p, 7, 'مدرسة')).toBe('High priority: near a school or hospital, 7 reports, high risk');
    expect(scheduleSummary({ days: ['sun', 'tue'], window: '٨ م – ١١ م' })).toBe('Sunday, Tuesday · 8 PM – 11 PM');
    const thu = new Date(2026, 9, 22); // Thursday
    expect(nextCollection(['thu'], thu)?.label).toBe('Today, Thursday');
    expect(nextCollection(['sat'], thu)?.label).toBe('Saturday');
  });
});
