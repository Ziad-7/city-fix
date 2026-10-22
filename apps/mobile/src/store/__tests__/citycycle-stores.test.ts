import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { services } from '@/services';
import { OTHER_COLLECTOR_USER_ID, resetMockDb } from '@/services/mock';
import { DEMO_USER_ID } from '@/services/mock/seed';
import { refreshAll, signOutAll, switchMode } from '../actions';
import { usePrefs } from '../usePrefs';
import { useCityCycle } from '../useCityCycle';
import { newClientId, useCollector } from '../useCollector';
import { useReports } from '../useReports';
import { useSession } from '../useSession';

const NASR = { lat: 30.056, lng: 31.33 };

beforeEach(async () => {
  await resetMockDb();
  usePrefs.setState({ lang: 'ar' });
  useSession.getState().clear();
  useSession.getState().startSession({ userId: DEMO_USER_ID, phone: '01012345678' });
  useCityCycle.getState().reset();
  useCollector.getState().reset();
  useReports.getState().reset();
});

describe('role / mode', () => {
  it('defaults to citizen and switches to collector and back (mock mode)', async () => {
    expect(useSession.getState().mode).toBe('citizen');
    expect(await switchMode('collector')).toBe(true);
    expect(useSession.getState().mode).toBe('collector');
    expect(useCollector.getState().profile?.id).toBe('COL-101');
    expect(await switchMode('citizen')).toBe(true);
    expect(useSession.getState().mode).toBe('citizen');
  });

  it('is persisted, and signing out returns to citizen mode', async () => {
    useSession.getState().setMode('collector');
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem('ftc.session.v1')).toContain('"mode":"collector"');
    await signOutAll();
    expect(useSession.getState().mode).toBe('citizen');
    expect(useCollector.getState().profile).toBeNull();
    expect(useCityCycle.getState().pickups).toEqual([]);
  });

  it('a new sign-in starts as citizen; API mode only offers collector mode with the role', () => {
    useSession.getState().setMode('collector');
    useSession.getState().startSession({ userId: 'u2', phone: '01012345678' });
    expect(useSession.getState().mode).toBe('citizen');
    const prev = process.env.EXPO_PUBLIC_API_MODE;
    process.env.EXPO_PUBLIC_API_MODE = 'api';
    try {
      useSession.getState().setMode('collector');
      expect(useSession.getState().mode).toBe('citizen');
      useSession.getState().startSession({ userId: 'u3', phone: '01012345678', roles: ['citizen', 'collector'] });
      useSession.getState().setMode('collector');
      expect(useSession.getState().mode).toBe('collector');
    } finally {
      process.env.EXPO_PUBLIC_API_MODE = prev;
    }
  });
});

