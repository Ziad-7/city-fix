import NetInfo from '@react-native-community/netinfo';
import { nextWorkingDays } from '@/domain/services-catalog';
import { services } from '@/services';
import { ApiError } from '@/services/api/http';
import { resetMockDb } from '@/services/mock';
import { DEMO_USER_ID } from '@/services/mock/seed';
import { flushCollectorQueue } from '../collectorSync';
import { useCollectorQueue } from '../collectorQueue';
import { useCollector } from '../useCollector';
import { useOutbox } from '../useOutbox';
import { useRecycling } from '../useRecycling';
import { useSession } from '../useSession';

const netinfo = NetInfo as unknown as { fetch: jest.Mock };
const online = { isConnected: true, isInternetReachable: true };
const offline = { isConnected: false, isInternetReachable: false };

const newPickup = (userId = 'household-1') =>
  services.recycling.create(userId, {
    items: [{ materialId: 'pet_plastic', estimatedKg: 4 }],
    location: { lat: 30.0555, lng: 31.3301, address: 'شارع تجريبي' },
    day: nextWorkingDays(1)[0],
    slot: 'morning',
    mode: 'paid',
  });

describe('collector mode: offline-first', () => {
  beforeEach(async () => {
    await resetMockDb();
    useCollectorQueue.setState({ items: [] });
    useCollector.getState().reset();
    useRecycling.getState().reset();
    useOutbox.setState({ items: [], notice: null });
    useSession.setState({ userId: DEMO_USER_ID });
    netinfo.fetch.mockResolvedValue(online);
    await useRecycling.getState().loadPrices();
    await useCollector.getState().apply({ name: 'أحمد محمود', district: 'مدينة نصر أول', materials: [] });
    await useCollector.getState().simulateVerify();
  });

  it('goes straight to the server when online', async () => {
    const p = await newPickup();
    const job = (await services.collector.jobs(DEMO_USER_ID, { lat: 30.056, lng: 31.33, radiusM: 5000 })).find((j) => j.id === p.id)!;
    expect(await useCollector.getState().accept(job)).toBe('done');
    expect(await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 3, source: 'manual' })).toBe('done');
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    expect(useCollector.getState().mine[0]).toMatchObject({ id: p.id, status: 'weighed', totalKg: 3 });
  });

  it('queues behind earlier queued actions even when the network is back, then flushes in order', async () => {
    const p = await newPickup();
    const job = (await services.collector.jobs(DEMO_USER_ID, { lat: 30.056, lng: 31.33, radiusM: 5000 })).find((j) => j.id === p.id)!;
    netinfo.fetch.mockResolvedValue(offline);
    expect(await useCollector.getState().accept(job)).toBe('queued');
    netinfo.fetch.mockResolvedValue(online);
    // The accept is still queued: the weighing must not jump ahead of it.
    expect(await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 2, source: 'manual' })).toBe('queued');
    await flushCollectorQueue({ force: true });
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    const server = await services.recycling.get(p.id);
    expect(server).toMatchObject({ status: 'weighed', collectorId: expect.any(String) });
    expect(server?.weighings).toHaveLength(1);
  });

  it('saves accept, weigh and finish while offline, shows them at once, and syncs once online', async () => {
    const p = await newPickup();
    const job = (await services.collector.jobs(DEMO_USER_ID, { lat: 30.056, lng: 31.33, radiusM: 5000 })).find((j) => j.id === p.id)!;
    netinfo.fetch.mockResolvedValue(offline);

    expect(await useCollector.getState().accept(job)).toBe('queued');
    expect(await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 3.5, source: 'manual' })).toBe('queued');
    expect(await useCollector.getState().complete(p.id, 17.5)).toBe('queued');

    // Local state moved on already.
    const local = useCollector.getState().mine.find((x) => x.id === p.id)!;
    expect(local.status).toBe('weighed');
    expect(local.totalKg).toBe(3.5);
    expect(local.totalValueEgp).toBe(17.5); // priced from the district list
    expect(local.collectorFinishedAt).toBeTruthy();
    expect(useCollector.getState().jobs.some((j) => j.id === p.id)).toBe(false);
    expect(useCollectorQueue.getState().items.map((i) => i.action.kind)).toEqual(['accept', 'weigh', 'complete']);
    // Nothing reached the server yet.
    expect((await services.recycling.get(p.id))?.status).toBe('requested');

    // Still offline: nothing is sent, nothing is lost.
    expect(await flushCollectorQueue({ force: true })).toEqual({ sent: 0, kept: 3, dropped: 0 });

    netinfo.fetch.mockResolvedValue(online);
    expect(await flushCollectorQueue({ force: true })).toEqual({ sent: 3, kept: 0, dropped: 0 });
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    expect(useOutbox.getState().notice).toMatchObject({ ok: true });

    const server = (await services.recycling.get(p.id))!;
    expect(server.status).toBe('weighed');
    expect(server.weighings).toHaveLength(1);
    expect(server.totalKg).toBe(3.5);
    expect(server.paidToHouseholdEgp).toBe(17.5);
    expect(server.collectorFinishedAt).toBeTruthy();

    // A second flush sends nothing, so no duplicate weighing.
    expect(await flushCollectorQueue({ force: true })).toEqual({ sent: 0, kept: 0, dropped: 0 });
    expect((await services.recycling.get(p.id))!.weighings).toHaveLength(1);
    expect(useCollector.getState().mine.find((x) => x.id === p.id)!.weighings).toHaveLength(1);
  });

  it('keeps the queue and its order when the server is down, then sends it', async () => {
    const p = await newPickup();
    await services.collector.accept(DEMO_USER_ID, p.id);
    const add = jest.spyOn(services.collector, 'addWeighing').mockRejectedValueOnce(new ApiError(503, 'down'));
    await useCollector.getState().refreshMine();

    expect(await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 2, source: 'manual' })).toBe('queued');
    add.mockRejectedValueOnce(new ApiError(503, 'down'));
    expect(await flushCollectorQueue({ force: true })).toMatchObject({ sent: 0, kept: 1 });
    expect(useCollectorQueue.getState().items[0].attempts).toBe(1);

    add.mockRestore();
    expect(await flushCollectorQueue({ force: true })).toMatchObject({ sent: 1, kept: 0 });
    expect((await services.recycling.get(p.id))!.weighings).toHaveLength(1);
  });

  it('drops a queued accept that lost the race, with the work saved behind it, and tells the person', async () => {
    const p = await newPickup();
    const job = (await services.collector.jobs(DEMO_USER_ID, { lat: 30.056, lng: 31.33, radiusM: 5000 })).find((j) => j.id === p.id)!;
    netinfo.fetch.mockResolvedValue(offline);
    await useCollector.getState().accept(job);
    await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 2, source: 'manual' });

    // Meanwhile somebody else took it.
    await services.collector.apply('rival', { name: 'سعيد', district: 'مدينة نصر أول', materials: [] });
    await services.collector.simulateVerify('rival');
    await services.collector.accept('rival', p.id);

    netinfo.fetch.mockResolvedValue(online);
    const res = await flushCollectorQueue({ force: true });
    expect(res).toMatchObject({ sent: 0, dropped: 2 });
    expect(useCollectorQueue.getState().items).toHaveLength(0);
    expect(useOutbox.getState().notice).toMatchObject({ ok: false });
    expect(useCollector.getState().mine.some((x) => x.id === p.id)).toBe(false); // the optimistic copy is gone
  });

  it('does not send one account’s saved work from another sign-in', async () => {
    const p = await newPickup();
    await services.collector.accept(DEMO_USER_ID, p.id);
    await useCollector.getState().refreshMine();
    netinfo.fetch.mockResolvedValue(offline);
    await useCollector.getState().weigh(p.id, { materialId: 'pet_plastic', kg: 2, source: 'manual' });
    netinfo.fetch.mockResolvedValue(online);
    useSession.setState({ userId: 'someone-else' });
    expect(await flushCollectorQueue({ force: true })).toEqual({ sent: 0, kept: 0, dropped: 0 });
    expect(useCollectorQueue.getState().items).toHaveLength(1);
  });
});
