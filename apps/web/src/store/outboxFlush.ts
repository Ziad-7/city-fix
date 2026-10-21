import { tr } from '@/i18n';
import { classifyFailure } from '@/services/media';
import { isOffline } from '@/services/network';
import { sendReport } from '@/services/sendReport';
import { backoffMs, reloadOutbox, useOutbox, withOutboxLock, type OutboxItem } from './useOutbox';
import { useReports } from './useReports';
import { useSession } from './useSession';

export { setOutboxSync, type OutboxSync } from './useOutbox';

export const MSG_RETRY_LATER = 'لسه مفيش نت، هنحاول تاني';
const retryLaterMsg = () => tr(MSG_RETRY_LATER, "We're still offline. We'll try again");

/** The flush in progress, if any: concurrent triggers (mount, NetInfo, AppState, pull-to-refresh) share it. */
let inflight: Promise<FlushResult> | null = null;
let inflightForced = false;
/** Read through a function: TypeScript would otherwise keep its narrowing across the await above. */
const currentFlush = () => inflight;
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
  if (inflight) {
    // A general flush already covers everything this one would send: join it instead of sending twice.
    if (!opts.only && (inflightForced || !opts.force)) return inflight;
    // "ابعت دلوقتي" on one card, or a forced flush (net is back) behind a backoff-respecting one: wait for the
    // running flush (it may deliver these very items), then go again for whatever is still queued.
    await inflight.catch(() => undefined);
    // (Another caller may have started a new flush while this one waited: queue behind it too.)
    if (currentFlush()) return flushOutbox(opts);
    // Already handled by that flush (sent or dropped): the card is gone either way.
    if (opts.only && !useOutbox.getState().items.some((i) => i.id === opts.only)) return { sent: 0, kept: 0, dropped: 0 };
  }
  // One flush at a time across tabs (web): take the lock, then read the queue again, another tab may have changed it.
  const run = withOutboxLock(async () => {
    await reloadOutbox();
    return runFlush(opts);
  });
  inflight = run;
  inflightForced = !!opts.force && !opts.only;
  try {
    return await run;
  } finally {
    if (inflight === run) inflight = null;
    scheduleRetry();
  }
}

async function runFlush(opts: FlushOptions): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, kept: 0, dropped: 0 };
  const userId = useSession.getState().userId;
  if (!userId) return result;
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
    // Signed out (or another account signed in) meanwhile: never send this user's reports with someone else's token.
    if (useSession.getState().userId !== userId) break;
    const outcome = await deliver(item);
    result[outcome === 'sent' ? 'sent' : outcome === 'dropped' ? 'dropped' : 'kept'] += 1;
    if (outcome === 'auth') break; // the session is gone: stop hammering
  }
  return result;
}

async function deliver(item: OutboxItem): Promise<'sent' | 'dropped' | 'kept' | 'auth'> {
  const outbox = useOutbox.getState();
  try {
    const res = await sendReport(item.userId, item.input, (prepared) => outbox.update(item.id, { input: prepared }));
    // Only into the signed-in user's lists (the session may have ended while the POST was in flight).
    if (useSession.getState().userId === item.userId) useReports.getState().ingestSubmitted(res, { last: false });
    outbox.remove(item.id);
    outbox.noteSent();
    return 'sent';
  } catch (e) {
    const kind = classifyFailure(e);
    const message = e instanceof Error && e.message ? e.message : retryLaterMsg();
    if (kind === 'drop') {
      outbox.remove(item.id);
      outbox.noteDropped(tr(`معرفناش نبعت البلاغ اللي اتحفظ: ${message}`, `We couldn't send your saved report: ${message}`));
      return 'dropped';
    }
    if (kind === 'auth') return 'auth';
    const attempts = (useOutbox.getState().items.find((i) => i.id === item.id)?.attempts ?? item.attempts) + 1;
    outbox.update(item.id, { attempts, lastError: message, nextAttemptAt: Date.now() + backoffMs(attempts) });
    return 'kept';
  }
}
