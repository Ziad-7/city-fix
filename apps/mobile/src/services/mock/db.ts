import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSeed, type MockDb } from './seed';

const KEY = 'ftc.mock.db.v1';

// One in-flight load shared by every caller: the first screens fire several list calls at once, and each
// must see the same database object (otherwise several seeds are built and a later write mutates only one).
let loading: Promise<MockDb> | null = null;

async function readOrSeed(): Promise<MockDb> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to a fresh seed
  }
  const seed = buildSeed();
  await persist(seed);
  return seed;
}

/** Loads the mock database from AsyncStorage, seeding it on first run. */
export function loadDb(): Promise<MockDb> {
  return (loading ??= readOrSeed());
}

async function persist(db: MockDb): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // persistence is best-effort in the mock
  }
}

export async function saveDb(db: MockDb): Promise<void> {
  loading = Promise.resolve(db);
  await persist(db);
}

/** Wipes persisted mock data (next load re-seeds). Used by tests and the dev reset. */
export async function resetMockDb(): Promise<void> {
  loading = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Small artificial latency so loading states are visible in the demo. */
export const delay = (ms = 250) => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));
