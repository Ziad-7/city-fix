import { BIN_THRESHOLDS, binDisplayState } from '@/domain/bins';
import type { NewRecyclingPickupInput } from '@/domain/citycycle';
import { DEMO_MATERIAL_PRICES } from '@/domain/materials';
import { usePrefs } from '@/store/usePrefs';
import { AlreadyTakenError, CityCycleInputError, isAlreadyTaken } from '../citycycle-errors';
import { createMockServices, DEMO_COLLECTOR_USER_ID, OTHER_COLLECTOR_USER_ID, resetMockDb } from '../mock';
import { DEMO_USER_ID } from '../mock/seed';

const NASR = { lat: 30.056, lng: 31.33 };
const input = (over: Partial<NewRecyclingPickupInput> = {}): NewRecyclingPickupInput => ({
  items: [
    { materialId: 'pet_plastic', estimatedKg: 4 },
    { materialId: 'paper_cardboard', estimatedKg: 6 },
  ],
  location: { lat: 30.058, lng: 31.332, address: 'شارع عباس العقاد، مدينة نصر', landmark: 'عمارة ١٢' },
  day: '2026-10-25',
  slot: 'morning',
  mode: 'paid',
  ...over,
});

describe('mock CityCycle: citizen', () => {
  beforeEach(async () => {
    await resetMockDb();
    usePrefs.setState({ lang: 'ar' });
  });

  it('serves the demo price list with demo prices and one unpriced material', async () => {
    const { cityCycle } = createMockServices();
    const prices = await cityCycle.listPrices('مدينة نصر أول');
    expect(prices).toHaveLength(7);
    expect(prices.every((p) => p.isDemo)).toBe(true);
    expect(prices.find((p) => p.materialId === 'pet_plastic')?.priceEgpPerKg).toBe(DEMO_MATERIAL_PRICES.pet_plastic);
    expect(prices.find((p) => p.materialId === 'organics')?.priceEgpPerKg).toBeNull();
  });

  it('seeds two past pickups for the demo citizen, completed, with weighings', async () => {
    const { cityCycle } = createMockServices();
    const mine = await cityCycle.listMyPickups(DEMO_USER_ID);
    expect(mine).toHaveLength(2);
    expect(mine.every((p) => p.status === 'completed' && p.weighings.length > 0 && p.collectorName)).toBe(true);
    expect(mine[0].id).toMatch(/^RCY-\d{4}$/);
    expect(mine[0].totalKg).toBeCloseTo(mine[0].weighings.reduce((s, w) => s + w.kg, 0), 5);
  });

  it('creates a pickup (requested, estimated value from the prices) listed first', async () => {
    const { cityCycle } = createMockServices();
    const p = await cityCycle.createPickup(DEMO_USER_ID, input({ note: 'الدور التالت' }));
    expect(p.id).toMatch(/^RCY-\d{4}$/);
    expect(p.status).toBe('requested');
    expect(p.estimatedValueEgp).toBe(4 * 10 + 6 * 4);
    expect(p.timeline).toHaveLength(1);
    expect(p.timeline[0].status).toBe('received');
    expect((await cityCycle.listMyPickups(DEMO_USER_ID))[0].id).toBe(p.id);
    expect((await cityCycle.getPickup(p.id))?.note).toBe('الدور التالت');
  });

  it('leaves out the estimated value when nothing has a price', async () => {
    const { cityCycle } = createMockServices();
    const p = await cityCycle.createPickup(DEMO_USER_ID, input({ items: [{ materialId: 'organics', estimatedKg: 3 }] }));
    expect(p.estimatedValueEgp).toBeUndefined();
  });

  it('rejects an empty or invalid request with a message in the app language', async () => {
    const { cityCycle } = createMockServices();
    await expect(cityCycle.createPickup(DEMO_USER_ID, input({ items: [] }))).rejects.toBeInstanceOf(CityCycleInputError);
    await expect(cityCycle.createPickup(DEMO_USER_ID, input({ items: [{ materialId: 'glass', estimatedKg: 0 }] }))).rejects.toThrow(/خامة/);
    usePrefs.setState({ lang: 'en' });
    await expect(cityCycle.createPickup(DEMO_USER_ID, input({ items: [] }))).rejects.toThrow(/at least one material/);
    await expect(cityCycle.createPickup(DEMO_USER_ID, input({ day: 'tomorrow' }))).rejects.toThrow(/day/);
  });

  it('cancels only while requested', async () => {
    const { cityCycle, collector } = createMockServices();
    const a = await cityCycle.createPickup(DEMO_USER_ID, input());
    const cancelled = await cityCycle.cancelPickup(DEMO_USER_ID, a.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.timeline[cancelled.timeline.length - 1].status).toBe('closed');
    const b = await cityCycle.createPickup(DEMO_USER_ID, input());
    await collector.acceptJob(DEMO_COLLECTOR_USER_ID, b.id);
    await expect(cityCycle.cancelPickup(DEMO_USER_ID, b.id)).rejects.toBeInstanceOf(CityCycleInputError);
    // not someone else's
    await expect(cityCycle.cancelPickup('other-user', a.id)).rejects.toBeInstanceOf(CityCycleInputError);
  });

  it('localises titles, addresses, collector names and timeline notes in English', async () => {
    const { cityCycle } = createMockServices();
    usePrefs.setState({ lang: 'en' });
    const [p] = await cityCycle.listMyPickups(DEMO_USER_ID);
    expect(p.location.address).toMatch(/St, Nasr City$/);
    expect(p.collectorName).toBe('Mahmoud');
    expect(p.timeline.map((e) => e.note).join(' ')).not.toMatch(/[؀-ۿ]/);
    const bins = await cityCycle.listBins();
    expect(bins.every((b) => !/[؀-ۿ]/.test(`${b.name} ${b.location.address}`))).toBe(true);
  });

  it('classifies a photo with a plausible, stable suggestion', async () => {
    const { cityCycle } = createMockServices();
    const a = await cityCycle.classifyWaste('file:///cache/plastic-bottle.jpg');
    expect(a.source).toBe('model');
    expect(a.materials).toHaveLength(3);
    expect(a.materials[0].materialId).toBe('pet_plastic');
    expect(a.materials[0].confidence).toBeGreaterThan(a.materials[1].confidence);
    expect(new Set(a.materials.map((m) => m.materialId)).size).toBe(3);
    expect(a.estimatedKgRange?.[0]).toBeLessThan(a.estimatedKgRange?.[1] as number);
    expect(await cityCycle.classifyWaste('file:///cache/plastic-bottle.jpg')).toEqual(a);
  });
});

