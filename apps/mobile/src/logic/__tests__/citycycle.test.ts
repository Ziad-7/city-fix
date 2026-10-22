import type { PickupTimelineEntry, RecyclingPickup } from '@/domain/citycycle';
import { buildPickupSteps, collectorDisplayName, materialsSummary, pickupInFilter } from '../citycycle';

const e = (status: PickupTimelineEntry['status'], note: string, at: string): PickupTimelineEntry => ({ status, note, actor: 'x', at });

describe('pickup timeline', () => {
  it('starts with the first stage current', () => {
    const steps = buildPickupSteps({ status: 'requested', timeline: [e('requested', 'وصل', '2026-10-22T10:00:00Z')] });
    expect(steps.map((s) => s.state)).toEqual(['current', 'future', 'future', 'future']);
    expect(steps[0].at).toBe('2026-10-22T10:00:00Z');
  });

  it('marks earlier stages done and carries each stage’s time', () => {
    const steps = buildPickupSteps({
      status: 'weighed',
      timeline: [e('requested', 'a', '2026-10-22T10:00:00Z'), e('accepted', 'b', '2026-10-22T11:00:00Z'), e('weighed', 'c', '2026-10-22T12:00:00Z')],
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'future']);
    expect(steps[1].at).toBe('2026-10-22T11:00:00Z');
    expect(steps[3].at).toBeUndefined();
  });

  it('shows every stage done once confirmed', () => {
    const steps = buildPickupSteps({
      status: 'completed',
      timeline: [e('requested', 'a', '1'), e('accepted', 'b', '2'), e('weighed', 'c', '3'), e('completed', 'd', '4')],
    });
    expect(steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('ends at "cancelled" for a cancelled pickup', () => {
    const steps = buildPickupSteps({ status: 'cancelled', timeline: [e('requested', 'a', '1'), e('cancelled', 'الطلب اتلغى', '2')] });
    expect(steps.map((s) => [s.key, s.state])).toEqual([['requested', 'done'], ['cancelled', 'current']]);
    expect(steps[1].detail).toBe('الطلب اتلغى');
  });
});

describe('list helpers', () => {
  it('summarises materials with a "plus N" tail', () => {
    const items = [{ materialId: 'pet_plastic' as const }, { materialId: 'paper_cardboard' as const }, { materialId: 'glass' as const }];
    expect(materialsSummary(items.slice(0, 2), (n) => `+${n}`)).toBe('بلاستيك (زجاجات PET)، ورق وكرتون');
    expect(materialsSummary(items, (n) => `+${n}`)).toBe('بلاستيك (زجاجات PET)، ورق وكرتون +1');
  });

  it('sorts pickups under the same chips as other requests', () => {
    expect(pickupInFilter('requested', 'open')).toBe(true);
    expect(pickupInFilter('completed', 'open')).toBe(false);
    expect(pickupInFilter('cancelled', 'fixed')).toBe(true);
    expect(pickupInFilter('requested', 'reports')).toBe(false);
    expect(pickupInFilter('requested', 'services')).toBe(false);
    expect(pickupInFilter('requested', 'recycling')).toBe(true);
    expect(pickupInFilter('requested', 'all')).toBe(true);
  });

  it('shows only the first name of the collector', () => {
    expect(collectorDisplayName({ collectorName: 'أحمد محمود' } as RecyclingPickup)).toBe('أحمد');
    expect(collectorDisplayName({} as RecyclingPickup)).toBeUndefined();
  });
});
