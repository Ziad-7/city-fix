'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PLACE } from '@/domain/locations';
import type { LatLng, Place } from '@/domain/types';
import { reverseGeocode } from './geocode';

// Web port of apps/mobile/src/components/report/location.ts (browser geolocation instead of expo-location).
export type LocationState = 'locating' | 'gps' | 'fallback';

/** What a GPS fix shows when reverse geocoding finds no street (same placeholder as the app). */
export const CURRENT_LOCATION_LABEL = 'موقعك الحالي';

function currentPosition(timeoutMs: number): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    // The browser's own timeout only starts after the permission prompt is answered: cap the whole wait.
    const guard = setTimeout(() => reject(new Error('timeout')), timeoutMs + 5_000);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      clearTimeout(guard);
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(guard);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => {
        clearTimeout(guard);
        reject(e);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/**
 * Current position for the report. On denial, timeout or any failure it falls back to `fallback`
 * (the centre of the citizen's saved district) with an EMPTY address: the citizen has to type the street,
 * so a report never goes out with a street they did not write. A GPS fix gets its street from reverseGeocode.
 */
export function useReportLocation(fallback: LatLng = DEFAULT_PLACE) {
  const [state, setState] = useState<LocationState>('locating');
  const [place, setPlace] = useState<Place>({ lat: fallback.lat, lng: fallback.lng, address: '' });
  const edited = useRef(false);

  // Each fix or pin move bumps this, so a slow geocoder answer for an older point is dropped.
  const seq = useRef(0);
  const pinTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fill = useCallback(async (lat: number, lng: number) => {
    const mine = ++seq.current;
    const line = await reverseGeocode(lat, lng);
    if (mine !== seq.current || edited.current) return;
    setPlace((prev) => ({ ...prev, address: line ?? CURRENT_LOCATION_LABEL }));
  }, []);

  const locate = useCallback(async () => {
    setState('locating');
    try {
      const { lat, lng } = await currentPosition(10_000);
      setPlace((prev) => ({ lat, lng, address: edited.current ? prev.address : CURRENT_LOCATION_LABEL, landmark: prev.landmark }));
      setState('gps');
      void fill(lat, lng);
    } catch {
      seq.current++;
      setPlace((prev) => ({ lat: fallback.lat, lng: fallback.lng, address: edited.current ? prev.address : '', landmark: prev.landmark }));
      setState('fallback');
    }
  }, [fallback.lat, fallback.lng, fill]);

  useEffect(() => {
    void locate();
  }, [locate]);

  const setAddress = useCallback((address: string) => {
    edited.current = true;
    setPlace((p) => ({ ...p, address }));
  }, []);
  const setLandmark = useCallback((landmark: string) => setPlace((p) => ({ ...p, landmark })), []);
  /**
   * Pin dragged or map clicked. After a GPS fix the street follows the pin until the citizen types one;
   * on the fallback point the address stays theirs to write, like the app.
   */
  const setPoint = useCallback(
    (pt: LatLng) => {
      setPlace((p) => ({ ...p, lat: pt.lat, lng: pt.lng }));
      if (state !== 'gps' || edited.current) return;
      // Nominatim allows about a request a second: wait until the pin stops moving.
      clearTimeout(pinTimer.current);
      pinTimer.current = setTimeout(() => void fill(pt.lat, pt.lng), 700);
    },
    [state, fill],
  );
  useEffect(() => () => clearTimeout(pinTimer.current), []);

  return { place, state, locate, setAddress, setLandmark, setPoint };
}