describe('mock CityCycle: bins', () => {
  beforeEach(async () => {
    await resetMockDb();
    usePrefs.setState({ lang: 'ar' });
  });

  it('seeds 8 bins around Nasr City with varied states, incl. one full and one heat alert', async () => {
    const { cityCycle } = createMockServices();
    const bins = await cityCycle.listBins();
    expect(bins.length).toBeGreaterThanOrEqual(6);
    expect(bins.length).toBeLessThanOrEqual(10);
    for (const b of bins) {
      expect(b.id).toMatch(/^BIN-\d{3}$/);
      expect(Math.abs(b.location.lat - NASR.lat)).toBeLessThan(0.02);
      expect(Math.abs(b.location.lng - NASR.lng)).toBeLessThan(0.02);
      expect(b.location.address).not.toMatch(/الجامع|المسجد|مسجد|كنيسة/);
    }
    const states = bins.map((b) => binDisplayState(b));
    expect(states).toContain('full');
    expect(states).toContain('hot');
    expect(states).toContain('filling');
    expect(states).toContain('ok');
    expect(bins.some((b) => b.kind === 'hub')).toBe(true);
    // internal mock fields never leak
    expect(Object.keys(bins[0])).not.toContain('driftPct');
  });

  it('fill levels drift up on every refresh, and cross into full', async () => {
    const { cityCycle } = createMockServices();
    const first = await cityCycle.listBins();
    const second = await cityCycle.listBins();
    const filling = first.find((b) => b.id === 'BIN-013')!;
    expect(second.find((b) => b.id === 'BIN-013')!.fillPct).toBeGreaterThan(filling.fillPct as number);
    // the full bin and the heat-alert bin do not move
    expect(second.find((b) => b.id === 'BIN-014')!.fillPct).toBe(first.find((b) => b.id === 'BIN-014')!.fillPct);
    let last = second;
    for (let i = 0; i < 12; i++) last = await cityCycle.listBins();
    const b = last.find((x) => x.id === 'BIN-013')!;
    expect(b.fillPct).toBeGreaterThanOrEqual(BIN_THRESHOLDS.fullPct);
    expect(b.state).toBe('full');
    expect(Math.max(...last.map((x) => x.fillPct ?? 0))).toBeLessThanOrEqual(100);
  });

  it('a full bin report creates a garbage report at the bin, once a day per person', async () => {
    const { cityCycle, incidents } = createMockServices();
    const before = (await incidents.listMyReports(DEMO_USER_ID)).length;
    await cityCycle.reportFullBin(DEMO_USER_ID, 'BIN-014', { note: 'الزبالة على الرصيف' });
    const reports = await incidents.listMyReports(DEMO_USER_ID);
    expect(reports).toHaveLength(before + 1);
    expect(reports[0].categoryId).toBe('garbage');
    expect(reports[0].description).toContain('صندوق مصطفى النحاس');
    await cityCycle.reportFullBin(DEMO_USER_ID, 'BIN-014');
    expect(await incidents.listMyReports(DEMO_USER_ID)).toHaveLength(before + 1);
    await expect(cityCycle.reportFullBin(DEMO_USER_ID, 'BIN-999')).rejects.toBeInstanceOf(CityCycleInputError);
  });
});

