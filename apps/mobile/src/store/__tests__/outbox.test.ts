import NetInfo from '@react-native-community/netinfo';
import type { Incident, NewReportInput, Report } from '@/domain/types';
import { services } from '@/services';
import { ApiError } from '@/services/api/http';
import { cancelOutboxRetry, flushOutbox } from '../outboxFlush';
import { setOutboxSync, useOutbox, type OutboxItem } from '../useOutbox';
import { useReports } from '../useReports';
import { useSession } from '../useSession';

const input: NewReportInput = {
  categoryId: 'pothole',
  description: 'حفرة قدام المدرسة',
  photoUris: ['file:///cache/a.jpg'],
  location: { lat: 30.05, lng: 31.23, address: 'شارع النصر' },
  anonymous: false,
  blurFaces: true,
};

const result = (n: number): { report: Report; incident: Incident } => ({
  report: { id: `FTC-${n}`, reporterId: 'u1', incidentId: `INC-${n}`, categoryId: 'pothole', description: input.description, photoUris: [], location: input.location, anonymous: false, blurFaces: true, createdAt: '2026-10-01T10:00:00Z' },
  incident: { id: `INC-${n}`, linkedReportIds: [`FTC-${n}`], status: 'received' } as unknown as Incident,
});

const netinfo = NetInfo as unknown as { fetch: jest.Mock };
const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };

describe('offline queue', () => {
  let submit: jest.SpyInstance;
  beforeEach(() => {
    cancelOutboxRetry();
    useOutbox.setState({ items: [], notice: null });
    useReports.getState().reset();
    useSession.setState({ userId: 'u1' });
    netinfo.fetch.mockResolvedValue(online);
    submit = jest.spyOn(services.incidents, 'submitReport');
  });
  afterEach(() => {
    cancelOutboxRetry();
    submit.mockRestore();
  });

  it('submitReport queues instead of failing when offline', async () => {
    netinfo.fetch.mockResolvedValue(offline);
    const res = await useReports.getState().submitReport(input);
    expect(res.queued).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    const items = useOutbox.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ userId: 'u1', attempts: 0, input: { description: input.description } });
  });

  it('submitReport queues on a network error but rethrows a 4xx', async () => {
    submit.mockRejectedValueOnce(new ApiError(0, 'مفيش اتصال'));
    expect((await useReports.getState().submitReport(input)).queued).toBe(true);
    expect(useOutbox.getState().items).toHaveLength(1);

    submit.mockRejectedValueOnce(new ApiError(422, 'الوصف قصير'));
    await expect(useReports.getState().submitReport(input)).rejects.toThrow('الوصف قصير');
    expect(useOutbox.getState().items).toHaveLength(1);
  });

  it('submitReport online goes straight to the reports store', async () => {
    submit.mockResolvedValueOnce(result(1));
    const res = await useReports.getState().submitReport(input);
    expect(res.queued).toBe(false);
    expect(useReports.getState().reports.map((r) => r.id)).toEqual(['FTC-1']);
    expect(useOutbox.getState().items).toHaveLength(0);
  });

  it('flush success removes the item, adds the real report and raises the toast', async () => {
    useOutbox.getState().enqueue('u1', input);
    submit.mockResolvedValueOnce(result(7));
    const r = await flushOutbox({ force: true });
    expect(r).toEqual({ sent: 1, kept: 0, dropped: 0 });
    expect(useOutbox.getState().items).toHaveLength(0);
    expect(useReports.getState().reports[0].id).toBe('FTC-7');
    expect(useOutbox.getState().notice).toMatchObject({ ok: true, text: 'بلاغك اتبعت' });
  });

  it('flush failure keeps the item with attempts, error and a backoff', async () => {
    const item = useOutbox.getState().enqueue('u1', input);
    submit.mockRejectedValueOnce(new ApiError(503, 'السيرفر مش متاح'));
    const r = await flushOutbox({ force: true });
    expect(r.kept).toBe(1);
    const kept = useOutbox.getState().items[0];
    expect(kept.id).toBe(item.id);
    expect(kept.attempts).toBe(1);
    expect(kept.lastError).toBe('السيرفر مش متاح');
    expect(kept.nextAttemptAt).toBeGreaterThan(Date.now());

    // not due yet: an automatic flush leaves it alone; a forced one retries
    submit.mockClear();
    await flushOutbox();
    expect(submit).not.toHaveBeenCalled();
    submit.mockResolvedValueOnce(result(8));
    expect((await flushOutbox({ force: true })).sent).toBe(1);
  });

  it('a 4xx drops the item and reports why', async () => {
    useOutbox.getState().enqueue('u1', input);
    submit.mockRejectedValueOnce(new ApiError(404, 'البلاغ ده مش موجود'));
    const r = await flushOutbox({ force: true });
    expect(r.dropped).toBe(1);
    expect(useOutbox.getState().items).toHaveLength(0);
    expect(useOutbox.getState().notice?.text).toContain('البلاغ ده مش موجود');
  });

  it('does nothing while offline and ignores other users', async () => {
    useOutbox.getState().enqueue('u1', input);
    useOutbox.getState().enqueue('someone-else', input);
    netinfo.fetch.mockResolvedValue(offline);
    expect((await flushOutbox({ force: true })).kept).toBe(1);
    expect(submit).not.toHaveBeenCalled();

    netinfo.fetch.mockResolvedValue(online);
    submit.mockResolvedValue(result(9));
    await flushOutbox({ force: true });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(useOutbox.getState().items.map((i) => i.userId)).toEqual(['someone-else']);
  });

  it('keeps already-uploaded paths when the POST fails, so a retry does not upload again', async () => {
    const upload = jest.spyOn(services.uploads, 'upload').mockResolvedValue('uploads/a.jpg');
    submit.mockRejectedValueOnce(new ApiError(0, 'net'));
    await useReports.getState().submitReport(input);
    expect(useOutbox.getState().items[0].input.photoUris).toEqual(['uploads/a.jpg']);
    submit.mockResolvedValueOnce(result(3));
    await flushOutbox({ force: true });
    expect(upload).toHaveBeenCalledTimes(1);
    upload.mockRestore();
  });
});

