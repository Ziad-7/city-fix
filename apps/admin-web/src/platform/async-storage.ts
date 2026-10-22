// Stand-in for `@react-native-async-storage/async-storage` (aliased in tsconfig.json and vitest.config.ts).
// The shared usePrefs store persists through it; on the web it is the browser's localStorage. Best effort:
// private mode, quota and server render give null on read and drop writes.
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
    try {
      storage()?.setItem(key, value);
    } catch {
      // quota exceeded and friends: dropped
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
