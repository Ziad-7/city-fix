import { pickupChipStatus } from '@/domain/citycycle';
import { diffStatuses, pickupStage, type TrackedItem } from '@/domain/notifications';
import { filterRequests } from '@/components/requests/filters';
import { resetMockDb } from '@/services/mock';
import { DEMO_USER_ID } from '@/services/mock/seed';
import { services } from '@/services';
import { buildRequestItems } from '../useRequests';
import { collectTracked, expectOwnChange, useNotifications } from '../useNotifications';
import { usePrefs } from '../usePrefs';
import { useCityCycle } from '../useCityCycle';
import { useReports } from '../useReports';
import { useServiceRequests } from '../useServiceRequests';
import { useSession } from '../useSession';

jest.mock('@/notifications/os', () => ({
  showLocalNotification: jest.fn(() => Promise.resolve()),
  setupOsNotifications: jest.fn(),
  ensureNotificationPermission: jest.fn(),
  onNotificationTapped: jest.fn(),
}));

const NASR = { lat: 30.056, lng: 31.33 };

beforeEach(async () => {
  await resetMockDb();
  usePrefs.setState({ lang: 'ar' });
  useSession.getState().clear();
  useSession.getState().startSession({ userId: DEMO_USER_ID, phone: '01012345678' });
  useCityCycle.getState().reset();
  useReports.getState().reset();
  useServiceRequests.getState().reset();
  useNotifications.getState().reset();
});

describe('requests list with pickups', () => {
  it('merges pickups newest first as their own kind, with a mapped status', async () => {
    await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh(), useCityCycle.getState().refresh()]);
    const { reports, incidents } = useReports.getState();
    const { requests } = useServiceRequests.getState();
    const { pickups } = useCityCycle.getState();
    expect(pickups.length).toBeGreaterThan(0);
    const items = buildRequestItems({ reports, incidents, requests, pickups });
    expect(items).toHaveLength(reports.length + requests.length + pickups.length);
    const times = items.map((i) => i.createdAt);
    expect([...times].sort().reverse()).toEqual(times);
    const mine = items.filter((i) => i.kind === 'pickup');
    expect(mine.map((i) => i.id).sort()).toEqual(pickups.map((p) => p.id).sort());
    for (const it of mine) {
      expect(it.id).toMatch(/^RCY-/);
      expect(it.title).toMatch(/^تدوير: /);
      if (it.kind === 'pickup') expect(it.status).toBe(pickupChipStatus(it.pickup.status));
    }
  });

  it('keeps reports and services unchanged when there are no pickups', async () => {
    await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh()]);
    const { reports, incidents } = useReports.getState();
    const { requests } = useServiceRequests.getState();
    const without = buildRequestItems({ reports, incidents, requests });
    expect(without.every((i) => i.kind !== 'pickup')).toBe(true);
    expect(without).toHaveLength(reports.length + requests.length);
  });

  it('the Recycling filter shows only pickups; Open and Fixed include them by status; Reports and Services exclude them', async () => {
    await Promise.all([useReports.getState().refresh(), useServiceRequests.getState().refresh(), useCityCycle.getState().refresh()]);
    const items = buildRequestItems({ reports: useReports.getState().reports, incidents: useReports.getState().incidents, requests: useServiceRequests.getState().requests, pickups: useCityCycle.getState().pickups });
    const recycling = filterRequests(items, 'recycling');
    expect(recycling.length).toBeGreaterThan(0);
    expect(recycling.every((i) => i.kind === 'pickup')).toBe(true);
    expect(filterRequests(items, 'reports').some((i) => i.kind === 'pickup')).toBe(false);
    expect(filterRequests(items, 'services').some((i) => i.kind === 'pickup')).toBe(false);
    const open = filterRequests(items, 'open').filter((i) => i.kind === 'pickup').length;
    const fixed = filterRequests(items, 'fixed').filter((i) => i.kind === 'pickup').length;
    expect(open + fixed).toBe(recycling.length);
  });

  it('titles follow the language', async () => {
    await useCityCycle.getState().refresh();
    usePrefs.setState({ lang: 'en' });
    const items = buildRequestItems({ reports: [], incidents: [], requests: [], pickups: useCityCycle.getState().pickups });
    expect(items.every((i) => i.title.startsWith('Recycling: '))).toBe(true);
  });
});

