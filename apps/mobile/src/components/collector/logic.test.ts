import type { Earnings, Weighing } from '@/domain/citycycle';
import { demoPriceList } from '@/domain/materials';
import { formatEgp, formatKg } from '@/utils/money';
import { usePrefs } from '@/store/usePrefs';
import {
  EGP_PAD,
  KG_PAD,
  mergeWeighings,
  modeRedirect,
  navigationUrl,
  netEarningsEgp,
  paymentInput,
  paymentPrefill,
  pressKey,
  simulatedScaleKg,
  stepValue,
  weighingTotals,
} from './logic';
import { pendingCompleteOf, pendingWeighingsOf, waitingCount, type QueuedAction } from './queue';
import { sketchPositions } from './JobsMap.web';

const press = (keys: string[], opts = KG_PAD) => keys.reduce((t, k) => pressKey(t, k as never, opts), '');

describe('modeRedirect', () => {
  it('sends collector mode off the citizen tab roots', () => {
    for (const p of ['/', '/map', '/requests', '/profile']) expect(modeRedirect(p, 'collector')).toBe('/collector');
  });
  it('leaves collector routes and other deep links alone in collector mode', () => {
    for (const p of ['/collector', '/collector/map', '/collector/job/RCY-3003', '/requests/R-1', '/notifications']) expect(modeRedirect(p, 'collector')).toBeNull();
  });
  it('sends citizen mode out of /collector, and nowhere else', () => {
    expect(modeRedirect('/collector', 'citizen')).toBe('/');
    expect(modeRedirect('/collector/earnings', 'citizen')).toBe('/');
    expect(modeRedirect('/collector/job/RCY-3003', 'citizen')).toBe('/');
    expect(modeRedirect('/', 'citizen')).toBeNull();
    expect(modeRedirect('/requests/R-1', 'citizen')).toBeNull();
    expect(modeRedirect('/collectors-note', 'citizen')).toBeNull();
  });
  it('ignores a trailing slash', () => {
    expect(modeRedirect('/map/', 'collector')).toBe('/collector');
  });
});

describe('number pad', () => {
  it('types kg with at most one decimal', () => {
    expect(press(['2', '.', '5'])).toBe('2.5');
    expect(press(['2', '.', '5', '7'])).toBe('2.5');
    expect(press(['.', '5'])).toBe('0.5');
    expect(press(['0', '0', '7'])).toBe('7');
  });
  it('ignores a second dot, caps at 200 kg and deletes', () => {
    expect(press(['1', '.', '2', '.'])).toBe('1.2');
    expect(press(['2', '0', '0'])).toBe('200');
    expect(press(['2', '0', '1'])).toBe('20');
    expect(press(['1', '2', 'back'])).toBe('1');
    expect(press(['back'])).toBe('');
  });
  it('EGP has no kg limit and two decimals', () => {
    expect(press(['1', '2', '5', '.', '5', '0'], EGP_PAD)).toBe('125.50');
    expect(press(['1', '.', '2', '5', '9'], EGP_PAD)).toBe('1.25');
  });
  it('steps by 0.5 kg and stays between 0 and the limit', () => {
    expect(stepValue('', 0.5, KG_PAD)).toBe('0.5');
    expect(stepValue('2.5', 0.5, KG_PAD)).toBe('3');
    expect(stepValue('0.5', -0.5, KG_PAD)).toBe('');
    expect(stepValue('0.3', -0.5, KG_PAD)).toBe('');
    expect(stepValue('199.8', 0.5, KG_PAD)).toBe('200');
  });
});

describe('weighing totals', () => {
  const w = (materialId: Weighing['materialId'], kg: number, valueEgp: number | null, clientId: string): Weighing => ({
    id: clientId,
    pickupId: 'RCY-1',
    materialId,
    kg,
    source: 'manual',
    priceEgpPerKg: null,
    valueEgp,
    clientId,
    at: '2026-10-22T10:00:00.000Z',
  });

  it('sums kg and value, most kg first, and flags unpriced rows', () => {
    const t = weighingTotals([w('pet_plastic', 2.5, 25, 'a'), w('paper_cardboard', 6, 24, 'b'), w('organics', 1, null, 'c')]);
    expect(t.totalKg).toBe(9.5);
    expect(t.valueEgp).toBe(49);
    expect(t.byMaterial[0].materialId).toBe('paper_cardboard');
    expect(t.hasUnpriced).toBe(true);
    expect(weighingTotals([w('glass', 1, 1, 'd')]).hasUnpriced).toBe(false);
  });

  it('merges queued weighings with the server ones, prices them at the list, and de-duplicates by clientId', () => {
    const prices = demoPriceList();
    const server = [w('pet_plastic', 2, 20, 'srv-1')];
    const pending = [
      { clientId: 'srv-1', materialId: 'pet_plastic' as const, kg: 2, source: 'manual' as const, at: 'x' },
      { clientId: 'new-1', materialId: 'metal_cans' as const, kg: 1.5, source: 'manual' as const, at: 'y' },
      { clientId: 'new-2', materialId: 'organics' as const, kg: 1, source: 'manual' as const, at: 'z' },
    ];
    const merged = mergeWeighings(server, pending, prices, 'RCY-1');
    expect(merged.map((m) => [m.clientId, m.pending])).toEqual([['srv-1', false], ['new-1', true], ['new-2', true]]);
    expect(merged[1].valueEgp).toBe(18);
    expect(merged[2].valueEgp).toBeNull();
    expect(weighingTotals(merged).totalKg).toBe(4.5);
  });
});

