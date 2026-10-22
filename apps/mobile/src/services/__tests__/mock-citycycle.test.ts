import { periodRange, type NewRecyclingPickupInput } from '@/domain/citycycle';
import { nextWorkingDays } from '@/domain/services-catalog';
import { createMockServices, resetMockDb } from '../mock';
import { DEMO_USER_ID } from '../mock/seed';

const HOUSEHOLD = DEMO_USER_ID;
const COLLECTOR = 'collector-user';
const NEAR = { lat: 30.056, lng: 31.33 };

const pickupInput = (over: Partial<NewRecyclingPickupInput> = {}): NewRecyclingPickupInput => ({
  items: [{ materialId: 'pet_plastic', estimatedKg: 4 }, { materialId: 'e_waste', estimatedKg: 1 }],
  location: { lat: 30.0555, lng: 31.3301, address: 'شارع تجريبي، مدينة نصر', landmark: 'جنب الصيدلية' },
  day: nextWorkingDays(1)[0],
  slot: 'morning',
  mode: 'paid',
  ...over,
});

async function verifiedCollector(s = createMockServices()) {
  await s.collector.apply(COLLECTOR, { name: 'أحمد محمود', district: 'مدينة نصر أول', materials: ['pet_plastic'] });
  await s.collector.simulateVerify(COLLECTOR);
  return s;
}

describe('mock CityCycle: households', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('lists a price for every material, with no price where the district has none', async () => {
    const prices = await createMockServices().recycling.materials('مدينة نصر أول');
    expect(prices).toHaveLength(7);
    expect(prices.find((p) => p.materialId === 'e_waste')?.priceEgpPerKg).toBeNull();
    expect(prices.find((p) => p.materialId === 'pet_plastic')?.priceEgpPerKg).toBeGreaterThan(0);
  });

  it('creates a pickup with an estimate from priced materials only', async () => {
    const s = createMockServices();
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    expect(p.id).toMatch(/^RCY-\d+$/);
    expect(p.status).toBe('requested');
    expect(p.estimatedValueEgp).toBe(20); // 4 kg x 5, e-waste has no price
    expect(p.timeline).toHaveLength(1);
    expect((await s.recycling.listMine(HOUSEHOLD)).map((x) => x.id)).toContain(p.id);
    expect(await s.recycling.listMine('someone-else')).toHaveLength(0);
  });

  it('has no estimate when nothing is priced', async () => {
    const p = await createMockServices().recycling.create(HOUSEHOLD, pickupInput({ items: [{ materialId: 'organics', estimatedKg: 3 }] }));
    expect(p.estimatedValueEgp).toBeUndefined();
  });

  it('cancels only while requested, and only your own', async () => {
    const s = createMockServices();
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    await expect(s.recycling.cancel('other', p.id)).rejects.toMatchObject({ status: 403 });
    expect((await s.recycling.cancel(HOUSEHOLD, p.id, 'غيّرت رأيي')).status).toBe('cancelled');
    await expect(s.recycling.cancel(HOUSEHOLD, p.id)).rejects.toMatchObject({ status: 409 });
  });

  it('answers in the app language', async () => {
    const s = createMockServices();
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    expect(p.timeline[0].note).toContain('طلبك');
  });
});

