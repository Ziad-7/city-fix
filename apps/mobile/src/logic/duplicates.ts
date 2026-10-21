import { haversineM, type LatLng } from '@/utils/geo';
import { isOpenStatus, type AlreadyReported, type CategoryId, type DuplicateMatch, type Incident, type TriageSuggestion } from '@/domain/types';

export const DUPLICATE_RADIUS_M = 250;

/** Open incidents of the given categories within 250 m, nearest first. */
export function findDuplicates(
  incidents: Incident[],
  categoryId: CategoryId | readonly CategoryId[],
  at: LatLng,
  radiusM: number = DUPLICATE_RADIUS_M,
): DuplicateMatch[] {
  const categories = typeof categoryId === 'string' ? [categoryId] : categoryId;
  return incidents
    .filter((i) => categories.includes(i.categoryId) && isOpenStatus(i.status))
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

export type DuplicateSplit = { duplicates: DuplicateMatch[]; alreadyReported: AlreadyReported[] };

/**
 * Splits nearby matches by the caller's relation to them.
 * - reported by the caller (`ownReportByIncident`): returned as `alreadyReported`, with their report id;
 * - followed by the caller (`followingIds`): dropped, there is nothing left to offer;
 * - everything else: a joinable duplicate.
 */
export function splitByUser(
  matches: DuplicateMatch[],
  ownReportByIncident: ReadonlyMap<string, string>,
  followingIds: ReadonlySet<string>,
): DuplicateSplit {
  const duplicates: DuplicateMatch[] = [];
  const alreadyReported: AlreadyReported[] = [];
  for (const m of matches) {
    const reportId = ownReportByIncident.get(m.incidentId);
    if (reportId) alreadyReported.push({ incidentId: m.incidentId, reportId, title: m.title, categoryId: m.categoryId, distanceM: m.distanceM });
    else if (!followingIds.has(m.incidentId)) duplicates.push(m);
  }
  return { duplicates, alreadyReported };
}

export type DuplicateView =
  | { kind: 'none' }
  | { kind: 'own'; own: AlreadyReported }
  | { kind: 'join'; match: DuplicateMatch };

/**
 * What the report form shows for the category that will actually be submitted:
 * the nearest same-category open incident decides. If that is the citizen's own report, show the
 * "already reported" note; otherwise offer to join the nearest joinable duplicate.
 */
export function pickDuplicateView(suggestion: Pick<TriageSuggestion, 'duplicates' | 'alreadyReported'> | null, categoryId: CategoryId | null): DuplicateView {
  if (!suggestion || !categoryId) return { kind: 'none' };
  const match = suggestion.duplicates.find((d) => d.categoryId === categoryId);
  const own = (suggestion.alreadyReported ?? []).find((d) => d.categoryId === categoryId);
  if (own && (!match || own.distanceM <= match.distanceM)) return { kind: 'own', own };
  if (match) return { kind: 'join', match };
  return { kind: 'none' };
}