describe('cross-tab seam (the website plugs a lock and a reload in; on the phone both do nothing)', () => {
  // What "storage" holds: another tab writes here, `reload` copies it into the store.
  let stored: OutboxItem[];
  let log: string[];
  let submit: jest.SpyInstance;
  const item = (id: string): OutboxItem => ({ id, userId: 'u1', input, createdAt: '2026-10-01T10:00:00Z', attempts: 0 });

  beforeEach(() => {
    cancelOutboxRetry();
    stored = [];
    log = [];
    useOutbox.setState({ items: [], notice: null });
    useReports.getState().reset();
    useSession.setState({ userId: 'u1' });
    netinfo.fetch.mockResolvedValue(online);
    submit = jest.spyOn(services.incidents, 'submitReport');
    let tail: Promise<unknown> = Promise.resolve();
    setOutboxSync({
      // a mutex, like navigator.locks.request('ftc-outbox', job)
      lock: <T,>(job: () => Promise<T>) => {
        const run = tail.then(() => {
          log.push('lock');
          return job();
        });
        tail = run.catch(() => undefined);
        return run;
      },
      reload: async () => {
        log.push('reload');
        useOutbox.setState({ items: stored });
      },
    });
  });
  afterEach(() => {
    cancelOutboxRetry();
    setOutboxSync();
    submit.mockRestore();
  });

  it('a flush takes the lock and reads the queue again before sending', async () => {
    // This tab never saw the report another tab queued: only the reload can find it.
    stored = [item('Q-other')];
    submit.mockResolvedValueOnce(result(1));
    expect((await flushOutbox({ force: true })).sent).toBe(1);
    expect(log.slice(0, 2)).toEqual(['lock', 'reload']);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('does not send a report another tab already delivered (no duplicate)', async () => {
    // This tab still holds Q-1 in memory, but the other tab sent it and the shared queue is empty.
    useOutbox.setState({ items: [item('Q-1')] });
    stored = [];
    expect((await flushOutbox({ force: true })).sent).toBe(0);
    expect(submit).not.toHaveBeenCalled();
  });

  it("queuing a report offline reads the queue first, so another tab's report is kept", async () => {
    stored = [item('Q-other')];
    netinfo.fetch.mockResolvedValue(offline);
    const res = await useReports.getState().submitReport(input);
    expect(res.queued).toBe(true);
    expect(useOutbox.getState().items).toHaveLength(2);
    expect(useOutbox.getState().items.map((i) => i.id)).toContain('Q-other');
  });

  it('without hooks (the phone) nothing is reloaded and the queue stays as it is', async () => {
    setOutboxSync();
    useOutbox.setState({ items: [item('Q-1')] });
    stored = [];
    submit.mockResolvedValueOnce(result(2));
    expect((await flushOutbox({ force: true })).sent).toBe(1);
    expect(log).toEqual([]);
  });
});
