import { useMemo } from 'react';
import { pickupChipStatus, type RecyclingPickup } from '@/domain/citycycle';
import { getCategory } from '@/domain/categories';
import { SERVICE_TITLE_AR } from '@/domain/services-catalog';
import type { CategoryId, Incident, IncidentStatus, Report, ServiceRequest } from '@/domain/types';
import { pickupTitle } from '@/components/recycle/pickup';
import { useLang } from '@/i18n';
import { labelOfCategory, serviceTypeLabel } from '@/i18n/labels';
import { useCityCycle } from './useCityCycle';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';

/**
 * One row of "طلباتي": a report (with its incident), a service request or a recycling pickup.
 * A pickup's `status` is the incident status its pickup status maps to (so the open / fixed filters and chip colours work).
 */
export type RequestItem =
  | { kind: 'report'; id: string; title: string; status: IncidentStatus; createdAt: string; categoryId: CategoryId; report: Report; incident: Incident | null }
  | { kind: 'service'; id: string; title: string; status: IncidentStatus; createdAt: string; request: ServiceRequest }
  | { kind: 'pickup'; id: string; title: string; status: IncidentStatus; createdAt: string; pickup: RecyclingPickup };

/** Pure merge of the three stores' data, newest first. Titles follow the app language at call time. */
export function buildRequestItems(data: { reports: Report[]; incidents: Incident[]; requests: ServiceRequest[]; pickups?: RecyclingPickup[] }): RequestItem[] {
  const byId = new Map(data.incidents.map((i) => [i.id, i]));
  const items: RequestItem[] = [
    ...data.reports.map((report): RequestItem => {
      const incident = byId.get(report.incidentId) ?? null;
      return {
        kind: 'report',
        id: report.id,
        title: incident?.title ?? labelOfCategory(getCategory(report.categoryId)),
        status: incident?.status ?? 'received',
        createdAt: report.createdAt,
        categoryId: report.categoryId,
        report,
        incident,
      };
    }),
    ...data.requests.map((request): RequestItem => ({
      kind: 'service',
      id: request.id,
      title: serviceTypeLabel(request.serviceType, SERVICE_TITLE_AR[request.serviceType]),
      status: request.status,
      createdAt: request.createdAt,
      request,
    })),
    ...(data.pickups ?? []).map((pickup): RequestItem => ({
      kind: 'pickup',
      id: pickup.id,
      title: pickupTitle(pickup.items),
      status: pickupChipStatus(pickup.status),
      createdAt: pickup.createdAt,
      pickup,
    })),
  ];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Merged, newest-first list for طلباتي and the home "آخر التحديثات". Titles follow the app language. */
export function useRequestItems(): RequestItem[] {
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);
  const requests = useServiceRequests((s) => s.requests);
  const pickups = useCityCycle((s) => s.pickups);
  const lang = useLang();
  return useMemo(
    () => buildRequestItems({ reports, incidents, requests, pickups }),
    // `lang` is not read inside, but the labels above are: recompute when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, incidents, requests, pickups, lang],
  );
}

/** Looks up one request by its id (FTC-… report id, SRV-… service request id or RCY-… recycling pickup id). */
export function useRequestItem(id: string | undefined): RequestItem | null {
  const items = useRequestItems();
  return useMemo(() => items.find((i) => i.id === id) ?? null, [items, id]);
}