describe('payment', () => {
  it('prefills the weighed value for "get paid" and nothing for "give for free"', () => {
    expect(paymentPrefill('paid', 75.5)).toBe('75.5');
    expect(paymentPrefill('paid', undefined)).toBe('');
    expect(paymentPrefill('paid', 0)).toBe('');
    expect(paymentPrefill('free', 120)).toBe('');
  });
  it('sends no amount for 0 and a rounded amount otherwise', () => {
    expect(paymentInput('')).toEqual({});
    expect(paymentInput('0')).toEqual({});
    expect(paymentInput('75.5')).toEqual({ paidToHouseholdEgp: 75.5 });
    expect(paymentInput('10.256')).toEqual({ paidToHouseholdEgp: 10.26 });
  });
});

describe('earnings', () => {
  const e = (valueEgp: number, paid: number): Earnings => ({ period: { from: '', to: '' }, totalKg: 0, valueEgp, paidToHouseholdsEgp: paid, byMaterial: [], jobs: 0 });
  it('net = value of materials minus cash paid to households', () => {
    expect(netEarningsEgp(e(120, 75))).toBe(45);
    expect(netEarningsEgp(e(0, 0))).toBe(0);
    expect(netEarningsEgp(e(10.1, 0.2))).toBe(9.9);
  });
  it('the net and money format follow the language (Arabic-Indic digits in Arabic)', () => {
    usePrefs.setState({ lang: 'ar' });
    expect(formatEgp(netEarningsEgp(e(120, 75)))).toBe('٤٥\u00a0جنيه');
    expect(formatKg(2.5)).toBe('٢٫٥\u00a0كجم');
    usePrefs.setState({ lang: 'en' });
    expect(formatEgp(1234.5)).toBe('1,234.5\u00a0EGP');
    usePrefs.setState({ lang: 'ar' });
  });
});

describe('simulated hub scale', () => {
  it('stays near the estimate, in 0.1 kg steps, and varies per press', () => {
    const reads = [0, 1, 2, 3, 4].map((n) => simulatedScaleKg(10, n));
    for (const r of reads) {
      expect(r).toBeGreaterThan(8);
      expect(r).toBeLessThan(12);
      expect(Math.round(r * 10)).toBeCloseTo(r * 10, 5);
    }
    expect(new Set(reads).size).toBeGreaterThan(2);
    expect(simulatedScaleKg(0, 0)).toBeGreaterThan(0);
    expect(simulatedScaleKg(0.1, 0)).toBeGreaterThanOrEqual(0.1);
  });
});

describe('navigation link', () => {
  it('uses geo: on Android, Apple Maps on iOS and Google Maps on web', () => {
    expect(navigationUrl('android', 30.062, 31.348)).toBe('geo:30.062,31.348?q=30.062,31.348');
    expect(navigationUrl('ios', 30.062, 31.348)).toBe('maps://?daddr=30.062,31.348&dirflg=d');
    expect(navigationUrl('web', 30.062, 31.348)).toContain('google.com/maps/dir/?api=1&destination=30.062,31.348');
  });
});

describe('offline queue helpers', () => {
  const items: QueuedAction[] = [
    { kind: 'weighing', id: '1', userId: 'u', jobId: 'RCY-1', at: 't', attempts: 0, input: { materialId: 'glass', kg: 2, source: 'manual', clientId: 'c1' } },
    { kind: 'weighing', id: '2', userId: 'u', jobId: 'RCY-2', at: 't', attempts: 0, input: { materialId: 'glass', kg: 1, source: 'manual', clientId: 'c2' } },
    { kind: 'complete', id: '3', userId: 'u', jobId: 'RCY-1', at: 't', attempts: 1, input: { paidToHouseholdEgp: 5 } },
    { kind: 'weighing', id: '4', userId: 'other', jobId: 'RCY-1', at: 't', attempts: 0, input: { materialId: 'glass', kg: 9, source: 'manual', clientId: 'c4' } },
  ];
  it('reads pending weighings, the pending complete and the count per person', () => {
    expect(pendingWeighingsOf(items, 'u', 'RCY-1').map((p) => p.clientId)).toEqual(['c1']);
    expect(pendingCompleteOf(items, 'u', 'RCY-1')?.input.paidToHouseholdEgp).toBe(5);
    expect(pendingCompleteOf(items, 'u', 'RCY-2')).toBeNull();
    expect(waitingCount(items, 'u')).toBe(3);
    expect(waitingCount(items, null)).toBe(0);
  });
});

describe('web map sketch', () => {
  it('puts points inside the box, north up and east right', () => {
    const pos = sketchPositions([{ id: 'a', lat: 30.05, lng: 31.32 }, { id: 'b', lat: 30.07, lng: 31.35 }]);
    expect(pos.b.x).toBeGreaterThan(pos.a.x);
    expect(pos.b.y).toBeLessThan(pos.a.y);
    for (const p of Object.values(pos)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
    }
    expect(sketchPositions([])).toEqual({});
    expect(sketchPositions([{ id: 'a', lat: 1, lng: 1 }]).a).toBeDefined();
  });
});
