import { classifyFailure } from '@/services/media';
import { isOffline } from '@/services/network';
import { sendReport } from '@/services/sendReport';
import { backoffMs, useOutbox, type OutboxItem } from './useOutbox';
import { useReports } from './useReports';
import { useSession } from './useSession';

export const MSG_RETRY_LATER = 'لسه مفيش نت، هنحاول تاني';

let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export function cancelOutboxRetry() {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Wakes up for the earliest backed-off item of the signed-in user. */
function scheduleRetry() {
  cancelOutboxRetry();
  const userId = useSession.getState().userId;
  const due = useOutbox
    .getState()
    .items.filter((i) => i.userId === userId && i.nextAttemptAt !== undefined)
    .map((i) => i.nextAttemptAt as number);
  if (due.length === 0) return;
  const wait = Math.max(1_000, Math.min(...due) - Date.now());
  timer = setTimeout(() => void flushOutbox(), wait);
  (timer as { unref?: () => void }).unref?.();
}

export type FlushOptions = {
  /** Ignore the backoff (connectivity just came back, or the person pressed "ابعت دلوقتي"). */
  force?: boolean;
  /** Only this queued item. */
  only?: string;
};

export type FlushResult = { sent: number; kept: number; dropped: number };

/**
 * Sends the signed-in user's queued reports, oldest first, one at a time.
 * Delivered: removed from the queue and added to the reports store. Network / server trouble: kept with
 * `attempts + 1` and an exponential backoff. A 4xx from the server: dropped, with a message for the toast.
 * A 401 keeps the item (the user signs in again and the queue resumes).
 */
export async function flushOutbox(opts: FlushOptions = {}): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, kept: 0, dropped: 0 };
  const userId = useSession.getState().userId;
  if (flushing || !userId) return result;
  flushing = true;
  try {
    if (await isOffline()) {
      result.kept = useOutbox.getState().items.filter((i) => i.userId === userId).length;
      return result;
    }
    const now = Date.now();
    const pending = useOutbox
      .getState()
      .items.filter((i) => i.userId === userId && (!opts.only || i.id === opts.only) && (opts.force || (i.nextAttemptAt ?? 0) <= now))
      .reverse(); // items are newest first: send the oldest first
    for (const item of pending) {
      const outcome = await deliver(item);
      result[outcome === 'sent' ? 'sent' : outcome === 'dropped' ? 'dropped' : 'kept'] += 1;
      if (outcome === 'auth') break; // the session is gone: stop hammering
    }
  } finally {
    flushing = false;
    scheduleRetry();
  }
  return result;
}

async function deliver(item: OutboxItem): Promise<'sent' | 'dropped' | 'kept' | 'auth'> {
  const outbox = useOutbox.getState();
  try {
    const res = await sendReport(item.userId, item.input, (prepared) => outbox.update(item.id, { input: prepared }));
    useReports.getState().ingestSubmitted(res, { last: false });
    outbox.remove(item.id);
    outbox.noteSent();
    return 'sent';
  } catch (e) {
    const kind = classifyFailure(e);
    const message = e instanceof Error && e.message ? e.message : MSG_RETRY_LATER;
    if (kind === 'drop') {
      outbox.remove(item.id);
      outbox.noteDropped(`معرفناش نبعت البلاغ اللي اتحفظ: ${message}`);
      return 'dropped';
    }
    if (kind === 'auth') return 'auth';
    const attempts = (useOutbox.getState().items.find((i) => i.id === item.id)?.attempts ?? item.attempts) + 1;
    outbox.update(item.id, { attempts, lastError: message, nextAttemptAt: Date.now() + backoffMs(attempts) });
    return 'kept';
  }
}
