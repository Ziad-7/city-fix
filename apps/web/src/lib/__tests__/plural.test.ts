import { describe, expect, it } from 'vitest';
import { reportsCountAr } from '../plural';

describe('reportsCountAr', () => {
  it('uses the right Arabic form for each count', () => {
    expect(reportsCountAr(0)).toBe('مفيش بلاغات');
    expect(reportsCountAr(1)).toBe('بلاغ واحد');
    expect(reportsCountAr(2)).toBe('بلاغين');
    expect(reportsCountAr(5)).toBe('٥ بلاغات');
    expect(reportsCountAr(10)).toBe('١٠ بلاغات');
    expect(reportsCountAr(11)).toBe('١١ بلاغ');
  });
});
