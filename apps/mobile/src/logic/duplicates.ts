import { haversineM, type LatLng } from '@/utils/geo';
import { isOpenStatus, type CategoryId, type DuplicateMatch, type Incident } from '@/domain/types';

export const DUPLICATE_RADIUS_M = 250;

/** Open incidents of the same category within 250 m, nearest first. */
export function findDuplicates(
  incidents: Incident[],
  categoryId: CategoryId,
  at: LatLng,
  radiusM: number = DUPLICATE_RADIUS_M,
): DuplicateMatch[] {
  return incidents
    .filter((i) => i.categoryId === categoryId && isOpenStatus(i.status))
    .map((i) => ({ i, d: haversineM(at, i.location) }))
    .filter(({ d }) => d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .map(({ i, d }) => ({
      incidentId: i.id,
      title: i.title,
      categoryId: i.categoryId,
      distanceM: Math.round(d),
      followers: i.followers,
      status: i.status,
    }));
}
