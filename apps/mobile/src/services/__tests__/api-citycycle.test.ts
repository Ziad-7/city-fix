import { usePrefs } from '@/store/usePrefs';

const res = (status: number, body: unknown = ''): Response =>
  ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }) as unknown as Response;

const fetchMock = jest.fn();

async function boot() {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  // Same module registry for the service and the error helpers (resetModules gives new class identities).
  return { ...jest.requireActual<typeof import('../api/citycycle')>('../api/citycycle'), ...jest.requireActual<typeof import('../citycycle-errors')>('../citycycle-errors') };
}

const call = (n = 0) => ({ url: fetchMock.mock.calls[n][0] as string, init: fetchMock.mock.calls[n][1] as { method: string; body?: string } });

beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
  usePrefs.setState({ lang: 'ar' });
});

describe('API CityCycle services call the contract endpoints', () => {
  it('citizen endpoints', async () => {
    const { createApiCityCycleService } = await boot();
    const api = createApiCityCycleService();
    fetchMock.mockResolvedValue(res(200, []));
    await api.listPrices('مدينة نصر أول');
    expect(call().url).toBe(`http://api.test/recycling/materials?district=${encodeURIComponent('مدينة نصر أول')}`);
    await api.listMyPickups('u');
    expect(call(1)).toMatchObject({ url: 'http://api.test/recycling/pickups', init: { method: 'GET' } });
    await api.getMyImpact('u');
    expect(call(2).url).toBe('http://api.test/me/impact');
    await api.listBins();
    expect(call(3).url).toBe('http://api.test/bins');

    fetchMock.mockResolvedValue(res(200, { id: 'RCY-1' }));
    const body = { items: [{ materialId: 'glass' as const, estimatedKg: 2 }], location: { lat: 1, lng: 2, address: 'x' }, day: '2026-10-25', slot: 'morning' as const, mode: 'free' as const };
    await api.createPickup('u', body);
    expect(call(4)).toMatchObject({ url: 'http://api.test/recycling/pickups', init: { method: 'POST' } });
    expect(JSON.parse(call(4).init.body as string)).toEqual(body);
    await api.cancelPickup('u', 'RCY-1', 'x');
    expect(call(5).url).toBe('http://api.test/recycling/pickups/RCY-1/cancel');
    await api.confirmPickup('u', 'RCY-1');
    expect(call(6).url).toBe('http://api.test/recycling/pickups/RCY-1/confirm');
  });

  it('getPickup treats 404 and 403 as not found; report-full sends the note and accepts 204', async () => {
    const { createApiCityCycleService } = await boot();
    const api = createApiCityCycleService();
    fetchMock.mockResolvedValueOnce(res(404, { detail: 'x' }));
    expect(await api.getPickup('RCY-9')).toBeNull();
    fetchMock.mockResolvedValueOnce(res(403, { detail: 'x' }));
    expect(await api.getPickup('RCY-9')).toBeNull();
    fetchMock.mockResolvedValueOnce(res(204));
    await expect(api.reportFullBin('u', 'BIN-014', { note: 'n' })).resolves.toBeUndefined();
    expect(call(2)).toMatchObject({ url: 'http://api.test/bins/BIN-014/report-full', init: { method: 'POST' } });
    expect(JSON.parse(call(2).init.body as string)).toEqual({ note: 'n' });
  });

  it('classify never throws: errors give a fallback result', async () => {
    const { createApiCityCycleService } = await boot();
    const api = createApiCityCycleService();
    fetchMock.mockResolvedValueOnce(res(502, 'bad gateway'));
    expect(await api.classifyWaste('uploads/a.jpg')).toMatchObject({ source: 'fallback', materials: [] });
    fetchMock.mockResolvedValueOnce(res(200, { materials: [{ materialId: 'glass', confidence: 0.9 }], size: 'small', source: 'model' }));
    expect((await api.classifyWaste('uploads/a.jpg')).materials[0].materialId).toBe('glass');
    expect(call(1).url).toBe('http://api.test/ai/waste-classify');
  });

  it('collector endpoints', async () => {
    const { createApiCollectorService } = await boot();
    const api = createApiCollectorService();
    fetchMock.mockResolvedValue(res(200, []));
    await api.listNearbyJobs('u', { lat: 30.05, lng: 31.33, radiusM: 3000, materialId: 'glass' });
    expect(call().url).toBe('http://api.test/collector/jobs?lat=30.05&lng=31.33&radiusM=3000&materialId=glass');
    await api.listNearbyJobs('u', { lat: 30.05, lng: 31.33 });
    expect(call(1).url).toBe('http://api.test/collector/jobs?lat=30.05&lng=31.33');
    await api.getEarnings('u', { from: '2026-10-22T00:00:00Z', to: '2026-10-22T12:00:00Z' });
    expect(call(2).url).toContain('/collector/earnings?from=2026-10-22T00%3A00%3A00Z&to=');
    await api.getProfile('u');
    expect(call(3).url).toBe('http://api.test/collectors/me');
    fetchMock.mockResolvedValue(res(200, {}));
    await api.acceptJob('u', 'RCY-3003');
    expect(call(4)).toMatchObject({ url: 'http://api.test/collector/jobs/RCY-3003/accept', init: { method: 'POST' } });
    await api.startJob('u', 'RCY-3003');
    expect(call(5).url).toBe('http://api.test/collector/jobs/RCY-3003/start');
    const w = { materialId: 'glass' as const, kg: 2, source: 'manual' as const, clientId: 'c1' };
    await api.recordWeighing('u', 'RCY-3003', w);
    expect(call(6).url).toBe('http://api.test/collector/jobs/RCY-3003/weighings');
    expect(JSON.parse(call(6).init.body as string)).toEqual(w);
    await api.completeJob('u', 'RCY-3003', { paidToHouseholdEgp: 40 });
    expect(call(7).url).toBe('http://api.test/collector/jobs/RCY-3003/complete');
    expect(JSON.parse(call(7).init.body as string)).toEqual({ paidToHouseholdEgp: 40 });
  });

  it('409 on accept becomes "already taken" in the app language', async () => {
    const { createApiCollectorService, isAlreadyTaken, AlreadyTakenError } = await boot();
    const api = createApiCollectorService();
    fetchMock.mockResolvedValue(res(409, { detail: 'Job already taken' }));
    const err = await api.acceptJob('u', 'RCY-3003').catch((e: unknown) => e);
    expect(isAlreadyTaken(err)).toBe(true);
    expect(err).toBeInstanceOf(AlreadyTakenError);
    expect((err as Error).message).toBe('اتاخد خلاص');
  });
});