describe('mock CityCycle: collector flow', () => {
  beforeEach(async () => {
    await resetMockDb();
    usePrefs.setState({ lang: 'ar' });
  });

  it('has a verified demo collector profile', async () => {
    const { collector } = createMockServices();
    const me = await collector.getProfile(DEMO_COLLECTOR_USER_ID);
    expect(me.status).toBe('verified');
    expect(me.id).toBe('COL-101');
    expect(Object.keys(me)).not.toContain('userId');
    await expect(collector.getProfile(DEMO_USER_ID)).rejects.toBeInstanceOf(CityCycleInputError);
  });

  it('lists open jobs nearest first without citizen details and with approximate pins', async () => {
    const { collector, cityCycle } = createMockServices();
    const jobs = await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, { ...NASR });
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    const d = jobs.map((j) => j.distanceM as number);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    for (const j of jobs) {
      expect(j.approxPin).toBe(true);
      expect(Object.keys(j)).not.toContain('citizenId');
      expect(j.estimatedKg).toBeGreaterThan(0);
      expect(Number.isInteger(Math.round(j.location.lat * 1000))).toBe(true);
    }
    // my own request is a job for collectors too, but a far-away radius excludes it
    const mine = await cityCycle.createPickup(DEMO_USER_ID, input());
    expect((await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, { ...NASR })).some((j) => j.id === mine.id)).toBe(true);
    expect(await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, { lat: 31.2, lng: 29.9 })).toEqual([]);
    const oil = await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, { ...NASR, materialId: 'cooking_oil' });
    expect(oil.length).toBeGreaterThan(0);
    expect(oil.every((j) => j.items.some((i) => i.materialId === 'cooking_oil'))).toBe(true);
  });

  it('accept -> start -> weigh -> complete updates the citizen pickup and impact', async () => {
    const { cityCycle, collector } = createMockServices();
    const impact0 = await cityCycle.getMyImpact(DEMO_USER_ID);
    const p = await cityCycle.createPickup(DEMO_USER_ID, input());

    const accepted = await collector.acceptJob(DEMO_COLLECTOR_USER_ID, p.id);
    expect(accepted.status).toBe('accepted');
    expect(accepted.collectorName).toBe('محمود');
    expect(accepted.location.lat).toBe(30.058);
    expect((await cityCycle.getPickup(p.id))?.status).toBe('accepted');
    // no longer an open job
    expect((await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, NASR)).some((j) => j.id === p.id)).toBe(false);

    const started = await collector.startJob(DEMO_COLLECTOR_USER_ID, p.id);
    expect(started.startedAt).toBeTruthy();
    expect(started.timeline).toHaveLength(3);
    expect((await collector.startJob(DEMO_COLLECTOR_USER_ID, p.id)).timeline).toHaveLength(3);

    const w1 = await collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'pet_plastic', kg: 3.5, source: 'manual', clientId: 'c1' });
    expect(w1.priceEgpPerKg).toBe(10);
    expect(w1.valueEgp).toBe(35);
    // the same clientId again does not add a row (offline retry)
    const again = await collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'pet_plastic', kg: 3.5, source: 'manual', clientId: 'c1' });
    expect(again.id).toBe(w1.id);
    await collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'paper_cardboard', kg: 5.5, source: 'scale_ble', scaleId: 'HUB-1', clientId: 'c2' });
    const weighed = await cityCycle.getPickup(p.id);
    expect(weighed?.status).toBe('weighed');
    expect(weighed?.weighings).toHaveLength(2);
    expect(weighed?.totalKg).toBe(9);
    expect(weighed?.totalValueEgp).toBe(35 + 22);
    expect(weighed?.timeline.filter((e) => e.status === 'in_progress')).toHaveLength(1);

    const done = await collector.completeJob(DEMO_COLLECTOR_USER_ID, p.id, { paidToHouseholdEgp: 57 });
    expect(done.status).toBe('completed');
    expect(done.paidToHouseholdEgp).toBe(57);
    expect(done.timeline[done.timeline.length - 1].status).toBe('resolved');
    expect((await cityCycle.getPickup(p.id))?.status).toBe('completed');

    // citizen impact = sum of the completed weighings
    const impact = await cityCycle.getMyImpact(DEMO_USER_ID);
    expect(impact.pickups).toBe(impact0.pickups + 1);
    expect(impact.totalKg).toBeCloseTo(impact0.totalKg + 9, 5);
    expect(impact.earnedEgp).toBeUndefined();
    expect(impact.totalKg).toBeCloseTo(
      (await cityCycle.listMyPickups(DEMO_USER_ID)).filter((x) => x.status === 'completed').reduce((s, x) => s + x.weighings.reduce((k, w) => k + w.kg, 0), 0),
      5,
    );

    // the household can acknowledge the result
    expect((await cityCycle.confirmPickup(DEMO_USER_ID, p.id)).confirmedAt).toBeTruthy();
  });

  it('a free pickup completes with no payment', async () => {
    const { cityCycle, collector } = createMockServices();
    const p = await cityCycle.createPickup(DEMO_USER_ID, input({ mode: 'free' }));
    await collector.acceptJob(DEMO_COLLECTOR_USER_ID, p.id);
    await collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'pet_plastic', kg: 2, source: 'manual', clientId: 'f1' });
    const done = await collector.completeJob(DEMO_COLLECTOR_USER_ID, p.id);
    expect(done.status).toBe('completed');
    expect(done.paidToHouseholdEgp).toBeUndefined();
  });

  it('first accept wins: the second collector gets "already taken"', async () => {
    const { collector } = createMockServices();
    const [job] = await collector.listNearbyJobs(DEMO_COLLECTOR_USER_ID, NASR);
    await collector.acceptJob(DEMO_COLLECTOR_USER_ID, job.id);
    const err = await collector.acceptJob(OTHER_COLLECTOR_USER_ID, job.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AlreadyTakenError);
    expect(isAlreadyTaken(err)).toBe(true);
    expect((err as Error).message).toBe('اتاخد خلاص');
    usePrefs.setState({ lang: 'en' });
    expect(((await collector.acceptJob(OTHER_COLLECTOR_USER_ID, job.id).catch((e: unknown) => e)) as Error).message).toBe('Already taken');
    // the winner accepting again is harmless
    expect((await collector.acceptJob(DEMO_COLLECTOR_USER_ID, job.id)).status).toBe('accepted');
  });

  it('refuses a bad weighing, completing without weighing, and other collectors’ jobs', async () => {
    const { cityCycle, collector } = createMockServices();
    const p = await cityCycle.createPickup(DEMO_USER_ID, input());
    await expect(collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'glass', kg: 1, source: 'manual', clientId: 'x' })).rejects.toBeInstanceOf(CityCycleInputError);
    await collector.acceptJob(DEMO_COLLECTOR_USER_ID, p.id);
    for (const kg of [0, -2, Number.NaN]) {
      await expect(collector.recordWeighing(DEMO_COLLECTOR_USER_ID, p.id, { materialId: 'glass', kg, source: 'manual', clientId: `b${kg}` })).rejects.toBeInstanceOf(CityCycleInputError);
    }
    await expect(collector.completeJob(DEMO_COLLECTOR_USER_ID, p.id)).rejects.toBeInstanceOf(CityCycleInputError);
    await expect(collector.recordWeighing(OTHER_COLLECTOR_USER_ID, p.id, { materialId: 'glass', kg: 1, source: 'manual', clientId: 'y' })).rejects.toBeInstanceOf(CityCycleInputError);
  });

  it('earnings count completed jobs in the period, with the paid cash', async () => {
    const { collector } = createMockServices();
    const now = new Date();
    const week = await collector.getEarnings(DEMO_COLLECTOR_USER_ID, { from: new Date(now.getTime() - 7 * 86_400_000).toISOString(), to: now.toISOString() });
    // seeded: today's job (glass 6 + pet 3.2) and the one 6 days ago (paper 7.4 + pet 4.6)
    expect(week.jobs).toBe(2);
    expect(week.totalKg).toBeCloseTo(6 + 3.2 + 7.4 + 4.6, 5);
    expect(week.valueEgp).toBeCloseTo(6 * 1 + 3.2 * 10 + 7.4 * 4 + 4.6 * 10, 5);
    expect(week.paidToHouseholdsEgp).toBe(38 + 75);
    expect(week.byMaterial[0].kg).toBeGreaterThanOrEqual(week.byMaterial[1].kg);
    const none = await collector.getEarnings(DEMO_COLLECTOR_USER_ID, { from: '2020-01-01', to: '2020-01-31' });
    expect(none).toMatchObject({ jobs: 0, totalKg: 0, valueEgp: 0, byMaterial: [] });
  });

  it('collector impact includes earned EGP; my jobs list active first', async () => {
    const { cityCycle, collector } = createMockServices();
    const impact = await cityCycle.getMyImpact(DEMO_COLLECTOR_USER_ID);
    expect(impact.earnedEgp).toBeGreaterThan(0);
    const p = await cityCycle.createPickup(DEMO_USER_ID, input());
    await collector.acceptJob(DEMO_COLLECTOR_USER_ID, p.id);
    const mine = await collector.listMyJobs(DEMO_COLLECTOR_USER_ID);
    expect(mine[0].id).toBe(p.id);
    expect(mine.slice(1).every((x) => x.status === 'completed')).toBe(true);
  });

  it('the dev helper walks a pickup through all statuses', async () => {
    const { cityCycle } = createMockServices();
    const p = await cityCycle.createPickup(DEMO_USER_ID, input());
    const seen: string[] = [];
    let cur = p;
    for (let i = 0; i < 4; i++) {
      cur = await cityCycle.simulatePickupProgress(cur.id);
      seen.push(cur.status);
    }
    expect(seen).toEqual(['accepted', 'weighed', 'completed', 'completed']);
    expect(cur.paidToHouseholdEgp).toBe(cur.totalValueEgp);
  });
});
