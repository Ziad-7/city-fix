import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PLACE } from '@/domain/locations';
import type { LatLng, Place } from '@/domain/types';
import { addressAfterMove, formatAddress } from './address';

export type LocationState = 'locating' | 'gps' | 'fallback';

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> => {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
};

async function geocode(lat: number, lng: number): Promise<string> {
  try {
    const [a] = await withTimeout(Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }), 4000);
    return formatAddress(a);
  } catch {
    return ''; // reverse geocoding is best effort
  }
}

async function addressFor(lat: number, lng: number): Promise<string> {
  return (await geocode(lat, lng)) || 'موقعك الحالي';
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
  const moveTicket = useRef(0);

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
  // A GPS fix that arrives after the citizen moved the pin must not throw the pin back (slow GPS, 10 s timeout):
  // `moveTicket` changes on every pin move and every new locate, and a stale fix only ends the spinner.
  const applyUnlessMoved = useCallback(
    (ticket: number, r: Awaited<ReturnType<typeof resolve>>) => {
      if (ticket === moveTicket.current) apply(r);
      else setState(r.state);
    },
    [apply],
  );

  const locate = useCallback(async () => {
    edited.current = false;
    const ticket = ++moveTicket.current; // also drops the address of a pin move still being geocoded
    setState('locating');
    applyUnlessMoved(ticket, await resolve());
  }, [applyUnlessMoved, resolve]);

  useEffect(() => {
    let cancelled = false;
    const ticket = moveTicket.current;
    void resolve().then((r) => {
      if (!cancelled) applyUnlessMoved(ticket, r);
    });
    return () => {
      cancelled = true;
    };
  }, [resolve, applyUnlessMoved]);

  /** The citizen tapped/dragged the pin: move the place and refresh the address line (best effort). */
  const moveTo = useCallback(async (lat: number, lng: number) => {
    const ticket = ++moveTicket.current;
    edited.current = false;
    setPlace((p) => ({ ...p, lat, lng }));
    const geocoded = await geocode(lat, lng);
    if (ticket !== moveTicket.current) return; // a newer move superseded this one
    setPlace((p) => ({ ...p, address: addressAfterMove(geocoded, p.address) }));
  }, []);

  const setAddress = useCallback((address: string) => {
    edited.current = true;
    setPlace((p) => ({ ...p, address }));
  }, []);
  const setLandmark = useCallback((landmark: string) => setPlace((p) => ({ ...p, landmark })), []);

  return { place, state, locate, moveTo, setAddress, setLandmark };
}
