import { normalizeAr, triageMock, triageOfflineFallback } from '../triage-mock';

describe('triageMock', () => {
  it('classifies a pothole description and boosts severity near a school', () => {
    const r = triageMock({ description: 'فيه حفرة كبيرة قدام المدرسة والعربيات بتقع فيها كل يوم' });
    expect(r.options[0].categoryId).toBe('pothole');
    expect(r.severity).toBe('high');
    expect(r.summary).toContain('حفرة');
  });
  it('returns top-3 sorted options whose confidences sum to <= 1', () => {
    const r = triageMock({ description: 'زبالة متراكمة وكلاب ضالة جنبها', categoryId: 'garbage' });
    expect(r.options).toHaveLength(3);
    const sum = r.options.reduce((s, o) => s + o.confidence, 0);
    expect(sum).toBeLessThanOrEqual(1);
    expect(r.options[0].confidence).toBeGreaterThanOrEqual(r.options[1].confidence);
    expect(r.options[1].confidence).toBeGreaterThanOrEqual(r.options[2].confidence);
    expect(r.options[0].categoryId).toBe('garbage');
  });
  it('uses the chosen category as a prior and is deterministic', () => {
    const a = triageMock({ description: 'مشكلة', categoryId: 'streetlight_out' });
    expect(a.options[0].categoryId).toBe('streetlight_out');
    expect(triageMock({ description: 'مشكلة', categoryId: 'streetlight_out' })).toEqual(a);
  });
  it('treats danger categories as at least high severity', () => {
    const r = triageMock({ description: 'سلك كهربا عريان بيطلع شرر' });
    expect(r.options[0].categoryId).toBe('exposed_wire');
    expect(['high', 'critical']).toContain(r.severity);
    expect(triageMock({ description: 'بلوعة مفتوحة', categoryId: 'open_manhole' }).severity).toMatch(/high|critical/);
  });
  it('normalises Arabic spelling variants', () => {
    expect(normalizeAr('الأسفلت مكسورة ى')).toBe('الاسفلت مكسوره ي');
  });
});

describe('triageOfflineFallback', () => {
  it('returns a keyword suggestion when the description identifies a category', () => {
    const result = triageOfflineFallback({ description: 'فيه حفرة في الاسفلت' });
    expect(result?.options[0].categoryId).toBe('pothole');
    expect(result?.source).toBe('fallback');
    expect(result?.duplicates).toEqual([]);
  });

  it('does not guess a category from a photo-only or unrecognized report', () => {
    expect(triageOfflineFallback({ description: '' })).toBeNull();
    expect(triageOfflineFallback({ description: 'مشكلة في الشارع' })).toBeNull();
  });

  it('respects a category chosen by the citizen when text is unavailable', () => {
    const result = triageOfflineFallback({ description: '', categoryId: 'pothole' });
    expect(result?.options[0].categoryId).toBe('pothole');
  });
});
