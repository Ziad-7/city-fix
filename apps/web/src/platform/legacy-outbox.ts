// The old website (before the shared outbox) kept its offline queue as a plain array under the same key:
//   [{ id, userId, input, queuedAt }, ...]  oldest first.
// The shared store persists `{ state: { items }, version: 0 }` with the newest first. `getItem` in the
// AsyncStorage shim runs the old value through this once, so reports queued by the old build are not dropped.

export const OUTBOX_KEY = 'ftc.outbox.v1';

type LegacyItem = { id?: unknown; userId?: unknown; input?: unknown; queuedAt?: unknown };

/** Returns the persisted string for the new store, or the input unchanged when it is not the old array format. */
export function migrateLegacyOutbox(raw: string | null): string | null {
  if (!raw) return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!Array.isArray(parsed)) return raw;
  const items = (parsed as LegacyItem[])
    .filter((i) => typeof i?.id === 'string' && typeof i.userId === 'string' && i.input && typeof i.input === 'object')
    .map((i) => ({
      id: i.id as string,
      userId: i.userId as string,
      input: i.input,
      createdAt: typeof i.queuedAt === 'string' ? i.queuedAt : new Date().toISOString(),
      attempts: 0,
    }))
    .reverse(); // the shared queue is newest first
  return JSON.stringify({ state: { items }, version: 0 });
}
