import { cleanTriageSummary, triageSummaryFor } from '../triage-mock';
import { usePrefs } from '@/store/usePrefs';
import type { Severity, TriageSuggestion } from '@/domain/types';

const base: TriageSuggestion = {
  options: [{ categoryId: 'open_manhole', confidence: 0.8 }],
  severity: 'high',
  summary: 'الغالب إنها "بالوعة مفتوحة" — high، وهتروح لـالصرف الصحي.',
  duplicates: [],
  source: 'fallback',
};

describe('cleanTriageSummary', () => {
  afterEach(() => usePrefs.setState({ lang: 'ar' }));
  it('replaces only the raw token with the Arabic label', () => {
    const out = cleanTriageSummary(base).summary;
    expect(out).toBe('الغالب إنها "بالوعة مفتوحة" — خطورة عالية، وهتروح لـالصرف الصحي.');
  });
  it('uses the English label in English', () => {
    usePrefs.setState({ lang: 'en' });
    expect(cleanTriageSummary(base).summary).toContain('— High risk،');
  });
  it('never touches an English model summary, even with low/high in it', () => {
    const s = { ...base, source: 'model' as const, summary: 'Live wire hanging low over the sidewalk, high voltage' };
    expect(cleanTriageSummary(s)).toBe(s);
  });
  it('keeps an Arabic model summary in the English UI', () => {
    usePrefs.setState({ lang: 'en' });
    const s = { ...base, source: 'model' as const, summary: 'سلك كهرباء مكشوف قدام المدرسة' };
    expect(cleanTriageSummary(s)).toBe(s);
  });
  it('does not match capitalised or embedded words', () => {
    const s = { ...base, summary: 'مشكلة Highway والـlowest' };
    expect(cleanTriageSummary(s)).toBe(s);
  });
  it('returns the input unchanged when there are no options', () => {
    const s = { ...base, options: [], summary: 'خطورة عالية' };
    expect(cleanTriageSummary(s)).toBe(s);
  });
});

describe('triageSummaryFor', () => {
  afterEach(() => usePrefs.setState({ lang: 'ar' }));
  it.each(['low', 'medium', 'high', 'critical'] as Severity[])('has no raw enum for %s', (severity) => {
    for (const lang of ['ar', 'en'] as const) {
      usePrefs.setState({ lang });
      const out = triageSummaryFor({ options: base.options, severity });
      expect(out).not.toMatch(new RegExp(`\\b${severity}\\b`));
    }
  });
});
