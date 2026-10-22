import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isOnlineState } from '@/services/network';
import { sweepOrphanedFiles } from '@/services/persistFile';
import { flushCollectorQueue } from './collectorSync';
import { cancelOutboxRetry, flushOutbox } from './outboxFlush';
import { queuedFileUris, useOutbox } from './useOutbox';

/**
 * Mount once (root layout, signed in): sends the queue on app start, when connectivity returns and when the app
 * comes back to the foreground; backed-off items wake themselves up (see outboxFlush).
 */
export function useOutboxSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    // Once the queue is loaded from storage: delete copied files that no queued report uses any more.
    const sweep = () => void sweepOrphanedFiles(useOutbox.getState().items.flatMap((i) => queuedFileUris(i.input)));
    if (useOutbox.persist.hasHydrated()) sweep();
    else useOutbox.persist.onFinishHydration(sweep);
    void flushOutbox({ force: true });
    void flushCollectorQueue({ force: true });
    let wasOnline: boolean | null = null;
    const unsubNet = NetInfo.addEventListener((s) => {
      const online = isOnlineState(s);
      if (online && wasOnline !== true) {
        void flushOutbox({ force: true });
        void flushCollectorQueue({ force: true });
      }
      wasOnline = online;
    });
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        void flushOutbox();
        void flushCollectorQueue();
      }
    });
    return () => {
      unsubNet();
      sub.remove();
      cancelOutboxRetry();
    };
  }, [enabled]);
}
