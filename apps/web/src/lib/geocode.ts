// Street name for a point, for the report's address line (the web side of the app's reverseGeocodeAsync).
// Uses an OSM Nominatim-compatible reverse endpoint; NEXT_PUBLIC_GEOCODER_URL="off" turns it off.
// Nominatim's public server allows about one request a second, so answers are cached and callers debounce.

export const GEOCODER_URL = process.env.NEXT_PUBLIC_GEOCODER_URL || 'https://nominatim.openstreetmap.org/reverse';

type NominatimAddress = Partial<
  Record<'road' | 'pedestrian' | 'house_number' | 'neighbourhood' | 'suburb' | 'quarter' | 'city_district' | 'city' | 'town' | 'village', string>
>;

/** "شارع مصطفى النحاس، الحي السابع": street (with number) then the most local area name. */
export function formatAddress(a: NominatimAddress | undefined): string | null {
  if (!a) return null;
  const road = a.road ?? a.pedestrian;
  const street = road ? [road, a.house_number].filter(Boolean).join(' ') : null;
  const area = a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.city ?? a.town ?? a.village;
  const line = [street, area].filter(Boolean).join('، ');
  return line.length >= 3 ? line : null;
}

const cache = new Map<string, string | null>();

/** Best effort: null on any failure, timeout (4 s, like the app) or when turned off. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (GEOCODER_URL === 'off') return null;
  // ~10 m grid: a small pin nudge reuses the previous answer.
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const url = `${GEOCODER_URL}?format=jsonv2&zoom=18&addressdetails=1&accept-language=ar&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const line = formatAddress(((await res.json()) as { address?: NominatimAddress }).address);
    cache.set(key, line);
    return line;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
