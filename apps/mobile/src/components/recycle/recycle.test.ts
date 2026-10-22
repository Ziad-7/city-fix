import { MATERIAL_IDS, PICKUP_LIMITS } from '@/domain/materials';
import type { PickupItem, RecyclingPickup, WasteClassification } from '@/domain/citycycle';
import { usePrefs } from '@/store/usePrefs';
import {
  applySuggestion,
  collectorFirstName,
  defaultKg,
  extraWeighedRows,
  guideTips,
  hasErrors,
  impactBars,
  impactIsEmpty,
  kgStep,
  pickupItemRows,
  pickupMoney,
  pickupStatusText,
  pickupTitle,
  selectionToItems,
  stepKg,
  suggestionKg,
  toggleMaterial,
  validatePickupForm,
  buildPickupSteps,
} from '.';

beforeEach(() => usePrefs.setState({ lang: 'ar' }));

describe('kg selection', () => {
  it('toggles a material on with its default weight, and off again', () => {
    const on = toggleMaterial({}, 'glass');
    expect(on).toEqual({ glass: defaultKg('glass') });
    expect(toggleMaterial(on, 'glass')).toEqual({});
  });

  it('steps by a sensible amount and stays between the limits', () => {
    expect(stepKg(1, 1, 'pet_plastic')).toBe(1.5);
    expect(stepKg(1, 1, 'paper_cardboard')).toBe(2);
    expect(stepKg(PICKUP_LIMITS.minKg, -1, 'pet_plastic')).toBe(PICKUP_LIMITS.minKg);
    expect(stepKg(PICKUP_LIMITS.maxKgPerMaterial, 1, 'glass')).toBe(PICKUP_LIMITS.maxKgPerMaterial);
    for (const id of MATERIAL_IDS) {
      expect(kgStep(id)).toBeGreaterThan(0);
      expect(defaultKg(id)).toBeGreaterThanOrEqual(PICKUP_LIMITS.minKg);
    }
  });

  it('turns a selection into catalogue-ordered items', () => {
    expect(selectionToItems({ glass: 2, pet_plastic: 1.5 }).map((i) => i.materialId)).toEqual(['pet_plastic', 'glass']);
    expect(selectionToItems({})).toEqual([]);
  });
});

describe('AI suggestion', () => {
  const result: WasteClassification = {
    materials: [{ materialId: 'metal_cans', confidence: 0.7 }, { materialId: 'glass', confidence: 0.2 }],
    size: 'medium',
    estimatedKgRange: [2, 6],
    source: 'model',
  };

  it('takes the middle of the range, or the size default', () => {
    expect(suggestionKg(result)).toBe(4);
    expect(suggestionKg({ size: 'large' })).toBe(8);
    expect(suggestionKg({ size: 'small', estimatedKgRange: [0.5, 1] })).toBe(1);
  });

  it('applies only the most likely material, keeping what was chosen', () => {
    expect(applySuggestion({ glass: 2 }, result)).toEqual({ glass: 2, metal_cans: 4 });
    expect(applySuggestion({ glass: 2 }, { ...result, materials: [], source: 'fallback' })).toEqual({ glass: 2 });
  });
});

describe('validatePickupForm', () => {
  const ok: PickupItem[] = [{ materialId: 'glass', estimatedKg: 2 }];

  it('is clean for a complete form', () => {
    expect(hasErrors(validatePickupForm({ items: ok, address: 'شارع الطيران', day: '2026-10-25' }))).toBe(false);
  });

  it('reports each problem in Arabic', () => {
    const e = validatePickupForm({ items: [], address: '  ', day: null });
    expect(e.items).toBe('اختار خامة واحدة على الأقل');
    expect(e.address).toMatch(/العنوان/);
    expect(e.day).toBe('اختار اليوم');
  });

  it('reports each problem in English, with the kg limits in Western digits', () => {
    usePrefs.setState({ lang: 'en' });
    const e = validatePickupForm({ items: [{ materialId: 'glass', estimatedKg: 500 }], address: '', day: '2026-10-25' });
    expect(e.kg).toBe('The approximate weight of each material must be between 0.5\u00a0kg and 200\u00a0kg');
    expect(e.address).toMatch(/address/i);
    expect(e.items).toBeUndefined();
  });
});

const pickup = (over: Partial<RecyclingPickup> = {}): RecyclingPickup => ({
  id: 'RCY-1',
  citizenId: 'u',
  items: [{ materialId: 'pet_plastic', estimatedKg: 3 }, { materialId: 'glass', estimatedKg: 2 }],
  photoUris: [],
  location: { lat: 30, lng: 31, address: 'x' },
  day: '2026-10-25',
  slot: 'morning',
  mode: 'paid',
  status: 'requested',
  weighings: [],
  timeline: [{ status: 'received', note: 'وصلنا طلب الفرز', actor: 'سيتي سايكل', at: '2026-10-22T08:00:00.000Z' }],
  createdAt: '2026-10-22T08:00:00.000Z',
  ...over,
});

