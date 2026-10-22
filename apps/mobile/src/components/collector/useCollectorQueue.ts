import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CompletePickupInput, WeighingInput } from '@/domain/citycycle';
import { tr } from '@/i18n';
import { classifyFailure } from '@/services/media';
import { isOffline, isOnlineState } from '@/services/network';
import { collectorActorId, newClientId, useCollector } from '@/store/useCollector';
import { useSession } from '@/store/useSession';
import type { QueuedAction } from './queue';

/**
 * Offline-first collector actions. Weighing and "complete" are the two actions that happen at the household's door,
 * where the signal is worst, so they are saved here when the phone is offline (or the server is unreachable) and sent
 * later, oldest first. Weighings carry a `clientId`, so a retry never adds a second row. Accepting a job is NOT queued:
 * first accept wins, so it needs the server (the screen says so).
 * Persisted in AsyncStorage `ftc.collector.queue.v1`.
 */
type QueueState = {
  items: QueuedAction[];
  /** The last action the server refused while syncing (for a one-line notice). Not persisted. */
  dropped: string | null;
  add: (a: QueuedAction) => void;
  remove: (id: string) => void;
  bump: (id: string) => void;
  setDropped: (msg: string | null) => void;
};

export const useCollectorQueue = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      dropped: null,
      add: (a) => set((s) => ({ items: [...s.items, a] })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      bump: (id) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, attempts: i.attempts + 1 } : i)) })),
      setDropped: (dropped) => set({ dropped }),
    }),
    { name: 'ftc.collector.queue.v1', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ items: s.items }) },
  ),
);

/** Who the queue belongs to: the collector account (mock mode: the demo collector; API mode: the signed-in user). */
export function currentActor(): string | null {
  if (!useSession.getState().userId) return null;
  try {
    return collectorActorId();
  } catch {
    return null;
  }
}

/** Hook version: re-renders on sign-in and sign-out. */
export function useActorId(): string | null {
  const userId = useSession((s) => s.userId);
  return userId ? currentActor() : null;
}

let seq = 0;
const newId = () => `CQ-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export type SubmitResult = 'sent' | 'queued';

const queuedFor = (userId: string, jobId: string) => useCollectorQueue.getState().items.some((i) => i.userId === userId && i.jobId === jobId);

function enqueue(userId: string, jobId: string, action: { kind: 'weighing'; input: WeighingInput } | { kind: 'complete'; input: CompletePickupInput }) {
  useCollectorQueue.getState().add({ ...action, id: newId(), userId, jobId, at: new Date().toISOString(), attempts: 0 } as QueuedAction);
}

/** Sends one weighing now, or saves it for later when offline. Throws only when the server refuses it. */
export async function submitWeighing(jobId: string, input: Omit<WeighingInput, 'clientId'>): Promise<SubmitResult> {
  const userId = collectorActorId();
  const full: WeighingInput = { ...input, clientId: newClientId() };
  // Keep the order of actions on one job: if something is already waiting, this one waits behind it.
  if (queuedFor(userId, jobId) || (await isOffline())) {
    enqueue(userId, jobId, { kind: 'weighing', input: full });
    void flushCollectorQueue();
    return 'queued';
  }
  try {
    await useCollector.getState().addWeighing(jobId, full);
    return 'sent';
  } catch (e) {
    if (classifyFailure(e) !== 'retry') throw e;
    enqueue(userId, jobId, { kind: 'weighing', input: full });
    return 'queued';
  }
}

/** Finishes the job now, or saves it for later when offline. Throws only when the server refuses it. */
export async function submitComplete(jobId: string, input: CompletePickupInput): Promise<SubmitResult> {
  const userId = collectorActorId();
  if (queuedFor(userId, jobId) || (await isOffline())) {
    enqueue(userId, jobId, { kind: 'complete', input });
    void flushCollectorQueue();
    return 'queued';
  }
  try {
    await useCollector.getState().complete(jobId, input);
    return 'sent';
  } catch (e) {
    if (classifyFailure(e) !== 'retry') throw e;
    enqueue(userId, jobId, { kind: 'complete', input });
    return 'queued';
  }
}

let inflight: Promise<{ sent: number; kept: number }> | null = null;

/**
 * Sends the signed-in collector's waiting actions, oldest first. Network trouble keeps the rest for later;
 * a refusal (the server says no) drops that action with a notice; a 401 keeps everything until the next sign-in.
 */
export function flushCollectorQueue(): Promise<{ sent: number; kept: number }> {
  if (inflight) return inflight;
  const run = (async () => {
    const result = { sent: 0, kept: 0 };
    const userId = currentActor();
    if (!userId) return result;
    const mine = () => useCollectorQueue.getState().items.filter((i) => i.userId === userId);
    // Re-read the connection first: a cached "offline" must not block a retry the person asked for.
    await NetInfo.refresh().catch(() => undefined);
    if (await isOffline()) return { sent: 0, kept: mine().length };
    for (const item of mine()) {
      if (currentActor() !== userId) break;
      try {
        if (item.kind === 'weighing') await useCollector.getState().addWeighing(item.jobId, item.input);
        else await useCollector.getState().complete(item.jobId, item.input);
        useCollectorQueue.getState().remove(item.id);
        result.sent += 1;
      } catch (e) {
        const kind = classifyFailure(e);
        if (kind === 'drop') {
          useCollectorQueue.getState().remove(item.id);
          const why = e instanceof Error && e.message ? e.message : '';
          useCollectorQueue.getState().setDropped(tr(`معرفناش نبعت حاجة اتحفظت: ${why}`, `We couldn't send something that was saved: ${why}`));
          continue;
        }
        useCollectorQueue.getState().bump(item.id);
        break;
      }
    }
    result.kept = mine().length;
    // Refresh the lists once everything went through, so earnings and the job list match the server.
    if (result.sent > 0 && result.kept === 0) void useCollector.getState().refreshJobs().catch(() => undefined);
    return result;
  })();
  inflight = run;
  void run.finally(() => {
    if (inflight === run) inflight = null;
  });
  return run;
}

/** Mount once in the collector layout: sends the waiting actions on start, when the net returns and when the app comes to the front. */
export function useCollectorSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void flushCollectorQueue();
    let wasOnline: boolean | null = null;
    const unsubNet = NetInfo.addEventListener((s) => {
      const online = isOnlineState(s);
      if (online && wasOnline !== true) void flushCollectorQueue();
      wasOnline = online;
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void flushCollectorQueue();
    });
    return () => {
      unsubNet();
      sub.remove();
    };
  }, [enabled]);
}
