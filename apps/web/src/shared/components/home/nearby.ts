import { isOpenStatus, type Incident, type LatLng } from '@/domain/types';
import { haversineM } from '@/utils/geo';

export type NearbyIncident = { incident: Incident; distanceM: number };

/**
 * "حوالين بيتك": open incidents the user did not report, nearest first.
 * `mineIncidentIds` = incident ids of the user's own reports.
 */
export function selectNearby(
  incidents: Incident[],
  mineIncidentIds: ReadonlySet<string>,
  center: LatLng,
  limit = 2,
): NearbyIncident[] {
  return incidents
    .filter((i) => isOpenStatus(i.status) && !mineIncidentIds.has(i.id))
    .map((incident) => ({ incident, distanceM: haversineM(center, incident.location) }))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}
