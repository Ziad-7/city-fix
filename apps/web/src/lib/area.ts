'use client';

import { useMemo } from 'react';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { LatLng } from '@/domain/types';
import { useSession } from '@/store';

/** Centre of the citizen's saved district (Nasr City when unknown): "around you", map start, report fallback. */
export function useAreaCenter(): LatLng {
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  return useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);
}
