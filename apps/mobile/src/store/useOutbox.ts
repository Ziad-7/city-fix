import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NewReportInput } from '@/domain/types';

/** A report saved on the phone, waiting for the network. */
export type OutboxItem = {
  /** Local id (Q-…): the real report id only exists once the server accepted it. */
  id: string;
  userId: string;
  input: NewReportInput;
  createdAt: string;
  attempts: number;
  lastError?: string;
  /** Epoch ms: automatic retries wait for this (exponential backoff). Manual "send now" ignores it. */
  nextAttemptAt?: number;
};

type OutboxState = {
  items: OutboxItem[];
  /** Latest toast, never persisted (`n` changes on every one so the same text can show again). */
  notice: { n: number; ok: boolean; text: string } | null;
  enqueue: (userId: string, input: NewReportInput) => OutboxItem;
  update: (id: string, patch: Partial<Omit<OutboxItem, 'id'>>) => void;
  remove: (id: string) => void;
  noteSent: () => void;
  noteDropped: (message: string) => void;
};

let seq = 0;
const newId = () => `Q-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      items: [],
      notice: null,
      enqueue(userId, input) {
        const item: OutboxItem = { id: newId(), userId, input, createdAt: new Date().toISOString(), attempts: 0 };
        set((s) => ({ items: [item, ...s.items] }));
        return item;
      },
      update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      noteSent: () => set((s) => ({ notice: { n: (s.notice?.n ?? 0) + 1, ok: true, text: 'بلاغك اتبعت' } })),
      noteDropped: (text) => set((s) => ({ notice: { n: (s.notice?.n ?? 0) + 1, ok: false, text } })),
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
