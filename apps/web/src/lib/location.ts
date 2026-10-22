'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PLACE } from '@/domain/locations';
import type { LatLng, Place } from '@/domain/types';

// Web port of apps/mobile/src/components/report/location.ts (browser geolocation instead of expo-location).
export type LocationState = 'locating' | 'gps' | 'fallback';

/** What a GPS fix shows as the address: the citizen's coordinates are never sent to a street-name service (see README, Privacy). */
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
 * so a report never goes out with a street they did not write. A GPS fix shows the "موقعك الحالي" placeholder (the
 * citizen can type the street); the coordinates stay on the device and go only to our own report API.
 */
export function useReportLocation(fallback: LatLng = DEFAULT_PLACE) {
  const [state, setState] = useState<LocationState>('locating');
  const [place, setPlace] = useState<Place>({ lat: fallback.lat, lng: fallback.lng, address: '' });
  const edited = useRef(false);

  const locate = useCallback(async () => {
    setState('locating');
    try {
      const { lat, lng } = await currentPosition(10_000);
      setPlace((prev) => ({ lat, lng, address: edited.current ? prev.address : CURRENT_LOCATION_LABEL, landmark: prev.landmark }));
      setState('gps');
    } catch {
      setPlace((prev) => ({ lat: fallback.lat, lng: fallback.lng, address: edited.current ? prev.address : '', landmark: prev.landmark }));
      setState('fallback');
    }
  }, [fallback.lat, fallback.lng]);

  useEffect(() => {
    void locate();
  }, [locate]);

  const setAddress = useCallback((address: string) => {
    edited.current = true;
    setPlace((p) => ({ ...p, address }));
  }, []);
  const setLandmark = useCallback((landmark: string) => setPlace((p) => ({ ...p, landmark })), []);
  /** Pin dragged or map clicked: only the point moves. The address stays what the citizen sees or typed. */
  const setPoint = useCallback((pt: LatLng) => setPlace((p) => ({ ...p, lat: pt.lat, lng: pt.lng })), []);

  return { place, state, locate, setAddress, setLandmark, setPoint };
}
