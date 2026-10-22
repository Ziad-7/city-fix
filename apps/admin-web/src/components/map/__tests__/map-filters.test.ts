import { describe, it, expect } from 'vitest';
import { inPeriod, countByKind, searchIncidents } from '../map-filters';
import type { AdminIncident } from '@/domain/admin-types';

const NOW = new Date('2026-10-21T10:00:00Z').getTime();
const inc = (o: Partial<AdminIncident>): AdminIncident =>
  ({
    id: 'INC-1',
    status: 'received',
    severity: 'low',
    priority: { score: 10, factors: [] },
    location: { lat: 1, lng: 1, address: 'شارع التسعين' },
    updatedAt: '2026-10-21T08:00:00Z',
    ...o,
  }) as AdminIncident;

describe('inPeriod', () => {
  it('always shows open incidents regardless of age', () => {
    expect(inPeriod(inc({ status: 'in_progress', updatedAt: '2025-01-01T00:00:00Z' }), 'today', '', '', NOW)).toBe(true);
  });
  it('shows resolved only inside the period', () => {
    const old = inc({ status: 'resolved', updatedAt: '2026-10-10T00:00:00Z' });
    expect(inPeriod(old, '7d', '', '', NOW)).toBe(false);
    expect(inPeriod(old, '30d', '', '', NOW)).toBe(true);
    expect(inPeriod(inc({ status: 'closed', updatedAt: '2026-10-21T01:00:00Z' }), 'today', '', '', NOW)).toBe(true);
  });
  it('honours custom date range', () => {
    const r = inc({ status: 'resolved', updatedAt: '2026-10-15T12:00:00Z' });
    expect(inPeriod(r, 'custom', '2026-10-14', '2026-10-16', NOW)).toBe(true);
    expect(inPeriod(r, 'custom', '2026-10-16', '', NOW)).toBe(false);
  });
});

describe('countByKind', () => {
  it('counts critical open incidents only under critical', () => {
    const c = countByKind([
      inc({ id: 'a', priority: { score: 90, factors: [] } }),
      inc({ id: 'b' }),
      inc({ id: 'c', status: 'closed' }),
    ]);
    expect(c).toEqual({ received: 1, assigned: 0, progress: 0, resolved: 1, critical: 1 });
  });
});

describe('searchIncidents', () => {
  it('matches id and address', () => {
    const list = [inc({ id: 'INC-501' }), inc({ id: 'INC-502', location: { lat: 1, lng: 1, address: 'شارع النصر' } })];
    expect(searchIncidents(list, 'inc-501').map((i) => i.id)).toEqual(['INC-501']);
    expect(searchIncidents(list, 'النصر').map((i) => i.id)).toEqual(['INC-502']);
    expect(searchIncidents(list, 'zzz')).toEqual([]);
  });
});
