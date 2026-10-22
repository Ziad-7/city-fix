// Stand-in for `@react-native-async-storage/async-storage` (aliased in tsconfig.json, vitest.config.ts), which the
// shared stores (usePrefs, useNotifications, useOutbox) persist through. On the web it is the browser's
// localStorage: same keys as the mobile app, nothing else changes. Best effort like the real thing (private
// mode, quota, server render: reads give null, writes are dropped). Callers that must know whether a write
// landed (the offline queue) read the value back instead, see store/outboxTabs.ts `isQueuedOnDevice`.
import { OUTBOX_KEY, migrateLegacyOutbox } from './legacy-outbox';

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    const raw = storage()?.getItem(key) ?? null;
    return key === OUTBOX_KEY ? migrateLegacyOutbox(raw) : raw;
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      storage()?.setItem(key, value);
    } catch {
      // QuotaExceededError and friends: dropped (an unhandled rejection from the store's persist would help nobody).
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      storage()?.removeItem(key);
    } catch {
      // nothing to do
    }
  },
};

export default AsyncStorage;
