import NetInfo from '@react-native-community/netinfo';
import type { Incident, NewReportInput, Report } from '@/domain/types';
import { services } from '@/services';
import { ApiError } from '@/services/api/http';
import { reopenReport, uploadAndTranscribeVoiceNote } from '../actions';
import { cancelOutboxRetry, flushOutbox } from '../outboxFlush';
import { useOutbox } from '../useOutbox';
import { collectTracked, useNotifications } from '../useNotifications';
import { useReports } from '../useReports';
import { useSession } from '../useSession';

jest.mock('@/notifications/os', () => ({
  showLocalNotification: jest.fn(() => Promise.resolve()),
  setupOsNotifications: jest.fn(),
  ensureNotificationPermission: jest.fn(),
  onNotificationTapped: jest.fn(),
}));

const input: NewReportInput = {
  categoryId: 'pothole',
  description: 'حفرة قدام المدرسة',
  photoUris: [],
  location: { lat: 30.05, lng: 31.23, address: 'شارع النصر' },
  anonymous: false,
  blurFaces: true,
};

const report = (n: number, incidentId = `INC-${n}`): Report => ({
  id: `FTC-${n}`,
  reporterId: 'u1',
  incidentId,
  categoryId: 'pothole',
  description: input.description,
  photoUris: [],
  location: input.location,
  anonymous: false,
  blurFaces: true,
  createdAt: `2026-10-0${n}T10:00:00Z`,
});
const incident = (n: number, status: Incident['status'] = 'received'): Incident =>
  ({ id: `INC-${n}`, linkedReportIds: [`FTC-${n}`], status, department: 'صيانة الطرق', timeline: [] }) as unknown as Incident;
const result = (n: number) => ({ report: report(n), incident: incident(n) });

const netinfo = NetInfo as unknown as { fetch: jest.Mock };
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

beforeEach(() => {
  cancelOutboxRetry();
  useOutbox.setState({ items: [], notice: null });
  useReports.getState().reset();
  useNotifications.getState().reset();
  useSession.setState({ userId: 'u1' });
  netinfo.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});
afterEach(() => {
  cancelOutboxRetry();
  jest.restoreAllMocks();
});

describe('outbox flush concurrency', () => {
  it('concurrent triggers (mount + NetInfo + AppState) send a queued report once', async () => {
    useOutbox.getState().enqueue('u1', input);
    const gate = deferred<{ report: Report; incident: Incident }>();
    const submit = jest.spyOn(services.incidents, 'submitReport').mockReturnValue(gate.promise);
    const a = flushOutbox({ force: true });
    const b = flushOutbox({ force: true });
    const c = flushOutbox();
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve(result(1));
    const results = await Promise.all([a, b, c]);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ sent: 1, kept: 0, dropped: 0 });
    expect(useReports.getState().reports.map((r) => r.id)).toEqual(['FTC-1']);
  });

  it('"ابعت دلوقتي" during a running flush waits for it, then retries the item if that flush could not send it', async () => {
    const item = useOutbox.getState().enqueue('u1', input);
    const gate = deferred<{ report: Report; incident: Incident }>();
    const submit = jest
      .spyOn(services.incidents, 'submitReport')
      .mockReturnValueOnce(gate.promise.then(() => Promise.reject(new ApiError(503, 'السيرفر مش متاح'))))
      .mockResolvedValueOnce(result(2));
    const background = flushOutbox();
    const manual = flushOutbox({ force: true, only: item.id });
    await new Promise((r) => setTimeout(r, 0));
    gate.resolve(result(2));
    expect((await background).kept).toBe(1);
    expect(await manual).toEqual({ sent: 1, kept: 0, dropped: 0 }); // not a false "لسه مقدرناش نبعته"
    expect(submit).toHaveBeenCalledTimes(2);
    expect(useOutbox.getState().items).toHaveLength(0);
  });

  it('stops when the user signs out mid-flush and never files the report into the next session', async () => {
    useOutbox.getState().enqueue('u1', input);
    useOutbox.getState().enqueue('u1', { ...input, description: 'تاني بلاغ في نفس المكان' });
    const gate = deferred<{ report: Report; incident: Incident }>();
    const submit = jest.spyOn(services.incidents, 'submitReport').mockReturnValueOnce(gate.promise);
    const run = flushOutbox({ force: true });
    await new Promise((r) => setTimeout(r, 0));
    useReports.getState().reset();
    useSession.setState({ userId: 'u2' });
    gate.resolve(result(3));
    await run;
    expect(submit).toHaveBeenCalledTimes(1); // the second item waits for u1
    expect(useReports.getState().reports).toHaveLength(0);
    expect(useOutbox.getState().items).toHaveLength(1);
  });
});

