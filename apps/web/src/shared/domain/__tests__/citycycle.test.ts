import {
  awaitingConfirmation,
  canCancelPickup,
  estimateValue,
  firstName,
  formatEgp,
  formatKg,
  formatPrice,
  impactFromPickups,
  inRange,
  isOpenPickup,
  numText,
  parseKg,
  periodRange,
  stepKg,
  validatePickupInput,
  weighingTotals,
  type RecyclingPickup,
  type Weighing,
} from '../citycycle';

const prices = [
  { materialId: 'pet_plastic' as const, priceEgpPerKg: 5 },
  { materialId: 'paper_cardboard' as const, priceEgpPerKg: 3 },
  { materialId: 'e_waste' as const, priceEgpPerKg: null },
];

const w = (over: Partial<Weighing>): Weighing => ({
  id: 'W1',
  pickupId: 'RCY-1',
  materialId: 'pet_plastic',
  kg: 2,
  source: 'manual',
  priceEgpPerKg: 5,
  valueEgp: 10,
  clientId: 'c1',
  at: '2026-10-22T10:00:00Z',
  ...over,
});

describe('price estimate', () => {
  it('sums kg x price for the priced materials and lists the rest', () => {
    const r = estimateValue(
      [
        { materialId: 'pet_plastic', estimatedKg: 4 },
        { materialId: 'paper_cardboard', estimatedKg: 1.5 },
        { materialId: 'e_waste', estimatedKg: 2 },
      ],
      prices,
    );
    expect(r.valueEgp).toBe(24.5);
    expect(r.unpriced).toEqual(['e_waste']);
  });

  it('gives no value when nothing is priced (never invents one)', () => {
    expect(estimateValue([{ materialId: 'e_waste', estimatedKg: 2 }], prices)).toEqual({ valueEgp: undefined, unpriced: ['e_waste'] });
    expect(estimateValue([{ materialId: 'organics', estimatedKg: 2 }], prices).valueEgp).toBeUndefined();
  });
});

describe('weighing totals', () => {
  it('adds weights per material and flags unpriced weighings', () => {
    const t = weighingTotals([w({}), w({ id: 'W2', clientId: 'c2', kg: 1.5, valueEgp: 7.5 }), w({ id: 'W3', clientId: 'c3', materialId: 'e_waste', kg: 1, priceEgpPerKg: null, valueEgp: null })]);
    expect(t.totalKg).toBe(4.5);
    expect(t.totalValueEgp).toBe(17.5);
    expect(t.hasUnpriced).toBe(true);
    expect(t.byMaterial).toEqual([
      { materialId: 'pet_plastic', kg: 3.5, valueEgp: 17.5 },
      { materialId: 'e_waste', kg: 1, valueEgp: 0 },
    ]);
  });
});

describe('form rules', () => {
  const ok = { items: [{ materialId: 'pet_plastic' as const, estimatedKg: 2 }], location: { lat: 30, lng: 31, address: 'شارع تجريبي' }, day: '2026-10-25' };

  it('accepts a complete pickup', () => {
    expect(validatePickupInput(ok)).toEqual({});
  });

  it('asks for a material, a place and a day, and for sane weights', () => {
    expect(validatePickupInput({ ...ok, items: [] }).items).toBeTruthy();
    expect(validatePickupInput({ ...ok, location: { lat: 1, lng: 1, address: '  ' } }).address).toBeTruthy();
    expect(validatePickupInput({ ...ok, day: '' }).day).toBeTruthy();
    expect(validatePickupInput({ ...ok, items: [{ materialId: 'glass', estimatedKg: 0 }] }).kg).toBeTruthy();
    expect(validatePickupInput({ ...ok, items: [{ materialId: 'glass', estimatedKg: 900 }] }).kg).toBeTruthy();
  });

  it('parses typed weights in Arabic or Western digits', () => {
    expect(parseKg('2.5')).toBe(2.5);
    expect(parseKg('٢٫٥')).toBe(2.5);
    expect(parseKg('2,5')).toBe(2.5);
    expect(parseKg('abc')).toBeNaN();
    expect(parseKg('')).toBeNaN();
    expect(parseKg('-1')).toBeNaN();
  });

  it('steps by half a kilo inside the limits', () => {
    expect(stepKg(2, 1)).toBe(2.5);
    expect(stepKg(0.5, -1)).toBe(0.5);
    expect(stepKg(500, 1)).toBe(500);
  });
});

