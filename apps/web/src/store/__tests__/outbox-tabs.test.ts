import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewReportInput } from '@/domain/types';
import { OUTBOX_KEY, migrateLegacyOutbox } from '@/platform/legacy-outbox';
import { OUTBOX_LOCK, installOutboxTabSync, isQueuedOnDevice, webOutboxSync } from '../outboxTabs';
import { reloadOutbox, setOutboxSync, useOutbox, withOutboxLock, type OutboxItem } from '../useOutbox';

const input: NewReportInput = {
  categoryId: 'pothole',
  description: 'حفرة قدام المدرسة',
  photoUris: [],
  location: { lat: 30.05, lng: 31.33, address: 'شارع عباس العقاد' },
  anonymous: false,
  blurFaces: true,
};
const item = (id: string): OutboxItem => ({ id, userId: 'u1', input, createdAt: '2026-10-01T10:00:00Z', attempts: 0 });

/** What another tab does: writes the persisted queue straight into the shared localStorage. */
const otherTabWrites = (items: OutboxItem[]) => localStorage.setItem(OUTBOX_KEY, JSON.stringify({ state: { items }, version: 0 }));

beforeEach(async () => {
  localStorage.clear();
  useOutbox.setState({ items: [] });
  await useOutbox.persist.rehydrate();
});
afterEach(() => {
  setOutboxSync();
  vi.unstubAllGlobals();
});

describe('two tabs, one localStorage queue', () => {
  it('without a reload, queuing in this tab overwrites the report the other tab saved (the bug)', async () => {
    otherTabWrites([item('Q-tab-b')]);
    useOutbox.getState().enqueue('u1', input); // this tab never saw Q-tab-b
    const stored = JSON.parse(localStorage.getItem(OUTBOX_KEY) as string).state.items as OutboxItem[];
    expect(stored.map((i) => i.id)).not.toContain('Q-tab-b');
  });

  it('reading the queue again before queuing keeps both reports', async () => {
    setOutboxSync(webOutboxSync);
    otherTabWrites([item('Q-tab-b')]);
    await reloadOutbox();
    const mine = useOutbox.getState().enqueue('u1', input);
    const stored = JSON.parse(localStorage.getItem(OUTBOX_KEY) as string).state.items as OutboxItem[];
    expect(stored.map((i) => i.id).sort()).toEqual([mine.id, 'Q-tab-b'].sort());
  });

  it('a storage event from the other tab refreshes this tab, and the cleanup stops listening', async () => {
    const uninstall = installOutboxTabSync();
    otherTabWrites([item('Q-tab-b')]);
    window.dispatchEvent(new StorageEvent('storage', { key: OUTBOX_KEY }));
    await vi.waitFor(() => expect(useOutbox.getState().items.map((i) => i.id)).toEqual(['Q-tab-b']));

    uninstall();
    otherTabWrites([item('Q-tab-b'), item('Q-tab-c')]);
    window.dispatchEvent(new StorageEvent('storage', { key: OUTBOX_KEY }));
    await new Promise((r) => setTimeout(r, 20));
    expect(useOutbox.getState().items).toHaveLength(1);
  });

  it('events for other keys are ignored', async () => {
    const uninstall = installOutboxTabSync();
    otherTabWrites([item('Q-tab-b')]);
    window.dispatchEvent(new StorageEvent('storage', { key: 'ftc.prefs' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(useOutbox.getState().items).toHaveLength(0);
    uninstall();
  });
});

describe('Web Locks', () => {
  it('flushes run one at a time under the ftc-outbox lock', async () => {
    const order: string[] = [];
    let held: Promise<unknown> = Promise.resolve();
    const request = vi.fn((name: string, cb: () => Promise<unknown>) => {
      const run = held.then(() => {
        order.push(`start ${name}`);
        return cb().finally(() => order.push('end'));
      });
      held = run.catch(() => undefined);
      return run;
    });
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    setOutboxSync(webOutboxSync);

    const slow = (label: string) => async () => {
      order.push(`${label} 1`);
      await new Promise((r) => setTimeout(r, 10));
      order.push(`${label} 2`);
      return label;
    };
    const results = await Promise.all([withOutboxLock(slow('a')), withOutboxLock(slow('b'))]);
    expect(results).toEqual(['a', 'b']);
    // b never starts before a has finished
    expect(order).toEqual([`start ${OUTBOX_LOCK}`, 'a 1', 'a 2', 'end', `start ${OUTBOX_LOCK}`, 'b 1', 'b 2', 'end']);
  });

  it('runs the job directly when the browser has no Web Locks', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    setOutboxSync(webOutboxSync);
    expect(await withOutboxLock(async () => 42)).toBe(42);
  });
});

describe('a full disk', () => {
  it('is noticed: the queue in storage does not hold the report', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const queued = useOutbox.getState().enqueue('u1', input);
    expect(useOutbox.getState().items).toHaveLength(1); // in memory only
    expect(isQueuedOnDevice(queued.id)).toBe(false);
    spy.mockRestore();
    useOutbox.getState().update(queued.id, { attempts: 1 }); // the next successful write saves the queue
    expect(isQueuedOnDevice(queued.id)).toBe(true);
  });
});

describe('queue left by the old website build', () => {
  const old = [
    { id: 'q-1', userId: 'u1', input, queuedAt: '2026-10-01T10:00:00Z' },
    { id: 'q-2', userId: 'u1', input, queuedAt: '2026-10-01T11:00:00Z' },
  ];

  it('is converted: newest first, with attempts 0', () => {
    const converted = JSON.parse(migrateLegacyOutbox(JSON.stringify(old)) as string);
    expect(converted.version).toBe(0);
    expect(converted.state.items.map((i: OutboxItem) => i.id)).toEqual(['q-2', 'q-1']);
    expect(converted.state.items[0]).toMatchObject({ userId: 'u1', attempts: 0, createdAt: '2026-10-01T11:00:00Z' });
  });

  it('leaves the new format, junk and empty values alone', () => {
    const fresh = JSON.stringify({ state: { items: [] }, version: 0 });
    expect(migrateLegacyOutbox(fresh)).toBe(fresh);
    expect(migrateLegacyOutbox('not json')).toBe('not json');
    expect(migrateLegacyOutbox(null)).toBeNull();
  });

  it('is picked up when the store loads', async () => {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(old));
    await useOutbox.persist.rehydrate();
    expect(useOutbox.getState().items.map((i) => i.id)).toEqual(['q-2', 'q-1']);
  });
});
