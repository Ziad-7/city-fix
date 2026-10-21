import { paymentLabel } from '../requests/labels';
import { validateTreeBooking, type TreeFormValues } from './tree';

const valid: TreeFormValues = {
  workType: 'تقليم',
  day: '2026-10-25',
  slot: 'morning',
  note: ' الفرع قريب من السلك ',
  place: { lat: 30.05, lng: 31.33, address: 'شارع عباس العقاد، مدينة نصر', landmark: '' },
  photoUris: [],
};

describe('validateTreeBooking', () => {
  it('builds a free tree_maintenance booking without payment', () => {
    const { errors, input } = validateTreeBooking({ ...valid, photoUris: ['file:///a.jpg'] });
    expect(errors).toEqual({});
    expect(input?.serviceType).toBe('tree_maintenance');
    expect(input?.details).toMatchObject({ workType: 'تقليم', day: '2026-10-25', slot: 'morning', note: 'الفرع قريب من السلك', photoUris: ['file:///a.jpg'] });
    expect(input?.details.payment).toBeUndefined();
    expect(input?.location.landmark).toBeUndefined();
  });

  it('requires a work type and an address', () => {
    const { errors, input } = validateTreeBooking({ ...valid, workType: '', place: { ...valid.place, address: '  ' } });
    expect(input).toBeNull();
    expect(errors.workType).toBeTruthy();
    expect(errors.address).toBeTruthy();
  });

  it('requires a day', () => {
    expect(validateTreeBooking({ ...valid, day: '' }).errors.day).toBeTruthy();
  });

  it('shows "مجانية" when there is no payment', () => {
    expect(paymentLabel(undefined)).toBe('مجانية');
    expect(paymentLabel('cash')).toBe('كاش مع العامل');
  });
});
