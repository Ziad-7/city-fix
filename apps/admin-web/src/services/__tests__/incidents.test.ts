import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));

import { http } from '@/lib/http';
import { getSimilarIncidents } from '../incidents';

const inc = (id: string) => ({ id, title: id, location: { lat: 30, lng: 31, address: 'x' }, linkedReports: [] });

describe('getSimilarIncidents', () => {
  beforeEach(() => {
    vi.mocked(http).mockReset();
  });

  it('resolves the DuplicateMatch[] the backend returns into full incidents', async () => {
    vi.mocked(http).mockImplementation(async (_m: string, path: string) => {
      if (path === '/admin/incidents/INC-1/similar') return [{ incidentId: 'INC-2', distanceM: 10 }] as never;
      if (path === '/admin/incidents/INC-2') return inc('INC-2') as never;
      throw new Error(String(path));
    });
    const out = await getSimilarIncidents('INC-1');
    expect(out).toHaveLength(1);
    expect(out[0].location.lat).toBe(30);
  });

  it('drops a match that cannot be read', async () => {
    vi.mocked(http).mockImplementation(async (_m: string, path: string) => {
      if (path.endsWith('/similar')) return [{ incidentId: 'INC-2' }, { incidentId: 'INC-3' }] as never;
      if (path.endsWith('INC-3')) return inc('INC-3') as never;
      throw new Error('403');
    });
    expect((await getSimilarIncidents('INC-1')).map((i) => i.id)).toEqual(['INC-3']);
  });

  it('is empty when there are no matches', async () => {
    vi.mocked(http).mockResolvedValue(undefined as never);
    expect(await getSimilarIncidents('INC-1')).toEqual([]);
  });
});
