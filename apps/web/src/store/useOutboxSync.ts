'use client';

import { useEffect } from 'react';
import { cancelOutboxRetry, flushOutbox } from './outboxFlush';
import { useOutbox } from './useOutbox';

/**
 * Web version of apps/mobile/src/store/useOutboxSync.ts. Mount once while signed in: sends the queue on page load,
 * when the browser comes back online and when the tab becomes visible again; backed-off items wake themselves up.
 */
export function useOutboxSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    void flushOutbox({ force: true });
    const onOnline = () => void flushOutbox({ force: true });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flushOutbox();
    };
    // The queue is read from localStorage asynchronously (AsyncStorage): send what it holds once it is loaded.
    const unsubHydrated = useOutbox.persist.onFinishHydration(() => void flushOutbox({ force: true }));
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubHydrated();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      cancelOutboxRetry();
    };
  }, [enabled]);
}
