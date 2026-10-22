import { followersLine, paymentLabel, slotLabel } from './labels';

describe('labels', () => {
  it('followers line agrees with the count', () => {
    expect(followersLine(7)).toBe('٧ مواطنين متابعين البلاغ ده');
    expect(followersLine(12)).toBe('١٢ مواطن متابعين البلاغ ده');
    expect(followersLine(1)).toBe('مواطن واحد بيتابع البلاغ ده');
    expect(followersLine(2)).toBe('مواطنين بيتابعوا البلاغ ده');
    expect(followersLine(0)).toContain('لسه');
  });
  it('maps slot and payment ids', () => {
    expect(slotLabel('morning')).toBe('٩ ص – ١٢ ظ');
    expect(paymentLabel('instapay')).toBe('إنستاباي');
  });
});
