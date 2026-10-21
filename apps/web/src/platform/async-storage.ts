// Stand-in for `@react-native-async-storage/async-storage` (aliased in tsconfig.json, vitest.config.ts), which the
// shared stores (usePrefs, useNotifications, useOutbox) persist through. On the web it is the browser's
// localStorage: same keys as the mobile app, nothing else changes. Best effort like the real thing (private
// mode, quota, server render: reads give null, writes are dropped).
const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return storage()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    storage()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    storage()?.removeItem(key);
  },
};

export default AsyncStorage;
