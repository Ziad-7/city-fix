import { computePriority, priorityLevel, priorityReason } from '../priority';

const base = { severity: 'medium' as const, nearSensitivePlace: false, reporters: 1, daysOpen: 0, targetDays: 5, areaUnderserved: false };

describe('computePriority', () => {
  it('is deterministic and sums the factors', () => {
    const a = computePriority(base);
    const b = computePriority(base);
    expect(a).toEqual(b);
    expect(a.score).toBe(a.factors.reduce((s, f) => s + f.points, 0));
    expect(a.factors.map((f) => f.key)).toEqual(['severity', 'sensitive', 'reporters', 'age', 'equity']);
    a.factors.forEach((f) => expect(f.label.length).toBeGreaterThan(0));
  });
  it('scores higher for severity, sensitive places, reporters, age and equity', () => {
    const s0 = computePriority(base).score;
    expect(computePriority({ ...base, severity: 'critical' }).score).toBeGreaterThan(s0);
    expect(computePriority({ ...base, nearSensitivePlace: true }).score).toBe(s0 + 20);
    expect(computePriority({ ...base, reporters: 7 }).score).toBe(s0 + 18);
    expect(computePriority({ ...base, daysOpen: 5 }).score).toBe(s0 + 10);
    expect(computePriority({ ...base, areaUnderserved: true }).score).toBe(s0 + 5);
  });
  it('caps each factor and the total at 100', () => {
    const max = computePriority({ severity: 'critical', nearSensitivePlace: true, reporters: 99, daysOpen: 99, targetDays: 1, areaUnderserved: true });
    expect(max.score).toBe(100);
    expect(max.factors.every((f) => f.points <= f.max)).toBe(true);
  });
  it('maps score to level and explains in Arabic', () => {
    expect(priorityLevel(90)).toBe('critical');
    expect(priorityLevel(70)).toBe('high');
    expect(priorityLevel(45)).toBe('medium');
    expect(priorityLevel(10)).toBe('low');
    const p = computePriority({ ...base, severity: 'high', nearSensitivePlace: true, reporters: 7 });
    expect(priorityReason(p, 7, 'مدرسة')).toContain('٧ بلاغات');
  });
});
