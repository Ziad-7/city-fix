import { PICKUP_STATUS_LABEL_AR, type PickupStatus } from '@/domain/citycycle';
import { BIN_STATE_LABEL_AR, type BinDisplayState } from '@/domain/bins';
import { MATERIALS } from '@/domain/materials';
import { usePrefs } from '@/store/usePrefs';
import { formatEgp, formatEgpPerKg, formatKg } from '@/utils/money';
import {
  alreadyTakenLabel,
  binStateLabel,
  collectorStatusLabel,
  demoPricesLabel,
  materialLabel,
  materialTip,
  pickupModeLabel,
  pickupStatusLabel,
  priceToBeSetLabel,
  wasteSizeLabel,
  weighingSourceLabel,
} from '..';

const setLang = (lang: 'ar' | 'en') => usePrefs.setState({ lang });
const ARABIC = /[؀-ۿ]/;

describe('CityCycle labels', () => {
  afterEach(() => setLang('ar'));

  it('Arabic by default', () => {
    expect(materialLabel('glass')).toBe('إزاز');
    expect(pickupStatusLabel('requested')).toBe(PICKUP_STATUS_LABEL_AR.requested);
    expect(demoPricesLabel()).toBe('أسعار تجريبية');
    expect(priceToBeSetLabel()).toBe('السعر هيتحدد');
    expect(alreadyTakenLabel()).toBe('اتاخد خلاص');
  });

  it('English for every material, tip, status, mode, bin state, size, source and collector status', () => {
    setLang('en');
    for (const m of MATERIALS) {
      expect(materialLabel(m.id)).not.toMatch(ARABIC);
      expect(materialTip(m.id)).not.toMatch(ARABIC);
      expect(materialTip(m.id).length).toBeGreaterThan(10);
    }
    for (const s of Object.keys(PICKUP_STATUS_LABEL_AR) as PickupStatus[]) expect(pickupStatusLabel(s)).not.toMatch(ARABIC);
    for (const s of Object.keys(BIN_STATE_LABEL_AR) as BinDisplayState[]) expect(binStateLabel(s)).not.toMatch(ARABIC);
    for (const m of ['free', 'paid'] as const) expect(pickupModeLabel(m)).not.toMatch(ARABIC);
    for (const s of ['small', 'medium', 'large'] as const) expect(wasteSizeLabel(s)).not.toMatch(ARABIC);
    for (const s of ['manual', 'scale_ble', 'scale_api'] as const) expect(weighingSourceLabel(s)).not.toMatch(ARABIC);
    for (const s of ['pending', 'verified', 'suspended'] as const) expect(collectorStatusLabel(s)).not.toMatch(ARABIC);
  });

  it('follows the glossary', () => {
    setLang('en');
    expect(materialLabel('pet_plastic')).toBe('Plastic bottles (PET)');
    expect(materialLabel('organics')).toBe('Food scraps');
    expect(pickupStatusLabel('requested')).toBe('Waiting for a collector');
    expect(binStateLabel('hot')).toBe('Heat alert');
    expect(binStateLabel('filling')).toBe('Filling up');
    expect(demoPricesLabel()).toBe('Demo prices');
    expect(priceToBeSetLabel()).toBe('Price to be set');
    expect(alreadyTakenLabel()).toBe('Already taken');
    expect(pickupModeLabel('free')).toBe('Give for free');
  });

  it('formats money and weight in the current language', () => {
    expect(formatEgp(120)).toBe('١٢٠ جنيه');
    expect(formatKg(2.5)).toBe('٢٫٥ كجم');
    expect(formatEgpPerKg(10)).toBe('١٠ جنيه للكيلو');
    setLang('en');
    expect(formatEgp(1800)).toBe('1,800 EGP');
    expect(formatKg(2.5)).toBe('2.5 kg');
    expect(formatEgpPerKg(10)).toBe('10 EGP/kg');
  });
});
