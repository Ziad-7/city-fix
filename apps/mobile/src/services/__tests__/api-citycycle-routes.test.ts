/** The CityCycle API client must call the routes the backend serves (docs/api-contract.md, backend/app/routers/recycling.py, bins.py). */
const res = (status: number, body: unknown = {}): Response =>
  ({ ok: status < 300, status, text: async () => (status === 204 ? '' : JSON.stringify(body)) }) as unknown as Response;

describe('CityCycle API routes', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(res(200, []));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  });
  const api = () => {
    jest.resetModules();
    return jest.requireActual<typeof import('../api')>('../api').createApiServices();
  };
  const last = () => {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { method: string; body?: string }];
    return { url: url.replace('http://api.test', ''), method: init.method, body: init.body ? JSON.parse(init.body) : undefined };
  };

  it('citizen routes', async () => {
    const s = api();
    await s.recycling.materials('مدينة نصر');
    expect(last()).toMatchObject({ method: 'GET', url: expect.stringMatching(/^\/recycling\/materials\?district=/) });
    await s.recycling.listMine('u');
    expect(last()).toMatchObject({ method: 'GET', url: '/recycling/pickups' });
    await s.recycling.get('REC-1');
    expect(last()).toMatchObject({ method: 'GET', url: '/recycling/pickups/REC-1' });
    await s.recycling.cancel('u', 'REC-1', 'x');
    expect(last()).toMatchObject({ method: 'POST', url: '/recycling/pickups/REC-1/cancel', body: { note: 'x' } });
    await s.recycling.confirm('u', 'REC-1');
    expect(last()).toMatchObject({ method: 'POST', url: '/recycling/pickups/REC-1/confirm' });
    await s.recycling.impact('u');
    expect(last()).toMatchObject({ method: 'GET', url: '/me/impact?as=citizen' });
  });

  it('collector routes', async () => {
    const s = api();
    await s.collector.apply('u', { name: 'أحمد', district: 'مدينة نصر', materials: ['glass'] });
    expect(last()).toMatchObject({ method: 'POST', url: '/collectors/apply' });
    await s.collector.jobs('u', { lat: 30.05, lng: 31.3, radiusM: 3000, materialId: 'glass' });
    expect(last()).toMatchObject({ method: 'GET', url: '/collector/jobs?lat=30.05&lng=31.3&radiusM=3000&materialId=glass' });
    await s.collector.myPickups('u');
    expect(last().url).toBe('/collector/pickups');
    await s.collector.accept('u', 'REC-1');
    expect(last()).toMatchObject({ method: 'POST', url: '/collector/jobs/REC-1/accept' });
    await s.collector.addWeighing('u', 'REC-1', { materialId: 'glass', kg: 2, source: 'manual', clientId: 'c1' });
    expect(last()).toMatchObject({ method: 'POST', url: '/collector/jobs/REC-1/weighings', body: { clientId: 'c1', source: 'manual' } });
    await s.collector.complete('u', 'REC-1', 20);
    expect(last()).toMatchObject({ method: 'POST', url: '/collector/jobs/REC-1/complete', body: { paidToHouseholdEgp: 20 } });
    await s.collector.earnings('u', { from: '2026-10-01', to: '2026-10-31' });
    expect(last().url).toBe('/collector/earnings?from=2026-10-01&to=2026-10-31');
  });

  it('bins and a missing collector profile', async () => {
    const s = api();
    await s.bins.list();
    expect(last()).toMatchObject({ method: 'GET', url: '/bins' });
    fetchMock.mockResolvedValue(res(204));
    await s.bins.reportFull('u', 'BIN-1', { note: 'مليانة' });
    expect(last()).toMatchObject({ method: 'POST', url: '/bins/BIN-1/report-full', body: { note: 'مليانة' } });
    fetchMock.mockResolvedValue(res(404, { detail: 'مش موجود' }));
    await expect(s.collector.me('u')).resolves.toBeNull();
  });
});
