import { buildSeed, type MockDb } from './seed';

// Web version of apps/mobile/src/services/mock/db.ts: same key, same seed, localStorage instead of AsyncStorage.
const KEY = 'ftc.mock.db.v1';

// One in-flight load shared by every caller: the first pages fire several list calls at once, and each
// must see the same database object (otherwise several seeds are built and a later write mutates only one).
let loading: Promise<MockDb> | null = null;

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

async function readOrSeed(): Promise<MockDb> {
  try {
    const raw = storage()?.getItem(KEY);
    if (raw) return JSON.parse(raw) as MockDb;
  } catch {
    // fall through to a fresh seed
  }
  const seed = buildSeed();
  await persist(seed);
  return seed;
}

/** Loads the mock database from localStorage, seeding it on first run. */
export function loadDb(): Promise<MockDb> {
  return (loading ??= readOrSeed());
}

async function persist(db: MockDb): Promise<void> {
  try {
    storage()?.setItem(KEY, JSON.stringify(db));
  } catch {
    // persistence is best-effort in the mock (quota, private mode)
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
    storage()?.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Small artificial latency so loading states are visible in the demo. */
export const delay = (ms = 250) => (process.env.NODE_ENV === 'test' ? Promise.resolve() : new Promise<void>((r) => setTimeout(r, ms)));
