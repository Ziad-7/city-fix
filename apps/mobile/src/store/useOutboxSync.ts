import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { isOnlineState } from '@/services/network';
import { flushCollectorQueue } from './collectorSync';
import { cancelOutboxRetry, flushOutbox } from './outboxFlush';

/**
 * Mount once (root layout, signed in): sends the queue on app start, when connectivity returns and when the app
 * comes back to the foreground; backed-off items wake themselves up (see outboxFlush).
 */
export function useOutboxSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
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
