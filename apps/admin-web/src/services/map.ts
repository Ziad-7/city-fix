import { http, isMissingRoute } from '@/lib/http';
import type { MapPin } from '@/domain/types';
import type { HotspotsResponse } from '@/domain/admin-types';

export async function getMapIncidents(params?: {
  status?: string;
  categoryId?: string;
  bbox?: string;
}): Promise<MapPin[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
  if (params?.bbox) searchParams.append('bbox', params.bbox);

  const qs = searchParams.toString();
  const result = await http<MapPin[]>('GET', `/map/incidents${qs ? '?' + qs : ''}`);
  return result || [];
}

/** null only when this server has no hotspots route; every other failure is thrown. */
export async function getHotspots(params?: {
  days?: number;
  radiusMeters?: number;
  minCount?: number;
}): Promise<HotspotsResponse | null> {
  const qs = new URLSearchParams();
  if (params?.days) qs.set('days', String(params.days));
  if (params?.radiusMeters) qs.set('radiusMeters', String(params.radiusMeters));
  if (params?.minCount) qs.set('minCount', String(params.minCount));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  try {
    return (await http<HotspotsResponse>('GET', `/admin/hotspots${suffix}`)) ?? null;
  } catch (e) {
    if (isMissingRoute(e)) return null;
    throw e;
  }
}
