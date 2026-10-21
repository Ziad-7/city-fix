import { newReportSchema, phoneSchema } from '@/domain/schemas';
import { triageMock } from '@/logic/triage-mock';
import { usePrefs } from '@/store/usePrefs';
import { addressAfterMove, formatAddress } from './address';
import { distanceLabel, moreReports, neighbours, reportedBy } from './text';
import { validateReportForm } from './validation';
import { formatTimer } from './voice';

beforeEach(() => usePrefs.setState({ lang: 'en' }));
afterEach(() => usePrefs.setState({ lang: 'ar' }));

describe('report helpers in English', () => {
  it('pluralises', () => {
    expect(moreReports(1)).toBe('1 more report');
    expect(moreReports(7)).toBe('7 more reports');
    expect(reportedBy(6)).toBe('Reported by 6 people');
    expect(neighbours(0)).toBe('Be the first to say Me too');
    expect(neighbours(12)).toBe('12 neighbours said Me too');
  });
  it('uses Western digits and units', () => {
    expect(formatTimer(65)).toBe('01:05');
    expect(distanceLabel(42)).toBe('40 m');
    expect(distanceLabel(1234)).toBe('1.2 km');
  });
  it('formats addresses in English', () => {
    expect(formatAddress({ street: 'Abbas El Akkad St', district: 'Nasr City' })).toBe('Abbas El Akkad St, Nasr City');
    expect(addressAfterMove('', ' ')).toBe('Spot on the map');
  });
  it('gives English validation messages', () => {
    const errs = validateReportForm({ categoryId: '', description: '', photoUris: [], location: { lat: 1, lng: 1, address: '' }, anonymous: false, blurFaces: true });
    expect(errs.categoryId).toBe('Choose the type of problem');
    expect(errs.address).toBe('Enter the address');
    expect(errs.description).toMatch(/^Add a photo/);
    const phone = phoneSchema.safeParse('123');
    expect(phone.success ? '' : phone.error.issues[0].message).toMatch(/^That phone number/);
    expect(newReportSchema.safeParse({}).success).toBe(false);
  });
  it('writes the triage summary in English but still matches Arabic keywords', () => {
    const t = triageMock({ description: 'فيه حفرة كبيرة قدام المدرسة' });
    expect(t.options[0].categoryId).toBe('pothole');
    expect(t.summary).toMatch(/^Most likely "Pothole/);
    usePrefs.setState({ lang: 'ar' });
    expect(triageMock({ description: 'فيه حفرة كبيرة' }).summary).toMatch(/^الغالب/);
  });
});
