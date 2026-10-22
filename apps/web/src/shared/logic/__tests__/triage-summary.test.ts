import { cleanTriageSummary } from '../triage-mock';
import { usePrefs } from '@/store/usePrefs';
import type { TriageSuggestion } from '@/domain/types';

const base: TriageSuggestion = {
  options: [{ categoryId: 'open_manhole', confidence: 0.8 }],
  severity: 'high',
  summary: 'الغالب إنها "بالوعة مفتوحة" — high، وهتروح لـالصرف الصحي.',
  duplicates: [],
  source: 'fallback',
};

describe('cleanTriageSummary', () => {
  afterEach(() => usePrefs.setState({ lang: 'ar' }));
  it('replaces a raw severity word with the Arabic label', () => {
    const out = cleanTriageSummary(base).summary;
    expect(out).toContain('خطورة عالية');
    expect(out).not.toMatch(/\bhigh\b/);
  });
  it('writes English when the app is in English', () => {
    usePrefs.setState({ lang: 'en' });
    const out = cleanTriageSummary(base).summary;
    expect(out).toContain('High risk');
    expect(out).not.toMatch(/\bhigh\b/);
  });
  it('keeps a clean summary', () => {
    const clean = { ...base, summary: 'خطورة عالية، تمام' };
    expect(cleanTriageSummary(clean)).toBe(clean);
  });
});
