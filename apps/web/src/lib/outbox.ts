'use client';

import { create } from 'zustand';
import type { NewReportInput } from '@/domain/types';
import { API_MODE } from '@/services';
import { ApiError } from '@/services/api/http';
import { uploadPhoto } from '@/services/api/upload';
import { useReports } from '@/store';

// Reports written with no connection wait here ("النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع")
// and go out when the browser is back online. Kept in localStorage so a closed tab loses nothing.

export const OUTBOX_KEY = 'ftc.outbox.v1';

export type QueuedReport = { id: string; userId: string; input: NewReportInput; queuedAt: string };

const MSG_FULL = 'مفيش مساحة نحفظ البلاغ على جهازك. جرّب تبعته لما النت يرجع.';

function read(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as QueuedReport[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedReport[]) {
  if (items.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  else localStorage.removeItem(OUTBOX_KEY);
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** The request never reached the server (no connection), as opposed to the server saying no. */
export const isNetworkFailure = (e: unknown) => isOffline() || (e instanceof ApiError && e.status === 0) || e instanceof TypeError;

/** Uploads the photos (API mode) and submits. The one send path for the form and the outbox. */
export async function sendReport(input: NewReportInput) {
  const photoUris = API_MODE === 'api' ? await Promise.all(input.photoUris.map(uploadPhoto)) : input.photoUris;
  return useReports.getState().submitReport({ ...input, photoUris });
}

type OutboxState = {
  items: QueuedReport[];
  flushing: boolean;
  load: () => void;
  /** Saves a report for later. Throws a citizen-facing message when storage is full. */
  add: (userId: string, input: NewReportInput) => QueuedReport;
  /** Sends the user's queued reports in order; stops at the first failure. Returns how many went out. */
  flush: (userId: string) => Promise<number>;
};

export const useOutbox = create<OutboxState>((set, get) => ({
  items: [],
  flushing: false,

  load: () => set({ items: read() }),

  add(userId, input) {
    const item: QueuedReport = { id: `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, userId, input, queuedAt: new Date().toISOString() };
    const items = [...read(), item];
    try {
      write(items);
    } catch {
      throw new Error(MSG_FULL);
    }
    set({ items });
    return item;
  },

  async flush(userId) {
    if (get().flushing || isOffline()) return 0;
    set({ flushing: true });
    // One flush at a time across tabs too: a second tab would read the same queue and send each report twice.
    const run = async () => {
      let sent = 0;
      for (const item of read().filter((i) => i.userId === userId)) {
        try {
          await sendReport(item.input);
        } catch {
          break; // offline again, or the server refused it: keep it for the next try
        }
        sent++;
        const rest = read().filter((i) => i.id !== item.id);
        write(rest);
        set({ items: rest });
      }
      return sent;
    };
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      return locks ? ((await locks.request('ftc.outbox.flush', { ifAvailable: true }, (lock) => (lock ? run() : 0))) as number) : await run();
    } finally {
      set({ flushing: false });
    }
  },
}));

export const useQueuedCount = (userId: string | null) => useOutbox((s) => (userId ? s.items.filter((i) => i.userId === userId).length : 0));
