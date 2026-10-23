import { describe, expect, it } from 'vitest';
import type { BinForecastItem } from '@/domain/admin-types';
import { hoursToFullLabel } from '../forecast-format';

const item = (o: Partial<BinForecastItem>): BinForecastItem => ({
  binId: 'B1',
  currentFillPct: 50,
  predictedFillPct: 70,
  hoursToFull: 10,
  sampleCount: 5,
  method: 'linear',
  reason: 'ok',
  ...o,
});

describe('hoursToFullLabel', () => {
  it('names each reason without inventing a number', () => {
    expect(hoursToFullLabel(item({ reason: 'stale', hoursToFull: null }))).toBe('القراءات قديمة');
    expect(hoursToFullLabel(item({ reason: 'insufficient_data', method: 'insufficient_data', hoursToFull: null }))).toBe('بيانات مش كفاية');
    expect(hoursToFullLabel(item({ reason: 'non_increasing', hoursToFull: null }))).toBe('مش بتزيد');
  });

  it('says full now for 0 hours, including a flat bin that is already full', () => {
    expect(hoursToFullLabel(item({ hoursToFull: 0 }))).toBe('ممتلئة دلوقتي');
    expect(hoursToFullLabel(item({ reason: 'non_increasing', hoursToFull: 0 }))).toBe('ممتلئة دلوقتي');
  });

  it('formats short, hourly and daily spans', () => {
    expect(hoursToFullLabel(item({ hoursToFull: 0.4 }))).toBe('أقل من ساعة');
    expect(hoursToFullLabel(item({ hoursToFull: 10.4 }))).toBe('10 ساعات');
    expect(hoursToFullLabel(item({ hoursToFull: 47.6 }))).toBe('48 ساعة');
    expect(hoursToFullLabel(item({ hoursToFull: 1.2 }))).toBe('ساعة');
    expect(hoursToFullLabel(item({ hoursToFull: 15 }))).toBe('15 ساعة');
    expect(hoursToFullLabel(item({ hoursToFull: 72 }))).toBe('3 أيام');
    expect(hoursToFullLabel(item({ hoursToFull: 60 }))).toBe('2.5 يوم');
  });

  it('never produces Arabic-Indic digits', () => {
    for (const h of [0.5, 5, 30, 100, 1234.5]) {
      expect(hoursToFullLabel(item({ hoursToFull: h }))).not.toMatch(/[٠-٩]/);
    }
  });
});
