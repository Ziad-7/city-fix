'use client';

import { useEffect } from 'react';
import { cancelOutboxRetry, flushOutbox } from './outboxFlush';
import { installOutboxTabSync } from './outboxTabs';
import { useOutbox } from './useOutbox';

/**
 * Web version of apps/mobile/src/store/useOutboxSync.ts. Mount once while signed in: sends the queue on page load,
 * when the browser comes back online and when the tab becomes visible again; backed-off items wake themselves up.
 * Also keeps several open tabs from stepping on each other's queue (see outboxTabs.ts).
 */
export function useOutboxSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const uninstallTabSync = installOutboxTabSync();
    void flushOutbox({ force: true });
    const onOnline = () => void flushOutbox({ force: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flushOutbox();
    };
    // The queue is read from localStorage asynchronously (AsyncStorage): send what it holds once it is loaded.
    // Only the first load: every flush and every `storage` event reads the queue again, and each read ends in
    // this callback, which would start the next flush.
    let first = true;
    const unsubHydrated = useOutbox.persist.onFinishHydration(() => {
      if (!first) return;
      first = false;
      void flushOutbox({ force: true });
    });
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubHydrated();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      uninstallTabSync();
      cancelOutboxRetry();
    };
  }, [enabled]);
}
