import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PLACE } from '@/domain/locations';
import type { LatLng, Place } from '@/domain/types';

export type LocationState = 'locating' | 'gps' | 'fallback';

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

async function addressFor(lat: number, lng: number): Promise<string> {
  try {
    const [a] = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }), 4000);
    const line = [a?.street ?? a?.name, a?.district ?? a?.subregion ?? a?.city].filter(Boolean).join('، ');
    if (line.length >= 3) return line;
  } catch {
    // reverse geocoding is best effort
  }
  return 'موقعك الحالي';
}

/**
 * Current GPS position for the report. On denial, timeout or any failure it falls back to `fallback`
 * (the centre of the citizen's saved district, else Nasr City) with an EMPTY address: the citizen has to
 * type the street, so a report can never go out with a street they did not write.
 */
export function useReportLocation(fallback: LatLng = DEFAULT_PLACE) {
  const [state, setState] = useState<LocationState>('locating');
  const [place, setPlace] = useState<Place>({ lat: fallback.lat, lng: fallback.lng, address: '' });
  const edited = useRef(false);

  const resolve = useCallback(async (): Promise<{ state: LocationState; coords?: { lat: number; lng: number; address: string } }> => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('denied');
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 10000);
      const { latitude: lat, longitude: lng } = pos.coords;
      return { state: 'gps', coords: { lat, lng, address: await addressFor(lat, lng) } };
    } catch {
      return { state: 'fallback' };
    }
  }, []);

  const apply = useCallback((r: Awaited<ReturnType<typeof resolve>>) => {
    if (r.coords) {
      const { lat, lng, address } = r.coords;
      setPlace((prev) => ({ lat, lng, address: edited.current ? prev.address : address, landmark: prev.landmark }));
    } else {
      setPlace((prev) => ({ lat: fallback.lat, lng: fallback.lng, address: edited.current ? prev.address : '', landmark: prev.landmark }));
    }
    setState(r.state);
  }, [fallback.lat, fallback.lng]);

  /** Retry from the "حدد موقعي تاني" button. */
  const locate = useCallback(async () => {
    setState('locating');
    apply(await resolve());
  }, [apply, resolve]);

  useEffect(() => {
    let cancelled = false;
    void resolve().then((r) => {
      if (!cancelled) apply(r);
    });
    return () => {
      cancelled = true;
    };
  }, [resolve, apply]);

  const setAddress = useCallback((address: string) => {
    edited.current = true;
    setPlace((p) => ({ ...p, address }));
  }, []);
  const setLandmark = useCallback((landmark: string) => setPlace((p) => ({ ...p, landmark })), []);

  return { place, state, locate, setAddress, setLandmark };
}
