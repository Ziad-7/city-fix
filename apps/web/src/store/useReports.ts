import { useMemo } from 'react';
import { create } from 'zustand';
import type { Incident, NewReportInput, Report } from '@/domain/types';
import { tr } from '@/i18n';
import { services } from '@/services';
import { classifyFailure, newIdempotencyKey, persistReportFiles } from '@/services/media';
import { persistLocalFile } from '@/services/persistFile';
import { isOffline } from '@/services/network';
import { sendReport } from '@/services/sendReport';
import { reloadOutbox, useOutbox, type OutboxItem } from './useOutbox';
import { useSession } from './useSession';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** `queued`: saved on the phone (offline or the server was unreachable); it is sent when the network is back. */
export type SubmitResult = ({ queued?: false } & { report: Report; incident: Incident }) | { queued: true; item: OutboxItem };

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
  submitReport: (input: NewReportInput) => Promise<SubmitResult>;
  /** Adds a report the server accepted (also used by the offline queue when it delivers one). */
  ingestSubmitted: (res: { report: Report; incident: Incident }, opts?: { last?: boolean }) => void;
  /** Deep link / uncached id: fetches one report and its incident. Resolves false when it does not exist. */
  loadReport: (id: string) => Promise<boolean>;
  /** "أنا كمان" */
  followIncident: (incidentId: string) => Promise<void>;
  /** Dev only: advance an incident to its next status. */
  simulateProgress: (incidentId: string) => Promise<void>;
  /** "افتح البلاغ تاني": a resolved incident goes back to received with the citizen's note. */
  reopenIncident: (incidentId: string, note: string) => Promise<void>;
  reset: () => void;
};

const uid = () => {
  const id = useSession.getState().userId;
  if (!id) throw new Error(tr('لازم تسجّل دخول الأول', 'Please sign in first'));
  return id;
};

const upsertIncident = (list: Incident[], inc: Incident) =>
  list.some((i) => i.id === inc.id) ? list.map((i) => (i.id === inc.id ? inc : i)) : [inc, ...list];

const addId = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

/**
 * Reports accepted while a refresh may have been in flight (form submit, offline queue), kept until a fetched list
 * contains them. Without this a refresh that started before the POST (sign-in refresh + queue flush, pull-to-refresh)
 * overwrites the list and the new report disappears until the next refresh.
 */
const unconfirmed = new Map<string, { report: Report; incident: Incident }>();

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
      let merged = { reports, incidents, followingIds };
      for (const [id, res] of unconfirmed) {
        if (reports.some((r) => r.id === id)) {
          unconfirmed.delete(id);
          continue;
        }
        merged = {
          reports: [res.report, ...merged.reports],
          incidents: merged.incidents.some((i) => i.id === res.incident.id) ? merged.incidents : [res.incident, ...merged.incidents],
          followingIds: addId(merged.followingIds, res.incident.id),
        };
      }
      merged.reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({ ...merged, status: 'ready' });
    } catch (e) {
      set({ status: 'error', error: e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again') });
    }
  },

  ingestSubmitted(res, opts) {
    unconfirmed.set(res.report.id, res);
    set((s) => ({
      reports: s.reports.some((r) => r.id === res.report.id) ? s.reports : [res.report, ...s.reports],
      incidents: upsertIncident(s.incidents, res.incident),
      followingIds: addId(s.followingIds, res.incident.id),
      ...(opts?.last === false ? {} : { lastSubmitted: res }),
    }));
  },

  async submitReport(input) {
    const userId = uid();
    // One key per submit: if the POST reached the server but the answer was lost, the queued retry reuses it.
    const idempotencyKey = newIdempotencyKey();
    const queue = async (original: NewReportInput): Promise<SubmitResult> => {
      await reloadOutbox(); // website: another tab may have queued a report, never write a stale queue over it
      // Cache and temp files can be cleared before the retry: keep the photos and the voice note in app storage.
      const kept = await persistReportFiles(original, persistLocalFile);
      return { queued: true, item: useOutbox.getState().enqueue(userId, kept, idempotencyKey) };
    };
    if (await isOffline()) return queue(input);
    let toSend = input;
    try {
      const res = await sendReport(userId, input, (prepared) => {
        toSend = prepared;
      }, idempotencyKey);
      get().ingestSubmitted(res);
      return { queued: false, ...res };
    } catch (e) {
      // No connection / server down: keep the report on the phone instead of losing it. A 4xx (validation) is shown.
      if (classifyFailure(e) === 'retry') return queue(toSend);
      throw e;
    }
  },

  async loadReport(id) {
    const report = await services.incidents.getReport(uid(), id);
    if (!report) return false;
    const incident = await services.incidents.getIncident(report.incidentId).catch(() => null);
    set((s) => ({
      reports: s.reports.some((r) => r.id === report.id) ? s.reports.map((r) => (r.id === report.id ? report : r)) : [report, ...s.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      incidents: incident ? upsertIncident(s.incidents, incident) : s.incidents,
    }));
    return true;
  },

  async followIncident(incidentId) {
    const inc = await services.incidents.followIncident(uid(), incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc), followingIds: addId(s.followingIds, inc.id) }));
  },

  async simulateProgress(incidentId) {
    const inc = await services.incidents.simulateProgress(incidentId);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc) }));
  },

  async reopenIncident(incidentId, note) {
    const inc = await services.incidents.reopenIncident(uid(), incidentId, note);
    set((s) => ({ incidents: upsertIncident(s.incidents, inc) }));
  },

  reset: () => {
    unconfirmed.clear();
    set({ status: 'idle', error: null, reports: [], incidents: [], followingIds: [], lastSubmitted: null });
  },
}));

/** Incident ids the user follows or reported, from the store (not screen-local state). */
export function useFollowingSet(): ReadonlySet<string> {
  const followingIds = useReports((s) => s.followingIds);
  const reports = useReports((s) => s.reports);
  return useMemo(() => new Set([...followingIds, ...reports.map((r) => r.incidentId)]), [followingIds, reports]);
}
