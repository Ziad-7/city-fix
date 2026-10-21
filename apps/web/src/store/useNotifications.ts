import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { diffStatuses, type KnownStatuses, type TrackedItem } from '@/domain/notifications';
import type { AppNotification, IncidentStatus } from '@/domain/types';
import { showLocalNotification } from '@/notifications/os';
import { usePrefs } from './usePrefs';
import { useReports } from './useReports';
import { useServiceRequests } from './useServiceRequests';

const MAX_KEPT = 100;

type NotificationsState = {
  /** Newest first. */
  items: AppNotification[];
  /** Last status seen per report / service request; the baseline for the diff. */
  known: KnownStatuses;
  /** Diffs the given items against `known`, stores new notifications and fires OS notifications. */
  sync: (tracked: TrackedItem[]) => AppNotification[];
  markRead: (id: string) => void;
  markAllRead: () => void;
  reset: () => void;
};

let counter = 0;

/**
 * Status changes the citizen just caused themselves (reopening a report): the next sync records them as the new
 * baseline without a notification, so the person does not get an OS banner about their own tap.
 */
const ownChanges = new Map<string, IncidentStatus>();

export function expectOwnChange(entityIds: string[], status: IncidentStatus): () => void {
  for (const id of entityIds) ownChanges.set(id, status);
  return () => {
    for (const id of entityIds) if (ownChanges.get(id) === status) ownChanges.delete(id);
  };
}

export const useNotifications = create<NotificationsState>()(
  persist(
    (set, get) => ({
      items: [],
      known: {},
      sync(tracked) {
        const at = new Date().toISOString();
        let before = get().known;
        for (const t of tracked) {
          if (ownChanges.get(t.entityId) !== t.status) continue;
          ownChanges.delete(t.entityId);
          before = { ...before, [t.entityId]: t.status };
        }
        const { known, created } = diffStatuses(before, tracked, at, (it, i) => `n-${Date.now()}-${counter++}-${i}-${it.entityId}`);
        const baselineChanged = tracked.some((t) => get().known[t.entityId] !== t.status);
        if (created.length === 0) {
          if (baselineChanged) set({ known });
          return [];
        }
        // Newest first: later items of this batch go on top.
        set((s) => ({ known, items: [...[...created].reverse(), ...s.items].slice(0, MAX_KEPT) }));
        if (usePrefs.getState().appNotifications) {
          for (const n of created) void showLocalNotification(n);
        }
        return created;
      },
      markRead: (id) => set((s) => ({ items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: () => set((s) => ({ items: s.items.map((n) => (n.read ? n : { ...n, read: true })) })),
      reset: () => set({ items: [], known: {} }),
    }),
    {
      name: 'ftc.notifications.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items, known: s.known }),
    },
  ),
);

export const useUnreadCount = () => useNotifications((s) => s.items.filter((n) => !n.read).length);

/** The citizen's reports (by incident status) and service requests as diff input. Only loaded stores count. */
export function collectTracked(): TrackedItem[] {
  const out: TrackedItem[] = [];
  const reports = useReports.getState();
  if (reports.status === 'ready') {
    const byId = new Map(reports.incidents.map((i) => [i.id, i]));
    for (const r of reports.reports) {
      const inc = byId.get(r.incidentId);
      if (!inc) continue;
      out.push({
        entityType: 'report',
        entityId: r.id,
        status: inc.status,
        department: inc.department,
        note: inc.timeline[inc.timeline.length - 1]?.note,
      });
    }
  }
  const services = useServiceRequests.getState();
  if (services.status === 'ready') {
    for (const r of services.requests) {
      out.push({ entityType: 'service_request', entityId: r.id, status: r.status, note: r.timeline[r.timeline.length - 1]?.note });
    }
  }
  return out;
}

/**
 * Subscribes to the reports and service-request stores (refresh, simulate and reopen all go through them) and
 * notifies on status changes. Call once from the root layout; returns the unsubscribe function.
 * Waits for the persisted notification store so the baseline is the stored one.
 */
export function startNotificationSync(): () => void {
  const run = () => {
    if (useNotifications.persist.hasHydrated()) useNotifications.getState().sync(collectTracked());
  };
  const unsubs = [useReports.subscribe(run), useServiceRequests.subscribe(run), useNotifications.persist.onFinishHydration(run)];
  run();
  return () => unsubs.forEach((u) => u());
}
