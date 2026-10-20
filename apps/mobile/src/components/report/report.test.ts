import { medalFor } from './medal';
import { moreReportsAr, neighboursAr, reportedByAr } from './text';
import { validateReportForm, type ReportFormValues } from './validation';

const base: ReportFormValues = {
  categoryId: 'pothole',
  description: '',
  photoUris: [],
  location: { lat: 30.05, lng: 31.33, address: 'شارع عباس العقاد' },
  anonymous: false,
  blurFaces: true,
};

describe('medalFor', () => {
  it('1-2 reports: working towards جدع الشارع', () => {
    const m = medalFor(1);
    expect(m.tier).toBe('none');
    expect(m.title).toBe('جدع الشارع');
    expect(m.remaining).toBe(2);
    expect(m.goal).toBe(3);
    expect(m.progress).toBeCloseTo(1 / 3);
  });
  it('3 reports: earned جدع الشارع, 7 to جدع الحي', () => {
    const m = medalFor(3);
    expect(m.tier).toBe('street');
    expect(m.next).toEqual({ title: 'جدع الحي', goal: 10 });
    expect(m.remaining).toBe(7);
    expect(m.progress).toBeCloseTo(0.3);
  });
  it('10+ reports: top tier, full bar', () => {
    const m = medalFor(12);
    expect(m.tier).toBe('district');
    expect(m.next).toBeNull();
    expect(m.progress).toBe(1);
  });
});

describe('Arabic phrases', () => {
  it('pluralises report counts', () => {
    expect(moreReportsAr(1)).toBe('بلاغ كمان');
    expect(moreReportsAr(2)).toBe('بلاغين كمان');
    expect(moreReportsAr(7)).toBe('٧ بلاغات كمان');
  });
  it('pluralises citizens and neighbours', () => {
    expect(reportedByAr(6)).toBe('بلّغ عنها ٦ مواطنين');
    expect(neighboursAr(12)).toBe('١٢ جار قالوا أنا كمان');
    expect(neighboursAr(5)).toBe('٥ جيران قالوا أنا كمان');
  });
});

describe('validateReportForm', () => {
  it('requires a photo or a 10+ char description', () => {
    expect(validateReportForm(base).description).toBeDefined();
    expect(validateReportForm({ ...base, description: 'قصير' }).description).toBeDefined();
    expect(validateReportForm({ ...base, description: 'فيه حفرة كبيرة قدام المدرسة' })).toEqual({});
    expect(validateReportForm({ ...base, photoUris: ['file:///a.jpg'] })).toEqual({});
  });
  it('requires a category and an address', () => {
    const errs = validateReportForm({ ...base, categoryId: '', description: 'فيه حفرة كبيرة قدام المدرسة', location: { ...base.location, address: '' } });
    expect(errs.categoryId).toBeDefined();
    expect(errs.address).toBeDefined();
  });
});
