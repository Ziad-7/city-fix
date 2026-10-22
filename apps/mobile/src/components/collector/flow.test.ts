import { services } from '@/services';
import { DEMO_COLLECTOR_USER_ID, OTHER_COLLECTOR_USER_ID, resetMockDb } from '@/services/mock';
import { DEMO_USER_ID } from '@/services/mock/seed';
import { usePrefs } from '@/store/usePrefs';
import { useCityCycle } from '@/store/useCityCycle';
import { useCollector } from '@/store/useCollector';
import { useSession } from '@/store/useSession';
import { isOffline } from '@/services/network';
import { flushCollectorQueue, submitComplete, submitWeighing, useCollectorQueue } from './useCollectorQueue';

jest.mock('@/services/network', () => ({
  ...jest.requireActual('@/services/network'),
  isOffline: jest.fn(async () => false),
}));
const offline = isOffline as jest.Mock;

const NASR = { lat: 30.056, lng: 31.33 };

beforeEach(async () => {
  await resetMockDb();
  usePrefs.setState({ lang: 'ar' });
  useSession.getState().clear();
  useSession.getState().startSession({ userId: DEMO_USER_ID, phone: '01012345678' });
  useCityCycle.getState().reset();
  useCollector.getState().reset();
  useCollectorQueue.setState({ items: [], dropped: null });
  offline.mockResolvedValue(false);
  await useCollector.getState().refresh(NASR);
});

describe('offline-first weigh and complete', () => {
  it('sends straight away when online', async () => {
    const accepted = await useCollector.getState().accept('RCY-3003');
    expect(accepted.ok).toBe(true);
    expect(await submitWeighing('RCY-3003', { materialId: 'pet_plastic', kg: 3.5, source: 'manual' })).toBe('sent');
    expect(await submitComplete('RCY-3003', { paidToHouseholdEgp: 35 })).toBe('sent');
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    const job = useCollector.getState().myJobs.find((p) => p.id === 'RCY-3003');
    expect(job?.status).toBe('completed');
    expect(job?.paidToHouseholdEgp).toBe(35);
  });

  it('queues weighings and complete offline, then syncs once with no duplicates', async () => {
    await useCollector.getState().accept('RCY-3003');
    offline.mockResolvedValue(true);
    expect(await submitWeighing('RCY-3003', { materialId: 'pet_plastic', kg: 4, source: 'manual' })).toBe('queued');
    expect(await submitWeighing('RCY-3003', { materialId: 'paper_cardboard', kg: 6.5, source: 'manual' })).toBe('queued');
    expect(await submitComplete('RCY-3003', { paidToHouseholdEgp: 66 })).toBe('queued');
    expect(useCollectorQueue.getState().items.map((i) => i.kind)).toEqual(['weighing', 'weighing', 'complete']);
    expect(useCollector.getState().myJobs.find((p) => p.id === 'RCY-3003')?.weighings).toHaveLength(0);

    // still offline: nothing is sent, nothing is lost
    expect(await flushCollectorQueue()).toEqual({ sent: 0, kept: 3 });

    offline.mockResolvedValue(false);
    const items = [...useCollectorQueue.getState().items];
    expect(await flushCollectorQueue()).toEqual({ sent: 3, kept: 0 });
    // a repeat of an already-sent weighing (same clientId) is not added a second time
    for (const i of items) if (i.kind === 'weighing') await useCollector.getState().addWeighing('RCY-3003', i.input);
    const job = useCollector.getState().myJobs.find((p) => p.id === 'RCY-3003');
    expect(job?.status).toBe('completed');
    expect(job?.weighings).toHaveLength(2);
    expect(job?.totalKg).toBe(10.5);
    expect(job?.paidToHouseholdEgp).toBe(66);
    expect(useCollectorQueue.getState().items).toHaveLength(0);
  });

  it('keeps new actions behind queued ones for the same job, and drops what the server refuses', async () => {
    await useCollector.getState().accept('RCY-3003');
    offline.mockResolvedValue(true);
    await submitWeighing('RCY-3003', { materialId: 'glass', kg: 2, source: 'manual' });
    offline.mockResolvedValue(false);
    // online again, but one action is waiting: the new one queues behind it to keep the order
    expect(await submitWeighing('RCY-3003', { materialId: 'metal_cans', kg: 1, source: 'manual' })).toBe('queued');
    await flushCollectorQueue();
    expect(useCollector.getState().myJobs.find((p) => p.id === 'RCY-3003')?.weighings.map((w) => w.materialId)).toEqual(['glass', 'metal_cans']);

    // completing a job that is not yours is refused by the server: the action is dropped with a notice
    useCollectorQueue.getState().add({ kind: 'complete', id: 'x', userId: DEMO_COLLECTOR_USER_ID, jobId: 'RCY-3004', at: 't', attempts: 0, input: {} });
    await flushCollectorQueue();
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    expect(useCollectorQueue.getState().dropped).not.toBeNull();
  });
});

describe('accept: first wins', () => {
  it('says "already taken" and reloads the list when someone else was first', async () => {
    expect(useCollector.getState().jobs.some((j) => j.id === 'RCY-3004')).toBe(true);
    await services.collector.acceptJob(OTHER_COLLECTOR_USER_ID, 'RCY-3004');
    const res = await useCollector.getState().accept('RCY-3004');
    expect(res).toEqual({ ok: false, reason: 'taken' });
    expect(useCollector.getState().jobs.some((j) => j.id === 'RCY-3004')).toBe(false);
    expect(useCollector.getState().myJobs.some((p) => p.id === 'RCY-3004')).toBe(false);
  });
});