describe('mock CityCycle: collector mode', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('keeps jobs for verified collectors only', async () => {
    const s = createMockServices();
    await expect(s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 5000 })).rejects.toMatchObject({ status: 403 });
    await s.collector.apply(COLLECTOR, { name: 'أحمد', district: 'مدينة نصر أول', materials: [] });
    expect((await s.collector.me(COLLECTOR))?.status).toBe('pending');
    await expect(s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 5000 })).rejects.toMatchObject({ status: 403 });
    await s.collector.simulateVerify(COLLECTOR);
    expect((await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 5000 })).length).toBeGreaterThan(0);
  });

  it('never shows a household name, phone or exact pin on an open job', async () => {
    const s = await verifiedCollector();
    const own = await s.recycling.create(HOUSEHOLD, pickupInput({ location: { lat: 30.05551234, lng: 31.33019876, address: 'شارع تجريبي' } }));
    const jobs = await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 5000 });
    const job = jobs.find((j) => j.id === own.id)!;
    expect(job).toBeDefined();
    expect(Object.keys(job)).not.toContain('citizenId');
    expect(JSON.stringify(job)).not.toContain(HOUSEHOLD);
    expect(job.location.lat).toBe(30.056);
    expect(job.location.lng).toBe(31.33);
    expect(job.estimatedKg).toBe(5);
  });

  it('sorts jobs nearest first and honours the radius and the material filter', async () => {
    const s = await verifiedCollector();
    const all = await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 50_000 });
    const d = all.map((j) => j.distanceM ?? 0);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect((await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 1 })).length).toBe(0);
    const oil = await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 50_000, materialId: 'cooking_oil' });
    expect(oil.length).toBeGreaterThan(0);
    oil.forEach((j) => expect(j.items.some((i) => i.materialId === 'cooking_oil')).toBe(true));
  });

  it('lets the first collector win and tells the second "already taken"', async () => {
    const s = await verifiedCollector();
    await s.collector.apply('second-collector', { name: 'سعيد', district: 'مدينة نصر أول', materials: [] });
    await s.collector.simulateVerify('second-collector');
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    const taken = await s.collector.accept(COLLECTOR, p.id);
    expect(taken.status).toBe('accepted');
    expect(taken.collectorName).toBe('أحمد'); // first name only
    await expect(s.collector.accept('second-collector', p.id)).rejects.toMatchObject({ status: 409 });
    expect((await s.collector.accept(COLLECTOR, p.id)).status).toBe('accepted'); // same collector again is fine
    expect((await s.collector.jobs(COLLECTOR, { ...NEAR, radiusM: 50_000 })).some((j) => j.id === p.id)).toBe(false);
  });

  it('runs the whole story: accept, weigh, finish, confirm, then the numbers move', async () => {
    const s = await verifiedCollector();
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    await s.collector.accept(COLLECTOR, p.id);

    const w1 = await s.collector.addWeighing(COLLECTOR, p.id, { materialId: 'pet_plastic', kg: 3.5, source: 'manual', clientId: 'c-1' });
    expect(w1.priceEgpPerKg).toBe(5);
    expect(w1.valueEgp).toBe(17.5);
    const w2 = await s.collector.addWeighing(COLLECTOR, p.id, { materialId: 'e_waste', kg: 1, source: 'manual', clientId: 'c-2' });
    expect(w2.valueEgp).toBeNull(); // no price: no value is invented

    let mine = (await s.collector.myPickups(COLLECTOR))[0];
    expect(mine.status).toBe('weighed');
    expect(mine.totalKg).toBe(4.5);
    expect(mine.totalValueEgp).toBe(17.5);

    // Not confirmable before the collector finishes.
    await expect(s.recycling.confirm(HOUSEHOLD, p.id)).rejects.toMatchObject({ status: 409 });
    const done = await s.collector.complete(COLLECTOR, p.id, 17.5);
    expect(done.paidToHouseholdEgp).toBe(17.5);
    expect(done.collectorFinishedAt).toBeTruthy();
    expect(done.status).toBe('weighed');
    // Nothing more can be added after finishing.
    await expect(s.collector.addWeighing(COLLECTOR, p.id, { materialId: 'glass', kg: 1, source: 'manual', clientId: 'c-3' })).rejects.toMatchObject({ status: 409 });

    expect((await s.recycling.impact(HOUSEHOLD)).totalKg).toBe(0); // not confirmed yet
    const confirmed = await s.recycling.confirm(HOUSEHOLD, p.id);
    expect(confirmed.status).toBe('completed');
    const impact = await s.recycling.impact(HOUSEHOLD);
    expect(impact.totalKg).toBe(4.5);
    expect(impact.pickups).toBe(1);

    const earnings = await s.collector.earnings(COLLECTOR, periodRange('today'));
    expect(earnings.totalKg).toBe(4.5);
    expect(earnings.valueEgp).toBe(17.5);
    expect(earnings.paidToHouseholdsEgp).toBe(17.5);
    expect(earnings.jobs).toBe(1);
    mine = (await s.collector.myPickups(COLLECTOR))[0];
    expect(mine.status).toBe('completed');
  });

  it('does not create a second weighing when the same clientId is sent again', async () => {
    const s = await verifiedCollector();
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    await s.collector.accept(COLLECTOR, p.id);
    const input = { materialId: 'pet_plastic' as const, kg: 2, source: 'manual' as const, clientId: 'same' };
    const a = await s.collector.addWeighing(COLLECTOR, p.id, input);
    const b = await s.collector.addWeighing(COLLECTOR, p.id, input);
    expect(b.id).toBe(a.id);
    expect((await s.collector.myPickups(COLLECTOR))[0].weighings).toHaveLength(1);
  });

  it('refuses to finish before anything was weighed, and refuses another collector’s job', async () => {
    const s = await verifiedCollector();
    await s.collector.apply('second-collector', { name: 'سعيد', district: 'مدينة نصر أول', materials: [] });
    await s.collector.simulateVerify('second-collector');
    const p = await s.recycling.create(HOUSEHOLD, pickupInput());
    await s.collector.accept(COLLECTOR, p.id);
    await expect(s.collector.complete(COLLECTOR, p.id, 0)).rejects.toMatchObject({ status: 409 });
    await expect(s.collector.addWeighing('second-collector', p.id, { materialId: 'glass', kg: 1, source: 'manual', clientId: 'x' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('mock CityCycle: smart bins', () => {
  beforeEach(async () => {
    await resetMockDb();
  });

  it('lists bins in every state, with a hub', async () => {
    const bins = await createMockServices().bins.list();
    expect(new Set(bins.map((b) => b.state))).toEqual(new Set(['ok', 'full', 'hot', 'low_battery', 'offline']));
    expect(bins.some((b) => b.kind === 'hub')).toBe(true);
  });

  it('turns "bin is full" into a garbage report in طلباتي', async () => {
    const s = createMockServices();
    const before = (await s.incidents.listMyReports(HOUSEHOLD)).length;
    await s.bins.reportFull(HOUSEHOLD, 'BIN-012', { note: 'الصندوق بيفيض' });
    const reports = await s.incidents.listMyReports(HOUSEHOLD);
    expect(reports).toHaveLength(before + 1);
    expect(reports[0].categoryId).toBe('garbage');
    expect(reports[0].description).toContain('BIN-012');
    await expect(s.bins.reportFull(HOUSEHOLD, 'BIN-999', {})).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock CityCycle: AI waste check', () => {
  it('suggests at most three materials, repeatably, marked as a model answer', async () => {
    const s = createMockServices();
    const a = await s.waste.classify('file:///photo-1.jpg');
    const b = await s.waste.classify('file:///photo-1.jpg');
    expect(a).toEqual(b);
    expect(a.materials.length).toBeLessThanOrEqual(3);
    expect(a.source).toBe('model');
  });
});