describe('status helpers', () => {
  const base: RecyclingPickup = {
    id: 'RCY-1', citizenId: 'u', items: [], photoUris: [], location: { lat: 0, lng: 0, address: 'x' }, day: '2026-10-25', slot: 'morning', mode: 'paid',
    status: 'requested', weighings: [], timeline: [], createdAt: '2026-10-22T10:00:00Z',
  };

  it('lets a household cancel only before a collector accepts', () => {
    expect(canCancelPickup(base)).toBe(true);
    expect(canCancelPickup({ ...base, status: 'accepted' })).toBe(false);
  });

  it('knows which pickups are still open', () => {
    expect(isOpenPickup('weighed')).toBe(true);
    expect(isOpenPickup('completed')).toBe(false);
    expect(isOpenPickup('cancelled')).toBe(false);
  });

  it('asks for the household confirmation only after the collector finished', () => {
    expect(awaitingConfirmation({ status: 'weighed', collectorFinishedAt: undefined, confirmedAt: undefined })).toBe(false);
    expect(awaitingConfirmation({ status: 'weighed', collectorFinishedAt: '2026-10-22T11:00:00Z', confirmedAt: undefined })).toBe(true);
    expect(awaitingConfirmation({ status: 'completed', collectorFinishedAt: '2026-10-22T11:00:00Z', confirmedAt: '2026-10-22T12:00:00Z' })).toBe(false);
  });

  it('counts only confirmed pickups in the impact', () => {
    const done: RecyclingPickup = { ...base, id: 'RCY-2', status: 'completed', weighings: [w({ pickupId: 'RCY-2', kg: 3 })] };
    const open: RecyclingPickup = { ...base, id: 'RCY-3', status: 'weighed', weighings: [w({ pickupId: 'RCY-3', kg: 9 })] };
    expect(impactFromPickups([done, open])).toEqual({ totalKg: 3, byMaterial: [{ materialId: 'pet_plastic', kg: 3 }], pickups: 1 });
  });
});

describe('periods and names', () => {
  const now = new Date(2026, 9, 22, 15);

  it('builds inclusive ranges', () => {
    expect(periodRange('today', now)).toEqual({ from: '2026-10-22', to: '2026-10-22' });
    expect(periodRange('week', now)).toEqual({ from: '2026-10-16', to: '2026-10-22' });
    expect(periodRange('all', now).to).toBe('2026-10-22');
  });

  it('checks a timestamp against a range', () => {
    expect(inRange(new Date(2026, 9, 22, 1).toISOString(), { from: '2026-10-22', to: '2026-10-22' })).toBe(true);
    expect(inRange(new Date(2026, 9, 21, 23).toISOString(), { from: '2026-10-22', to: '2026-10-22' })).toBe(false);
  });

  it('shows only the first name of a collector', () => {
    expect(firstName('  أحمد محمود علي ')).toBe('أحمد');
    expect(firstName('')).toBe('');
  });
});

describe('number formatting', () => {
  it('writes Arabic-Indic digits with a decimal comma by default', () => {
    expect(numText(12.5)).toBe('١٢٫٥');
    expect(numText(4)).toBe('٤');
    expect(formatKg(2.5)).toBe('٢٫٥ كجم');
    expect(formatEgp(24.5)).toBe('٢٤٫٥ ج.م');
    expect(formatPrice(5)).toBe('٥ ج.م/كجم');
    expect(formatPrice(null)).toBe('السعر هيتحدد');
  });
});