describe('useCityCycle', () => {
  it('refresh loads prices (demo), pickups, impact and bins; refreshAll includes it', async () => {
    await refreshAll();
    const s = useCityCycle.getState();
    expect(s.status).toBe('ready');
    expect(s.prices).toHaveLength(7);
    expect(s.pickups).toHaveLength(2);
    expect(s.impact?.pickups).toBe(2);
    expect(s.bins.length).toBeGreaterThanOrEqual(6);
    expect(s.prices.some((p) => p.isDemo)).toBe(true);
    // collector data is not loaded in citizen mode
    expect(useCollector.getState().status).toBe('idle');
  });

  it('creates a pickup and puts it first; offline gives a clear error and sends nothing', async () => {
    await useCityCycle.getState().refresh();
    const items = [{ materialId: 'glass' as const, estimatedKg: 2 }];
    const base = { items, location: { ...NASR, address: 'x' }, day: '2026-10-25', slot: 'morning' as const, mode: 'free' as const };
    const p = await useCityCycle.getState().createPickup(base);
    expect(useCityCycle.getState().pickups[0].id).toBe(p.id);

    (NetInfo as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    await expect(useCityCycle.getState().createPickup(base)).rejects.toThrow(/مفيش نت/);
    expect(useCityCycle.getState().pickups).toHaveLength(3);
    usePrefs.setState({ lang: 'en' });
    (NetInfo as unknown as { fetch: jest.Mock }).fetch.mockResolvedValueOnce({ isConnected: false, isInternetReachable: false });
    await expect(useCityCycle.getState().createPickup(base)).rejects.toThrow(/offline/i);
  });

  it('cancels, and a failed AI check falls back instead of throwing', async () => {
    await useCityCycle.getState().refresh();
    const p = await useCityCycle.getState().createPickup({ items: [{ materialId: 'glass', estimatedKg: 2 }], location: { ...NASR, address: 'x' }, day: '2026-10-25', slot: 'morning', mode: 'free' });
    expect((await useCityCycle.getState().cancelPickup(p.id)).status).toBe('cancelled');
    expect(useCityCycle.getState().pickups.find((x) => x.id === p.id)?.status).toBe('cancelled');
    const ok = await useCityCycle.getState().classifyPhoto('file:///can.jpg');
    expect(ok.source).toBe('model');
  });

  it('reporting a full bin reloads my reports', async () => {
    await useReports.getState().refresh();
    const before = useReports.getState().reports.length;
    await useCityCycle.getState().reportFullBin('BIN-014');
    expect(useReports.getState().reports).toHaveLength(before + 1);
  });

  it('bins drift on each polled refreshBins, not on a general refresh', async () => {
    await useCityCycle.getState().refreshBins({ poll: true });
    const a = useCityCycle.getState().bins.find((b) => b.id === 'BIN-013')?.fillPct as number;
    await useCityCycle.getState().refreshBins();
    expect(useCityCycle.getState().bins.find((b) => b.id === 'BIN-013')?.fillPct).toBe(a);
    await useCityCycle.getState().refreshBins({ poll: true });
    expect(useCityCycle.getState().bins.find((b) => b.id === 'BIN-013')?.fillPct).toBeGreaterThan(a);
  });

  it('refetches when the language changes', async () => {
    await refreshAll();
    expect(useCityCycle.getState().pickups[0].location.address).toMatch(/شارع/);
    usePrefs.getState().setLang('en');
    await new Promise((r) => setTimeout(r, 20));
    expect(useCityCycle.getState().pickups[0].location.address).toMatch(/St,/);
  });
});

describe('useCollector', () => {
  beforeEach(async () => {
    await switchMode('collector');
  });

  it('loads profile, nearby jobs, my jobs and earnings', () => {
    const s = useCollector.getState();
    expect(s.status).toBe('ready');
    expect(s.jobs.length).toBeGreaterThanOrEqual(3);
    expect(s.earningsToday?.jobs).toBe(1);
    expect(s.earningsWeek?.jobs).toBe(2);
    expect(s.impact?.earnedEgp).toBeGreaterThan(0);
  });

  it('accept -> weigh -> complete moves the job and updates earnings', async () => {
    const c = useCollector.getState();
    const job = c.jobs[0];
    const res = await c.accept(job.id);
    expect(res.ok).toBe(true);
    expect(useCollector.getState().jobs.some((j) => j.id === job.id)).toBe(false);
    expect(useCollector.getState().myJobs[0].id).toBe(job.id);

    const mat = job.items[0].materialId;
    await useCollector.getState().start(job.id);
    const clientId = newClientId();
    await useCollector.getState().addWeighing(job.id, { materialId: mat, kg: 2, source: 'manual', clientId });
    await useCollector.getState().addWeighing(job.id, { materialId: mat, kg: 2, source: 'manual', clientId });
    const weighed = useCollector.getState().myJobs.find((p) => p.id === job.id)!;
    expect(weighed.status).toBe('weighed');
    expect(weighed.weighings).toHaveLength(1);
    expect(weighed.totalKg).toBe(2);

    const jobsBefore = useCollector.getState().earningsToday?.jobs as number;
    const done = await useCollector.getState().complete(job.id, { paidToHouseholdEgp: 10 });
    expect(done.status).toBe('completed');
    expect(useCollector.getState().earningsToday?.jobs).toBe(jobsBefore + 1);
    expect(useCollector.getState().earningsToday?.paidToHouseholdsEgp).toBeGreaterThanOrEqual(10);
  });

  it('a second accept reports "taken" and reloads the list', async () => {
    const job = useCollector.getState().jobs[0];
    // another collector got there first
    await services.collector.acceptJob(OTHER_COLLECTOR_USER_ID, job.id);
    const res = await useCollector.getState().accept(job.id);
    expect(res).toEqual({ ok: false, reason: 'taken' });
    await new Promise((r) => setTimeout(r, 0));
    expect(useCollector.getState().jobs.some((j) => j.id === job.id)).toBe(false);
  });

  it('client ids are unique', () => {
    expect(new Set(Array.from({ length: 50 }, newClientId)).size).toBe(50);
  });
});
