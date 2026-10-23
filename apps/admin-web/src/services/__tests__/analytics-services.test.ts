import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';
import { getBinForecast, registerBin } from '../bins';
import { getHotspots } from '../map';
import {
  getPayouts,
  getPickups,
  isCityCycleDemo,
  optimizeErrorMessage,
  optimizeRoutes,
  resetCityCycleDemo,
} from '../citycycle';

const reply = (status: number, body: unknown = { detail: 'x' }) => () =>
  Promise.resolve(new Response(status === 204 ? null : JSON.stringify(body), { status }));

const OPT = { pickupIds: ['RCY-1'], depot: { lat: 30, lng: 31 }, vehicleCount: 1, capacityKg: 100 };
const BIN = { id: 'B-1', name: 'حاوية', lat: 30, lng: 31 };

beforeEach(() => {
  resetCityCycleDemo();
  vi.stubGlobal('fetch', vi.fn(reply(404)));
});

describe('forecast and hotspots', () => {
  it.each([404, 405, 501])('return null when the route is missing (%i)', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    expect(await getBinForecast()).toBeNull();
    expect(await getHotspots()).toBeNull();
  });

  it.each([403, 500])('throw ApiError on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    await expect(getBinForecast()).rejects.toBeInstanceOf(ApiError);
    await expect(getHotspots()).rejects.toBeInstanceOf(ApiError);
  });

  it('sends the query parameters', async () => {
    const f = vi.fn(reply(200, { generatedAt: 'x', horizonHours: 12, items: [] }));
    vi.stubGlobal('fetch', f);
    await getBinForecast(12);
    await getHotspots({ days: 30 });
    expect(String((f.mock.calls as unknown[][])[0][0])).toContain('/admin/bins/forecast?horizonHours=12');
    expect(String((f.mock.calls as unknown[][])[1][0])).toContain('/admin/hotspots?days=30');
  });
});

describe('registerBin', () => {
  it.each([404, 403])('rejects on %i with no fallback', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    await expect(registerBin(BIN)).rejects.toMatchObject({ status });
  });

  it('returns the device key on 201', async () => {
    vi.stubGlobal('fetch', vi.fn(reply(201, { bin: { id: 'B-1' }, deviceKey: 'k-123' })));
    expect((await registerBin(BIN)).deviceKey).toBe('k-123');
  });
});

describe('optimizeRoutes', () => {
  it.each([404, 503])('rejects on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    await expect(optimizeRoutes(OPT)).rejects.toMatchObject({ status });
    expect(isCityCycleDemo()).toBe(false);
  });

  it('rejects with 501 without calling fetch when pickups are demo', async () => {
    await getPickups(); // 404 -> demo
    expect(isCityCycleDemo()).toBe(true);
    const f = vi.fn(reply(200, {}));
    vi.stubGlobal('fetch', f);
    await expect(optimizeRoutes(OPT)).rejects.toMatchObject({ status: 501 });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('getPayouts', () => {
  it('falls back to weights already in the demo pickups, with no invented money', async () => {
    const rows = await getPayouts();
    expect(isCityCycleDemo()).toBe(true);
    expect(rows).toEqual([
      { collectorId: 'COL-1', collectorName: 'محمود', kg: 7.5, valueEgp: 0, paidToHouseholdsEgp: 0, jobs: 1 },
    ]);
  });

  it.each([403, 500])('does not fall back on %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn(reply(status)));
    await expect(getPayouts()).rejects.toBeInstanceOf(ApiError);
    expect(isCityCycleDemo()).toBe(false);
  });

  it('passes the date range', async () => {
    const f = vi.fn(reply(200, []));
    vi.stubGlobal('fetch', f);
    await getPayouts({ from: '2026-10-01', to: '2026-10-31' });
    expect(String((f.mock.calls as unknown[][])[0][0])).toContain('/admin/payouts?from=2026-10-01&to=2026-10-31');
  });
});

describe('optimizeErrorMessage', () => {
  it('maps statuses to Arabic messages', () => {
    expect(optimizeErrorMessage(new ApiError(503, 'x'))).toContain('OR-Tools');
    expect(optimizeErrorMessage(new ApiError(409, 'x'))).toContain('اتغيّر');
    expect(optimizeErrorMessage(new ApiError(404, 'x'))).toContain('مش موجود');
    expect(optimizeErrorMessage(new ApiError(501, 'x'))).toContain('مفيهوش');
    expect(optimizeErrorMessage(new ApiError(405, 'x'))).toContain('مفيهوش');
    expect(optimizeErrorMessage(new ApiError(422, 'سعة غلط'))).toBe('سعة غلط');
    expect(optimizeErrorMessage(new Error('boom'))).toBe('boom');
  });
});