describe('refresh vs a report sent meanwhile', () => {
  it('a refresh that started before the POST does not drop the new report', async () => {
    useReports.setState({ status: 'ready' });
    const list = deferred<Report[]>();
    jest.spyOn(services.incidents, 'listMyReports').mockReturnValueOnce(list.promise).mockResolvedValueOnce([report(4)]);
    jest.spyOn(services.incidents, 'listIncidents').mockResolvedValue([incident(4)]);
    jest.spyOn(services.incidents, 'listFollowing').mockResolvedValue([]);
    const refreshing = useReports.getState().refresh();
    useReports.getState().ingestSubmitted(result(4), { last: false });
    list.resolve([]); // the server answered before it had the report
    await refreshing;
    expect(useReports.getState().reports.map((r) => r.id)).toEqual(['FTC-4']);
    expect(useReports.getState().followingIds).toContain('INC-4');
    // once a fetched list contains it, the server copy wins (no duplicate)
    await useReports.getState().refresh();
    expect(useReports.getState().reports.map((r) => r.id)).toEqual(['FTC-4']);
  });
});

describe('notifications at the seams', () => {
  it('a report delivered by the queue is recorded silently (no notification for one\'s own new report)', async () => {
    useReports.setState({ status: 'ready', reports: [report(5)], incidents: [incident(5, 'assigned')] });
    useNotifications.getState().sync(collectTracked());
    useOutbox.getState().enqueue('u1', input);
    jest.spyOn(services.incidents, 'submitReport').mockResolvedValue(result(6));
    await flushOutbox({ force: true });
    expect(useNotifications.getState().sync(collectTracked())).toEqual([]);
    expect(useNotifications.getState().known['FTC-6']).toBe('received');
  });

  it('reopening a report does not notify about the citizen\'s own tap; the next real change does', async () => {
    useReports.setState({ status: 'ready', reports: [report(7)], incidents: [incident(7, 'resolved')] });
    useNotifications.getState().sync(collectTracked());
    const unsub = useReports.subscribe(() => useNotifications.getState().sync(collectTracked()));
    jest.spyOn(services.incidents, 'reopenIncident').mockResolvedValue(incident(7, 'received'));
    await reopenReport('INC-7', 'لسه موجودة');
    expect(useNotifications.getState().items).toHaveLength(0);
    expect(useNotifications.getState().known['FTC-7']).toBe('received');

    useReports.setState({ incidents: [incident(7, 'assigned')] });
    expect(useNotifications.getState().items).toHaveLength(1);
    unsub();
  });

  it('a failed reopen leaves no pending suppression behind', async () => {
    useReports.setState({ status: 'ready', reports: [report(8)], incidents: [incident(8, 'resolved')] });
    useNotifications.getState().sync(collectTracked());
    jest.spyOn(services.incidents, 'reopenIncident').mockRejectedValue(new ApiError(409, 'لا'));
    await expect(reopenReport('INC-8', '')).rejects.toThrow('لا');
    // reopened later by staff: that one is news
    useReports.setState({ incidents: [incident(8, 'received')] });
    expect(useNotifications.getState().sync(collectTracked())).toHaveLength(1);
  });
});

describe('voice note upload', () => {
  it('reports the path as soon as it is uploaded, with the content type the submit pipeline uses', async () => {
    const upload = jest.spyOn(services.uploads, 'upload').mockResolvedValue('voice/abc.m4a');
    jest.spyOn(services.transcription, 'transcribe').mockResolvedValue({ text: 'فيه حفرة', confidence: 0.8 });
    const seen: string[] = [];
    const r = await uploadAndTranscribeVoiceNote('file:///rec/clip.m4a', undefined, (p) => seen.push(p));
    expect(upload).toHaveBeenCalledWith('file:///rec/clip.m4a', 'voice_note', 'audio/mp4');
    expect(seen).toEqual(['voice/abc.m4a']);
    expect(r).toEqual({ path: 'voice/abc.m4a', text: 'فيه حفرة' });
  });

  it('a failed upload returns no path (the form then sends the local file and the pipeline uploads it)', async () => {
    jest.spyOn(services.uploads, 'upload').mockRejectedValue(new ApiError(0, 'net'));
    const onUploaded = jest.fn();
    expect(await uploadAndTranscribeVoiceNote('file:///rec/clip.m4a', undefined, onUploaded)).toEqual({ path: null, text: null });
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
