import { tr } from '@/i18n';
import { classifyFailure } from '@/services/media';
import { isOffline } from '@/services/network';
import { services } from '@/services';
import { useCollector } from './useCollector';
import { useCollectorQueue, type QueuedCollectorAction } from './collectorQueue';
import { backoffMs, useOutbox } from './useOutbox';
import { useSession } from './useSession';

export type CollectorFlushResult = { sent: number; kept: number; dropped: number };

let inflight: Promise<CollectorFlushResult> | null = null;

async function send(userId: string, item: QueuedCollectorAction): Promise<void> {
  const a = item.action;
  if (a.kind === 'accept') await services.collector.accept(userId, a.pickupId);
  else if (a.kind === 'weigh') await services.collector.addWeighing(userId, a.pickupId, a.weighing);
  else await services.collector.complete(userId, a.pickupId, a.paidToHouseholdEgp);
}

/**
 * Sends the signed-in collector's saved actions, oldest first, one at a time (a weighing must not overtake its accept).
 * Delivered: removed. Network or server trouble: kept with a backoff, and the rest wait behind it (order matters).
 * The server said no (for example "already taken"): that action and everything else saved for the same pickup are
 * dropped and the person is told. A 401 keeps the queue until they sign in again.
 */
export function flushCollectorQueue(opts: { force?: boolean } = {}): Promise<CollectorFlushResult> {
  if (!inflight) {
    inflight = run(opts).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function run(opts: { force?: boolean }): Promise<CollectorFlushResult> {
  const result: CollectorFlushResult = { sent: 0, kept: 0, dropped: 0 };
  const userId = useSession.getState().userId;
  if (!userId) return result;
  const queue = useCollectorQueue.getState();
  const pending = () => useCollectorQueue.getState().items.filter((i) => i.userId === userId);
  if (pending().length === 0) return result;
  if (await isOffline()) {
    result.kept = pending().length;
    return result;
  }

  const dead = new Set<string>();
  for (const item of pending()) {
    if (useSession.getState().userId !== userId) break;
    if (dead.has(item.action.pickupId)) {
      queue.remove(item.id);
      result.dropped += 1;
      continue;
    }
    if (!opts.force && (item.nextAttemptAt ?? 0) > Date.now()) {
      result.kept = pending().length;
      break;
    }
    try {
      await send(userId, item);
      queue.remove(item.id);
      result.sent += 1;
    } catch (e) {
      const kind = classifyFailure(e);
      const message = e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again');
      if (kind === 'drop') {
        dead.add(item.action.pickupId);
        queue.remove(item.id);
        result.dropped += 1;
        useOutbox.getState().notify(false, tr(`معرفناش نبعت شغلك المحفوظ: ${message}`, `We couldn't send your saved work: ${message}`));
        continue;
      }
      if (kind !== 'auth') {
        const attempts = item.attempts + 1;
        queue.update(item.id, { attempts, lastError: message, nextAttemptAt: Date.now() + backoffMs(attempts) });
      }
      result.kept = pending().length;
      break;
    }
  }

  if (result.sent > 0 || result.dropped > 0) {
    if (result.sent > 0 && result.dropped === 0) useOutbox.getState().notify(true, tr('شغلك المحفوظ اتبعت', 'Your saved work was sent'));
    // Replace the optimistic local state with what the server now holds.
    await useCollector.getState().refreshMine();
  }
  return result;
}
