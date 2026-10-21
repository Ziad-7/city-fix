import { DISTRICT_TITLE, STREET_TITLE, medalFor, remainingLine } from '../medals';

describe('medalFor', () => {
  it('has no earned title under 3 reports and works towards جدع الشارع', () => {
    for (const n of [0, 1, 2]) {
      const m = medalFor(n);
      expect(m.tier).toBe('none');
      expect(m.earnedTitle).toBeNull();
      expect(m.title).toBe(STREET_TITLE);
      expect(m.goal).toBe(3);
      expect(m.remaining).toBe(3 - n);
      expect(m.progress).toBeCloseTo(n / 3);
    }
  });

  it('earns جدع الشارع from 3 and then aims for جدع الحي with progress n / 10', () => {
    for (const n of [3, 9]) {
      const m = medalFor(n);
      expect(m.tier).toBe('street');
      expect(m.earnedTitle).toBe(STREET_TITLE);
      expect(m.next).toEqual({ title: DISTRICT_TITLE, goal: 10 });
      expect(m.remaining).toBe(10 - n);
      expect(m.progress).toBeCloseTo(n / 10);
    }
  });

  it('tops out at جدع الحي from 10 with a full bar', () => {
    for (const n of [10, 40]) {
      const m = medalFor(n);
      expect(m.tier).toBe('district');
      expect(m.earnedTitle).toBe(DISTRICT_TITLE);
      expect(m.next).toBeNull();
      expect(m.remaining).toBe(0);
      expect(m.progress).toBe(1);
    }
  });

  it('clamps nonsense input', () => {
    expect(medalFor(-4).remaining).toBe(3);
    expect(medalFor(2.9).remaining).toBe(1);
  });

  it('gives one progress definition for both screens (3 reports: 30%, 7 to go)', () => {
    const m = medalFor(3);
    expect(m.progress).toBeCloseTo(0.3);
    expect(remainingLine(m.remaining, m.next!.title)).toBe('فاضل ٧ بلاغات وتاخد لقب جدع الحي');
  });
});

describe('remainingLine', () => {
  it('agrees with the count', () => {
    expect(remainingLine(1, STREET_TITLE)).toBe('فاضل بلاغ واحد وتاخد لقب جدع الشارع');
    expect(remainingLine(2, STREET_TITLE)).toBe('فاضل بلاغين وتاخد لقب جدع الشارع');
    expect(remainingLine(7, DISTRICT_TITLE)).toBe('فاضل ٧ بلاغات وتاخد لقب جدع الحي');
  });
});
