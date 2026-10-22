import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CollectorAction } from '@/domain/citycycle';

/**
 * Collector actions saved on the phone while the network is down (offline-first). Each one carries a `clientId`
 * (the weighing's own `clientId`, or a fresh id) so the server can de-duplicate a retry. Oldest first, sent in order
 * by `flushCollectorQueue` (store/collectorSync.ts).
 */
export type QueuedCollectorAction = {
  /** Local id (the weighing's clientId for a weighing). */
  id: string;
  userId: string;
  action: CollectorAction;
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** Epoch ms: automatic retries wait for this (exponential backoff). */
  nextAttemptAt?: number;
};

type QueueState = {
  /** Oldest first. */
  items: QueuedCollectorAction[];
  enqueue: (userId: string, action: CollectorAction, id: string) => QueuedCollectorAction;
  update: (id: string, patch: Partial<Omit<QueuedCollectorAction, 'id'>>) => void;
  remove: (id: string) => void;
  removeForPickup: (pickupId: string) => void;
  clearUser: (userId: string) => void;
};

let seq = 0;
export const newClientId = (): string => `c-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useCollectorQueue = create<QueueState>()(
  persist(
    (set) => ({
      items: [],
      enqueue(userId, action, id) {
        const item: QueuedCollectorAction = { id, userId, action, createdAt: new Date().toISOString(), attempts: 0 };
        set((s) => ({ items: [...s.items, item] }));
        return item;
      },
      update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      removeForPickup: (pickupId) => set((s) => ({ items: s.items.filter((i) => i.action.pickupId !== pickupId) })),
      clearUser: (userId) => set((s) => ({ items: s.items.filter((i) => i.userId !== userId) })),
    }),
    {
      name: 'ftc.collector.queue.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** The queued actions of one pickup (to show "waiting for the network" on its card). */
export const queuedFor = (items: readonly QueuedCollectorAction[], pickupId: string): QueuedCollectorAction[] =>
  items.filter((i) => i.action.pickupId === pickupId);