describe('pickup notifications', () => {
  const tracked = (over: Partial<TrackedItem> = {}): TrackedItem => ({ entityType: 'pickup', entityId: 'RCY-1', status: 'received', stage: 'requested', ...over });
  const diff = (known: Record<string, string>, item: TrackedItem) => diffStatuses(known, [item], '2026-10-22T10:00:00.000Z', (it, i) => `n-${it.entityId}-${i}`);

  it('notifies on accepted, on the way, weighed and completed, and not on first sight', () => {
    expect(diff({}, tracked()).created).toEqual([]);
    const accepted = diff({ 'RCY-1': 'requested' }, tracked({ status: 'assigned', stage: 'accepted', pickup: { name: 'محمود' } }));
    expect(accepted.created).toHaveLength(1);
    expect(accepted.created[0]).toMatchObject({ entityType: 'pickup', entityId: 'RCY-1', title: 'طلب التدوير RCY-1 اتقبل' });
    expect(accepted.created[0].body).toMatch(/محمود/);
    const onTheWay = diff(accepted.known, tracked({ status: 'assigned', stage: 'on_the_way', pickup: { name: 'محمود' } }));
    expect(onTheWay.created[0].title).toBe('محمود في الطريق ليك');
    const done = diff({ 'RCY-1': 'weighed' }, tracked({ status: 'resolved', stage: 'completed', pickup: { paidEgp: 38 } }));
    expect(done.created[0].title).toBe('طلب التدوير RCY-1 خلص');
    expect(done.created[0].body).toBe('اتدفعلك ٣٨\u00a0جنيه. تسلم إيدك!');
  });

  it('words them in English with Western digits', () => {
    usePrefs.setState({ lang: 'en' });
    expect(diff({ 'RCY-1': 'requested' }, tracked({ status: 'assigned', stage: 'accepted', pickup: { name: 'Mahmoud' } })).created[0]).toMatchObject({
      title: 'Your recycling request RCY-1 was accepted',
      body: 'Mahmoud will come on the day you chose',
    });
    expect(diff({ 'RCY-1': 'accepted' }, tracked({ status: 'assigned', stage: 'on_the_way', pickup: { name: 'Mahmoud' } })).created[0].title).toBe('Mahmoud is on the way');
    expect(diff({ 'RCY-1': 'weighed' }, tracked({ status: 'resolved', stage: 'completed', pickup: { paidEgp: 1234.5 } })).created[0].body).toBe('1,234.5\u00a0EGP paid to you. Thank you!');
    expect(diff({ 'RCY-1': 'accepted' }, tracked({ status: 'in_progress', stage: 'weighed', pickup: { totalKg: 2.5 } })).created[0].body).toBe('Weighed amount: 2.5\u00a0kg. Request RCY-1');
  });

  it('derives the stage from startedAt', () => {
    expect(pickupStage({ status: 'accepted' })).toBe('accepted');
    expect(pickupStage({ status: 'accepted', startedAt: '2026-10-22T09:00:00.000Z' })).toBe('on_the_way');
    expect(pickupStage({ status: 'completed', startedAt: 'x' })).toBe('completed');
  });

  it('collects pickups from the store only once it is loaded', async () => {
    expect(collectTracked().filter((t) => t.entityType === 'pickup')).toEqual([]);
    await useCityCycle.getState().refresh();
    const t = collectTracked().filter((x) => x.entityType === 'pickup');
    expect(t).toHaveLength(useCityCycle.getState().pickups.length);
    expect(t.every((x) => x.stage !== undefined)).toBe(true);
  });

  it('end to end: a collector accepts, starts, weighs and completes, and the citizen gets each notification once', async () => {
    await useCityCycle.getState().refresh();
    const created = await useCityCycle.getState().createPickup({ items: [{ materialId: 'pet_plastic', estimatedKg: 3 }], location: { ...NASR, address: 'x' }, day: '2026-10-25', slot: 'morning', mode: 'paid' });
    const sync = () => useNotifications.getState().sync(collectTracked());
    sync(); // baseline
    expect(useNotifications.getState().items).toHaveLength(0);

    await services.collector.acceptJob('demo-collector', created.id);
    await useCityCycle.getState().refreshPickups();
    sync();
    await services.collector.startJob('demo-collector', created.id);
    await useCityCycle.getState().refreshPickups();
    sync();
    await services.collector.recordWeighing('demo-collector', created.id, { materialId: 'pet_plastic', kg: 2.5, source: 'manual', clientId: 'cid-1' });
    await useCityCycle.getState().refreshPickups();
    sync();
    await services.collector.completeJob('demo-collector', created.id, { paidToHouseholdEgp: 25 });
    await useCityCycle.getState().refreshPickups();
    sync();
    sync(); // nothing new the second time

    const titles = useNotifications.getState().items.filter((n) => n.entityId === created.id).map((n) => n.title).reverse();
    expect(titles).toHaveLength(4);
    expect(titles[0]).toBe(`طلب التدوير ${created.id} اتقبل`);
    expect(titles[1]).toMatch(/في الطريق/);
    expect(titles[2]).toBe('اتوزنت الخامات');
    expect(titles[3]).toBe(`طلب التدوير ${created.id} خلص`);
    expect(useNotifications.getState().items.every((n) => n.entityType === 'pickup' || n.entityId !== created.id)).toBe(true);
  });

  it('cancelling a pickup yourself does not notify you about your own tap', async () => {
    await useCityCycle.getState().refresh();
    const created = await useCityCycle.getState().createPickup({ items: [{ materialId: 'glass', estimatedKg: 2 }], location: { ...NASR, address: 'x' }, day: '2026-10-25', slot: 'morning', mode: 'free' });
    useNotifications.getState().sync(collectTracked());
    const release = expectOwnChange([created.id], 'cancelled');
    await useCityCycle.getState().cancelPickup(created.id);
    useNotifications.getState().sync(collectTracked());
    release();
    expect(useNotifications.getState().items.filter((n) => n.entityId === created.id)).toEqual([]);
    expect(useNotifications.getState().known[created.id]).toBe('cancelled');
  });
});
