import { MIN_DESCRIPTION, newReportSchema } from '../schemas';

const base = {
  categoryId: 'pothole',
  description: '',
  photoUris: [] as string[],
  location: { lat: 30.05, lng: 31.33, address: 'شارع عباس العقاد' },
  anonymous: false,
  blurFaces: true,
};

describe('newReportSchema (photo OR description of 10+ characters)', () => {
  it('rejects no photo and a short description', () => {
    expect(newReportSchema.safeParse(base).success).toBe(false);
    const short = newReportSchema.safeParse({ ...base, description: 'x'.repeat(MIN_DESCRIPTION - 1) });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0].path).toEqual(['description']);
  });
  it('accepts a photo alone', () => {
    expect(newReportSchema.safeParse({ ...base, photoUris: ['file:///a.jpg'] }).success).toBe(true);
  });
  it('accepts a 10+ character description alone', () => {
    expect(newReportSchema.safeParse({ ...base, description: 'فيه حفرة كبيرة قدام المدرسة' }).success).toBe(true);
  });
  it('trims the description before counting', () => {
    expect(newReportSchema.safeParse({ ...base, description: '   قصير   ' }).success).toBe(false);
  });
  it('still requires a category and an address', () => {
    expect(newReportSchema.safeParse({ ...base, photoUris: ['a'], categoryId: '' }).success).toBe(false);
    expect(newReportSchema.safeParse({ ...base, photoUris: ['a'], location: { ...base.location, address: '' } }).success).toBe(false);
  });
});
