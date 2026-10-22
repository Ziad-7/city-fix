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
  it('rebuilds a fallback summary in English instead of keeping Arabic text', () => {
    usePrefs.setState({ lang: 'en' });
    const out = cleanTriageSummary(base).summary;
    expect(out).toMatch(/^Most likely/);
    expect(out).toContain('High risk');
    expect(out).not.toMatch(/[\u0600-\u06FF]/);
  });
  it('uses the English label for a raw token in a non-fallback Arabic line', () => {
    usePrefs.setState({ lang: 'en' });
    const s = { ...base, source: undefined };
    expect(cleanTriageSummary(s).summary).toContain('— High risk،');
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
  it('leaves a summary with no raw token unchanged even when options are empty', () => {
    const s = { ...base, options: [], summary: 'خطورة عالية' };
    expect(cleanTriageSummary(s)).toBe(s);
  });
});

describe('cleanTriageSummary with empty options', () => {
  afterEach(() => usePrefs.setState({ lang: 'ar' }));
  it('does not rebuild an English fallback line without options', () => {
    usePrefs.setState({ lang: 'en' });
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
