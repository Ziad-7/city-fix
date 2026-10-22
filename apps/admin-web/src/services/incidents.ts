import { http } from '@/lib/http';
import type { AdminIncident } from '@/domain/admin-types';

export async function getIncidents(params?: {
  status?: string;
  categoryId?: string;
  department?: string;
  critical?: boolean;
  overdue?: boolean;
  q?: string;
}): Promise<AdminIncident[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.categoryId) searchParams.append('categoryId', params.categoryId);
  if (params?.department) searchParams.append('department', params.department);
  if (params?.critical) searchParams.append('critical', '1');
  if (params?.overdue) searchParams.append('overdue', '1');
  if (params?.q) searchParams.append('q', params.q);

  const qs = searchParams.toString();
  const result = await http<AdminIncident[]>('GET', `/admin/incidents${qs ? '?' + qs : ''}`);
  return result || [];
}

export async function getIncident(id: string): Promise<AdminIncident> {
  const result = await http<AdminIncident>('GET', `/admin/incidents/${id}`);
  if (!result) throw new Error('No incident returned');
  return result;
}

export async function patchIncident(
  id: string,
  data: {
    status?: string;
    severity?: string;
    categoryId?: string;
    department?: string;
    note?: string;
  },
): Promise<AdminIncident> {
  const result = await http<AdminIncident>('PATCH', `/admin/incidents/${id}`, data);
  if (!result) throw new Error('No incident returned');
  return result;
}

export async function confirmTriage(
  id: string,
  data: { categoryId?: string; severity?: string },
): Promise<AdminIncident> {
  const result = await http<AdminIncident>('POST', `/admin/incidents/${id}/triage/confirm`, data);
  if (!result) throw new Error('No incident returned');
  return result;
}

/**
 * `GET /admin/incidents/{id}/similar` answers `DuplicateMatch[]` (the contract), but the detail page needs full
 * incidents (location, linked reports), so each match is resolved with `GET /admin/incidents/{id}`. A match that
 * cannot be read (merged away, out of the staff member's department) is dropped instead of failing the page.
 */
export async function getSimilarIncidents(id: string): Promise<AdminIncident[]> {
  const matches = await http<{ incidentId: string }[]>('GET', `/admin/incidents/${id}/similar`);
  const found = await Promise.all(
    (matches ?? []).map((m) => getIncident(m.incidentId).catch(() => null)),
  );
  return found.filter((inc): inc is AdminIncident => inc !== null);
}

export async function mergeIncidents(
  sourceId: string,
  intoIncidentId: string,
): Promise<AdminIncident> {
  const result = await http<AdminIncident>('POST', `/admin/incidents/${sourceId}/merge`, { intoIncidentId });
  if (!result) throw new Error('No incident returned');
  return result;
}
