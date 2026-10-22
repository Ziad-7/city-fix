import { newIdempotencyKey, persistReportFiles } from '../media';
import type { NewReportInput } from '@/domain/types';

const mockRes = (body: unknown): Response =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(body) }) as unknown as Response;

const api = () => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  return jest.requireActual<typeof import('../api')>('../api').createApiServices();
};

describe('Idempotency-Key', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(mockRes({}));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });
  const headersOf = (call: number) => (fetchMock.mock.calls[call][1] as { headers: Record<string, string> }).headers;

  it('keys look like UUID v4 and differ', () => {
    expect(newIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });

  it('is sent on POST /reports and POST /recycling/pickups', async () => {
    const s = api();
    await s.incidents.submitReport('u', {} as never, 'key-1');
    await s.recycling.create('u', {} as never, 'key-2');
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/reports');
    expect(headersOf(0)['Idempotency-Key']).toBe('key-1');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/recycling/pickups');
    expect(headersOf(1)['Idempotency-Key']).toBe('key-2');
  });

  it('is left out when no key is given', async () => {
    await api().incidents.submitReport('u', {} as never);
    expect(headersOf(0)['Idempotency-Key']).toBeUndefined();
  });
});

describe('waste classify consent', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(mockRes({ materials: [{ id: 'paper', confidence: 0.9 }], size: 'small', source: 'model' }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });
  it('sends photoConsent: true only when consented, and calls nothing otherwise', async () => {
    const s = api();
    const none = await s.waste.classify('p/1.jpg');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(none.materials).toEqual([]);
    await s.waste.classify('p/1.jpg', true);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)).toEqual({ path: 'p/1.jpg', photoConsent: true });
  });
});

describe('persistReportFiles', () => {
  const input: NewReportInput = {
    categoryId: 'pothole',
    description: 'حفرة',
    photoUris: ['file:///cache/a.jpg', 'reports/uploaded.jpg', 'file:///cache/b.jpg'],
    voiceNoteUri: 'file:///cache/v.m4a',
    location: { lat: 30, lng: 31, address: 'x' },
    anonymous: false,
    blurFaces: true,
  };
  it('copies local files, leaves server paths, and keeps the original when a copy fails', async () => {
    const persist = jest.fn(async (u: string) => {
      if (u.endsWith('b.jpg')) throw new Error('disk');
      return u.replace('/cache/', '/documents/outbox/');
    });
    const out = await persistReportFiles(input, persist);
    expect(out.photoUris).toEqual(['file:///documents/outbox/a.jpg', 'reports/uploaded.jpg', 'file:///cache/b.jpg']);
    expect(out.voiceNoteUri).toBe('file:///documents/outbox/v.m4a');
    expect(persist).toHaveBeenCalledTimes(3);
  });
});
