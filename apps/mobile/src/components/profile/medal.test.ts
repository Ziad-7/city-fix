import { medalTitle, nextMedal, remainingLine } from './medal';

describe('medalTitle', () => {
  it('has no medal under 3 reports', () => {
    expect(medalTitle(0)).toBeNull();
    expect(medalTitle(2)).toBeNull();
  });
  it('gives جدع الشارع from 3', () => {
    expect(medalTitle(3)).toBe('جدع الشارع');
    expect(medalTitle(9)).toBe('جدع الشارع');
  });
  it('gives جدع الحي from 10', () => {
    expect(medalTitle(10)).toBe('جدع الحي');
    expect(medalTitle(40)).toBe('جدع الحي');
  });
});

describe('nextMedal', () => {
  it('points at the first medal', () => {
    expect(nextMedal(1)).toEqual({ title: 'جدع الشارع', remaining: 2, progress: 1 / 3 });
  });
  it('points at the second after the first', () => {
    const n = nextMedal(3);
    expect(n?.title).toBe('جدع الحي');
    expect(n?.remaining).toBe(7);
  });
  it('is null at the top', () => {
    expect(nextMedal(10)).toBeNull();
  });
});

describe('remainingLine', () => {
  it('agrees with the count', () => {
    expect(remainingLine(1, 'جدع الشارع')).toBe('فاضل بلاغ واحد وتاخد لقب جدع الشارع');
    expect(remainingLine(2, 'جدع الشارع')).toBe('فاضل بلاغين وتاخد لقب جدع الشارع');
    expect(remainingLine(7, 'جدع الحي')).toBe('فاضل ٧ بلاغات وتاخد لقب جدع الحي');
  });
});
