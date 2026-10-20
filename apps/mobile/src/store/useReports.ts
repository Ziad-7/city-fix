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

export const useReports = create<ReportsState>((set, get) => ({
  status: 'idle',
  error: null,
  reports: [],
  incidents: [],
  lastSubmitted: null,

  async refresh() {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const [reports, incidents] = await Promise.all([
        services.incidents.listMyReports(uid()),
        services.incidents.listIncidents(),
      ]);
      set({ reports, incidents, status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : 'حصلت مشكلة، جرّب تاني' });
    }
  },

  async submitReport(input) {
    const res = await services.incidents.submitReport(uid(), input);
    set((s) => ({
      reports: [res.report, ...s.reports],
      incidents: upsertIncident(s.incidents, res.incident),
      lastSubmitted: res,
    }));
    return res;
  },

  async followIncident(incidentId) {
    const inc = await services.incidents.followIncident(uid(), incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc) }));
  },

  async simulateProgress(incidentId) {
    const inc = await services.incidents.simulateProgress(incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc) }));
  },

  reset: () => set({ status: 'idle', error: null, reports: [], incidents: [], lastSubmitted: null }),
}));
