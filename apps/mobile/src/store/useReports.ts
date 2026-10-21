import { useMemo } from 'react';
import { create } from 'zustand';
import type { Incident, NewReportInput, Report } from '@/domain/types';
import { services } from '@/services';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type ReportsState = {
  status: LoadStatus;
  error: string | null;
  /** My reports, newest first. */
  reports: Report[];
  /** All city incidents (home "around you", map, request detail). */
  incidents: Incident[];
  /** Ids of incidents the user follows ("أنا كمان" or joined by reporting). Shared by Home, map and detail. */
  followingIds: string[];
  /** Result of the latest submitReport, read by the success screen. */
  lastSubmitted: { report: Report; incident: Incident } | null;
  refresh: () => Promise<void>;
  submitReport: (input: NewReportInput) => Promise<{ report: Report; incident: Incident }>;
  /** "أنا كمان" */
  followIncident: (incidentId: string) => Promise<void>;
  /** Dev only: advance an incident to its next status. */
  simulateProgress: (incidentId: string) => Promise<void>;
  reset: () => void;
};

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error('لازم تسجّل دخول الأول');
  return id;
};

const upsertIncident = (list: Incident[], inc: Incident) =>
  list.some((i) => i.id === inc.id) ? list.map((i) => (i.id === inc.id ? inc : i)) : [inc, ...list];

const addId = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

export const useReports = create<ReportsState>((set, get) => ({
  status: 'idle',
  error: null,
  reports: [],
  incidents: [],
  followingIds: [],
  lastSubmitted: null,

  async refresh() {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const userId = uid();
      const [reports, incidents, followingIds] = await Promise.all([
        services.incidents.listMyReports(userId),
        services.incidents.listIncidents(),
        services.incidents.listFollowing(userId),
      ]);
      set({ reports, incidents, followingIds, status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'حصلت مشكلة، جرّب تاني' });
    }
  },

  async submitReport(input) {
    const res = await services.incidents.submitReport(uid(), input);
    set((s) => ({
      reports: [res.report, ...s.reports],
      incidents: upsertIncident(s.incidents, res.incident),
      followingIds: addId(s.followingIds, res.incident.id),
      lastSubmitted: res,
    }));
    return res;
  },

  async followIncident(incidentId) {
    const inc = await services.incidents.followIncident(uid(), incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc), followingIds: addId(s.followingIds, inc.id) }));
  },

  async simulateProgress(incidentId) {
    const inc = await services.incidents.simulateProgress(incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc) }));
  },

  reset: () => set({ status: 'idle', error: null, reports: [], incidents: [], followingIds: [], lastSubmitted: null }),
}));

/** Incident ids the user follows or reported, from the store (not screen-local state). */
export function useFollowingSet(): ReadonlySet<string> {
  const followingIds = useReports((s) => s.followingIds);
  const reports = useReports((s) => s.reports);
  return useMemo(() => new Set([...followingIds, ...reports.map((r) => r.incidentId)]), [followingIds, reports]);
}
