import { formatEgyptPhone, isValidEgyptPhone, maskPhone, normalizeEgyptPhone, toArabicDigits, toWesternDigits } from '../digits';

describe('digits', () => {
  it('converts to Arabic-Indic digits', () => {
    expect(toArabicDigits(1042)).toBe('١٠٤٢');
    expect(toArabicDigits('خطوة 2 من 3')).toBe('خطوة ٢ من ٣');
  });
  it('converts back to Western digits', () => {
    expect(toWesternDigits('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678');
  });
  it('validates Egyptian mobiles', () => {
    expect(isValidEgyptPhone('010 1234 5678')).toBe(true);
    expect(isValidEgyptPhone('01512345678')).toBe(true);
    expect(isValidEgyptPhone('٠١١١٢٣٤٥٦٧٨')).toBe(true);
    expect(isValidEgyptPhone('01312345678')).toBe(false);
    expect(isValidEgyptPhone('0101234567')).toBe(false);
    expect(isValidEgyptPhone('')).toBe(false);
  });
  it('normalises and formats', () => {
    expect(normalizeEgyptPhone('+20 10 1234 5678')).toBe('01012345678');
    expect(formatEgyptPhone('01012345678')).toBe('010 1234 5678');
    expect(maskPhone('01012345678')).toBe('010 •••• 5678');
  });
});
