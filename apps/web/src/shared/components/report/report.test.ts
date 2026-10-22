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
