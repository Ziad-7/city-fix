import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSeed, type MockDb } from './seed';

const KEY = 'ftc.mock.db.v1';
let cache: MockDb | null = null;

/** Loads the mock database from AsyncStorage, seeding it on first run. */
export async function loadDb(): Promise<MockDb> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as MockDb;
      return cache;
    }
  } catch {
    // fall through to a fresh seed
  }
  cache = buildSeed();
  await saveDb(cache);
  return cache;
}

export async function saveDb(db: MockDb): Promise<void> {
  cache = db;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // persistence is best-effort in the mock
  }
}

/** Wipes persisted mock data (next load re-seeds). Used by tests and the dev reset. */
export async function resetMockDb(): Promise<void> {
  cache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Small artificial latency so loading states are visible in the demo. */
export const delay = (ms = 250) => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));