describe('pickup helpers', () => {
  it('titles a pickup by its materials, with "N more" after two', () => {
    expect(pickupTitle(pickup().items)).toBe('تدوير: بلاستيك (إزايز)، إزاز');
    const three = [...pickup().items, { materialId: 'metal_cans' as const, estimatedKg: 1 }, { materialId: 'e_waste' as const, estimatedKg: 1 }];
    expect(pickupTitle(three)).toBe('تدوير: بلاستيك (إزايز)، إزاز، و٢ كمان');
    usePrefs.setState({ lang: 'en' });
    expect(pickupTitle(pickup().items)).toBe('Recycling: Plastic bottles (PET), Glass');
    expect(pickupTitle(three)).toBe('Recycling: Plastic bottles (PET), Glass, +2 more');
  });

  it('says "on the way" once the collector started, and shows only a first name', () => {
    expect(pickupStatusText({ status: 'accepted' })).toBe('اتقبل وفي الطريق');
    expect(pickupStatusText({ status: 'accepted', startedAt: '2026-10-22T09:00:00.000Z' })).toBe('الجامع في الطريق');
    expect(collectorFirstName(' محمود سعيد ')).toBe('محمود');
    expect(collectorFirstName('Mahmoud Saeed')).toBe('Mahmoud');
    expect(collectorFirstName(undefined)).toBeUndefined();
    expect(collectorFirstName('  ')).toBeUndefined();
  });

  it('puts weighed kg beside the estimate and lists materials the collector added', () => {
    const p = pickup({
      weighings: [
        { id: 'w1', pickupId: 'RCY-1', materialId: 'pet_plastic', kg: 2.5, source: 'manual', priceEgpPerKg: 10, valueEgp: 25, clientId: 'c1', at: 'x' },
        { id: 'w2', pickupId: 'RCY-1', materialId: 'metal_cans', kg: 1, source: 'manual', priceEgpPerKg: 12, valueEgp: 12, clientId: 'c2', at: 'x' },
      ],
    });
    expect(pickupItemRows(p)).toEqual([
      { materialId: 'pet_plastic', estimatedKg: 3, weighedKg: 2.5 },
      { materialId: 'glass', estimatedKg: 2 },
    ]);
    expect(extraWeighedRows(p)).toEqual([{ materialId: 'metal_cans', estimatedKg: 0, weighedKg: 1 }]);
  });

  it('adds up money of finished pickups: cash for paid, value given for free', () => {
    const done = (over: Partial<RecyclingPickup>) => pickup({ status: 'completed', ...over });
    const m = pickupMoney([
      done({ mode: 'paid', totalValueEgp: 40, paidToHouseholdEgp: 38 }),
      done({ mode: 'paid', totalValueEgp: 10 }),
      done({ mode: 'free', totalValueEgp: 7.5 }),
      pickup({ mode: 'paid', totalValueEgp: 99, status: 'weighed' }),
      done({ mode: 'free' }),
    ]);
    expect(m).toEqual({ earnedEgp: 48, donatedEgp: 7.5 });
    expect(pickupMoney([])).toEqual({ earnedEgp: 0, donatedEgp: 0 });
  });
});

describe('buildPickupSteps', () => {
  it('shows the next stages as future for a new request', () => {
    const steps = buildPickupSteps(pickup());
    expect(steps.map((s) => s.state)).toEqual(['current', 'future', 'future', 'future']);
    expect(steps[1].title).toBe('جامع يقبل طلبك');
  });

  it('has fewer future steps as it moves on and none when finished or cancelled', () => {
    const accepted = pickup({ status: 'accepted', timeline: [...pickup().timeline, { status: 'assigned', note: 'اتقبل الطلب: محمود', actor: 'محمود', at: '2026-10-22T09:00:00.000Z' }] });
    expect(buildPickupSteps(accepted).map((s) => s.state)).toEqual(['done', 'current', 'future', 'future']);
    expect(buildPickupSteps({ ...accepted, status: 'completed' }).every((s) => s.state === 'done')).toBe(true);
    expect(buildPickupSteps(pickup({ status: 'cancelled' }))).toHaveLength(1);
  });

  it('words the last future step for free and paid pickups, in English too', () => {
    usePrefs.setState({ lang: 'en' });
    expect(buildPickupSteps(pickup({ mode: 'paid' })).at(-1)?.detail).toMatch(/pays you cash/);
    expect(buildPickupSteps(pickup({ mode: 'free' })).at(-1)?.detail).toMatch(/for free/);
  });
});

describe('impact bars', () => {
  it('orders by kg and scales to the biggest', () => {
    const bars = impactBars([{ materialId: 'glass', kg: 2 }, { materialId: 'pet_plastic', kg: 8 }, { materialId: 'organics', kg: 0 }]);
    expect(bars.map((b) => [b.materialId, b.fraction])).toEqual([['pet_plastic', 1], ['glass', 0.25]]);
    expect(impactBars([])).toEqual([]);
  });

  it('is empty until something was weighed', () => {
    expect(impactIsEmpty(null)).toBe(true);
    expect(impactIsEmpty({ totalKg: 0, pickups: 0 })).toBe(true);
    expect(impactIsEmpty({ totalKg: 4.5, pickups: 2 })).toBe(false);
  });
});

describe('sorting guide', () => {
  it.each(['ar', 'en'] as const)('has a short do and don\'t for every material in %s', (lang) => {
    usePrefs.setState({ lang });
    for (const id of MATERIAL_IDS) {
      const t = guideTips(id);
      expect(t.do.length).toBeGreaterThanOrEqual(1);
      expect(t.dont.length).toBeGreaterThanOrEqual(1);
      for (const line of [...t.do, ...t.dont]) {
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(40);
        if (lang === 'en') expect(line).not.toMatch(/[؀-ۿ]/);
        else expect(line).toMatch(/[؀-ۿ]/);
      }
    }
  });
});
