import { http } from '@/lib/http';
import type { MapPin } from '@/domain/types';

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
