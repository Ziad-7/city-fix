import { buildSeed } from '@/services/mock/seed';
import { selectNearby } from './nearby';

const { incidents } = buildSeed(Date.UTC(2026, 9, 21, 12));
const center = { lat: 30.056, lng: 31.33 };

describe('selectNearby', () => {
  it('returns open incidents only, nearest first, capped by limit', () => {
    const res = selectNearby(incidents, new Set(), center, 3);
    expect(res).toHaveLength(3);
    expect(res.every((r) => r.incident.status !== 'resolved' && r.incident.status !== 'closed')).toBe(true);
    expect(res[0].distanceM).toBeLessThanOrEqual(res[1].distanceM);
    expect(res[1].distanceM).toBeLessThanOrEqual(res[2].distanceM);
  });
  it('skips incidents the user reported', () => {
    const first = selectNearby(incidents, new Set(), center, 1)[0].incident;
    const res = selectNearby(incidents, new Set([first.id]), center, 5);
    expect(res.some((r) => r.incident.id === first.id)).toBe(false);
  });
});
