import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewReportInput } from '@/domain/types';

const input: NewReportInput = {
  categoryId: 'pothole',
  description: 'حفرة كبيرة قدام المدرسة',
  photoUris: [],
  location: { lat: 30.06, lng: 31.34, address: 'شارع مكرم عبيد' },
  anonymous: false,
  blurFaces: true,
};

async function load() {
  vi.resetModules();
  const outbox = await import('../outbox');
  const store = await import('@/store');
  const http = await import('@/services/api/http');
  return { ...outbox, ...store, ApiError: http.ApiError };
}

describe('outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps a saved report in localStorage, so a closed tab loses nothing', async () => {
    const { useOutbox, OUTBOX_KEY } = await load();
    useOutbox.getState().add('u1', input);
    const { useOutbox: again } = await load();
    again.getState().load();
    expect(again.getState().items).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)!)[0].input.description).toBe(input.description);
  });

  it('sends only the signed-in user\'s reports and empties the queue', async () => {
    const { useOutbox, useReports } = await load();
    const submit = vi.fn().mockResolvedValue({});
    useReports.setState({ submitReport: submit });
    useOutbox.getState().add('u1', input);
    useOutbox.getState().add('u2', { ...input, description: 'بلاغ حد تاني' });
    expect(await useOutbox.getState().flush('u1')).toBe(1);
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ description: input.description }));
    expect(useOutbox.getState().items.map((i) => i.userId)).toEqual(['u2']);
  });

  it('stops at the first failure and keeps the rest for next time', async () => {
    const { useOutbox, useReports, ApiError } = await load();
    const submit = vi.fn().mockRejectedValue(new ApiError(0, 'offline'));
    useReports.setState({ submitReport: submit });
    useOutbox.getState().add('u1', input);
    useOutbox.getState().add('u1', input);
    expect(await useOutbox.getState().flush('u1')).toBe(0);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(useOutbox.getState().items).toHaveLength(2);
  });

  it('does not send a report twice when flush runs again while one is in flight', async () => {
    const { useOutbox, useReports } = await load();
    const submit = vi.fn().mockResolvedValue({});
    useReports.setState({ submitReport: submit });
    useOutbox.getState().add('u1', input);
    const [a, b] = await Promise.all([useOutbox.getState().flush('u1'), useOutbox.getState().flush('u1')]);
    expect(a + b).toBe(1);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('says plainly when the device has no room', async () => {
    const { useOutbox } = await load();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => useOutbox.getState().add('u1', input)).toThrow('مفيش مساحة');
  });

  it('tells a lost connection apart from a refusal', async () => {
    const { isNetworkFailure, ApiError } = await load();
    expect(isNetworkFailure(new ApiError(0, 'x'))).toBe(true);
    expect(isNetworkFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkFailure(new ApiError(422, 'x'))).toBe(false);
  });
});
