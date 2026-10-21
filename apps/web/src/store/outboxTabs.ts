import { OUTBOX_KEY } from '@/platform/legacy-outbox';
import { setOutboxSync, type OutboxSync } from './outboxFlush';
import { useOutbox } from './useOutbox';

/** Name of the Web Lock that serialises sending across tabs. */
export const OUTBOX_LOCK = 'ftc-outbox';

/**
 * The website's side of the shared outbox's cross-tab seam. Tabs share one localStorage queue but each holds its own
 * in-memory copy, so (1) only one tab sends at a time (Web Locks) and (2) a tab reads the queue again before it sends
 * or queues anything, so it never writes a stale queue over another tab's report or sends a report twice.
 */
export const webOutboxSync: OutboxSync = {
  lock: (job) => {
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    // Without Web Locks (old browsers) tabs still re-read the queue, which narrows the window but cannot close it.
    return locks?.request ? locks.request(OUTBOX_LOCK, () => job()) : job();
  },
  reload: () => useOutbox.persist.rehydrate() as Promise<void>,
};

/**
 * Plugs the seam in and keeps this tab's queue in step with the other tabs (the `storage` event fires in the *other*
 * tabs whenever one writes). Returns the cleanup.
 */
export function installOutboxTabSync(): () => void {
  setOutboxSync(webOutboxSync);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OUTBOX_KEY || e.key === null) void webOutboxSync.reload?.();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    setOutboxSync();
  };
}

/** True when the saved queue in localStorage really holds this report (a full disk drops the write silently). */
export function isQueuedOnDevice(id: string): boolean {
  try {
    return !!window.localStorage.getItem(OUTBOX_KEY)?.includes(JSON.stringify(id));
  } catch {
    return false;
  }
}
