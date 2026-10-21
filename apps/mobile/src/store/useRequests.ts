import { useMemo } from 'react';
import { getCategory } from '@/domain/categories';
import { SERVICE_TITLE_AR } from '@/domain/services-catalog';
import type { CategoryId, Incident, IncidentStatus, Report, ServiceRequest } from '@/domain/types';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';

/** One row of "طلباتي": a report (with its incident) or a service request. */
export type RequestItem =
  | { kind: 'report'; id: string; title: string; status: IncidentStatus; createdAt: string; categoryId: CategoryId; report: Report; incident: Incident | null }
  | { kind: 'service'; id: string; title: string; status: IncidentStatus; createdAt: string; request: ServiceRequest };

/** Merged, newest-first list for طلباتي and the home "آخر التحديثات". */
export function useRequestItems(): RequestItem[] {
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);
  const requests = useServiceRequests((s) => s.requests);
  return useMemo(() => {
    const byId = new Map(incidents.map((i) => [i.id, i]));
    const items: RequestItem[] = [
      ...reports.map((report): RequestItem => {
        const incident = byId.get(report.incidentId) ?? null;
        return {
          kind: 'report',
          id: report.id,
          title: incident?.title ?? getCategory(report.categoryId).labelAr,
          status: incident?.status ?? 'received',
          createdAt: report.createdAt,
          categoryId: report.categoryId,
          report,
          incident,
        };
      }),
      ...requests.map((request): RequestItem => ({
        kind: 'service',
        id: request.id,
        title: SERVICE_TITLE_AR[request.serviceType],
        status: request.status,
        createdAt: request.createdAt,
        request,
      })),
    ];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [reports, incidents, requests]);
}

/** Looks up one request by its id (FTC-… report id or SRV-… service request id). */
export function useRequestItem(id: string | undefined): RequestItem | null {
  const items = useRequestItems();
  return useMemo(() => items.find((i) => i.id === id) ?? null, [items, id]);
}
