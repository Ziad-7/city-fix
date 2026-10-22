import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NewReportInput } from '@/domain/types';
import { tr } from '@/i18n';
import { newIdempotencyKey } from '@/services/media';

/** A report saved on the phone, waiting for the network. */
export type OutboxItem = {
  /** Local id (Q-…): the real report id only exists once the server accepted it. */
  id: string;
  userId: string;
  input: NewReportInput;
  createdAt: string;
  attempts: number;
  /** Sent as `Idempotency-Key` on every attempt, so a retry after a lost response cannot create a second report. */
  idempotencyKey?: string;
  lastError?: string;
  /** Epoch ms: automatic retries wait for this (exponential backoff). Manual "send now" ignores it. */
  nextAttemptAt?: number;
};

type OutboxState = {
  items: OutboxItem[];
  /** Latest toast, never persisted (`n` changes on every one so the same text can show again). */
  notice: { n: number; ok: boolean; text: string } | null;
  enqueue: (userId: string, input: NewReportInput, idempotencyKey?: string) => OutboxItem;
  update: (id: string, patch: Partial<Omit<OutboxItem, 'id'>>) => void;
  remove: (id: string) => void;
  noteSent: () => void;
  noteDropped: (message: string) => void;
  /** A toast for something other than a report (e.g. the collector's saved actions). */
  notify: (ok: boolean, text: string) => void;
};

/**
 * Cross-tab seam. On the phone there is one JS runtime, so both hooks do nothing. The website (several tabs share one
 * localStorage queue) plugs in a lock (Web Locks) and a "read the queue from storage again" function.
 */
export type OutboxSync = {
  /** Runs one flush with exclusive access to the queue (across tabs). Default: runs the job right away. */
  lock?: <T>(job: () => Promise<T>) => Promise<T>;
  /** Replaces the in-memory queue with what storage holds now (another tab may have changed it). Default: nothing. */
  reload?: () => Promise<void>;
};
const direct = <T>(job: () => Promise<T>) => job();
const nothing = async () => {};
let sync: Required<OutboxSync> = { lock: direct, reload: nothing };

/** Registers the cross-tab hooks (website only). Pass nothing to go back to the defaults. */
export function setOutboxSync(hooks?: OutboxSync) {
  sync = { lock: hooks?.lock ?? direct, reload: hooks?.reload ?? nothing };
}
export const withOutboxLock = <T>(job: () => Promise<T>): Promise<T> => sync.lock(job);
export const reloadOutbox = (): Promise<void> => sync.reload();

let seq = 0;
const newId = () => `Q-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      items: [],
      notice: null,
      enqueue(userId, input, idempotencyKey) {
        const item: OutboxItem = { id: newId(), userId, input, createdAt: new Date().toISOString(), attempts: 0, idempotencyKey: idempotencyKey ?? newIdempotencyKey() };
        set((s) => ({ items: [item, ...s.items] }));
        return item;
      },
      update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      noteSent: () => set((s) => ({ notice: { n: (s.notice?.n ?? 0) + 1, ok: true, text: tr('بلاغك اتبعت', 'Your report was sent') } })),
      noteDropped: (text) => set((s) => ({ notice: { n: (s.notice?.n ?? 0) + 1, ok: false, text } })),
      notify: (ok, text) => set((s) => ({ notice: { n: (s.notice?.n ?? 0) + 1, ok, text } })),
    }),
    {
      name: 'ftc.outbox.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);

/** Delay before the next automatic attempt: 5 s, 10 s, 20 s … capped at 15 minutes. */
export function backoffMs(attempts: number): number {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}
