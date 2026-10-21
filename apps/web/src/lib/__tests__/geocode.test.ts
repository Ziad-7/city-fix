import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatAddress, reverseGeocode } from '../geocode';

describe('formatAddress', () => {
  it('joins the street (with its number) and the most local area', () => {
    expect(formatAddress({ road: 'شارع مصطفى النحاس', house_number: '12', suburb: 'الحي السابع', city: 'القاهرة' })).toBe('شارع مصطفى النحاس 12، الحي السابع');
  });

  it('falls back to a wider area when there is no street', () => {
    expect(formatAddress({ city_district: 'مدينة نصر', city: 'القاهرة' })).toBe('مدينة نصر');
  });

  it('gives null when there is nothing usable', () => {
    expect(formatAddress({})).toBeNull();
    expect(formatAddress(undefined)).toBeNull();
  });
});

describe('reverseGeocode', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for Arabic names and caches by ~10 m', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ address: { road: 'شارع عباس العقاد', suburb: 'مدينة نصر' } })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await reverseGeocode(30.05611, 31.34012)).toBe('شارع عباس العقاد، مدينة نصر');
    expect(await reverseGeocode(30.05612, 31.34013)).toBe('شارع عباس العقاد، مدينة نصر');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('accept-language=ar');
  });

  it('is best effort: a failure gives null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await reverseGeocode(29.9, 31.2)).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect(await reverseGeocode(29.8, 31.2)).toBeNull();
  });
});
