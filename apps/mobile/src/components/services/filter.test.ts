import { setLang } from '@/i18n';
import { SERVICES, SERVICE_GROUPS } from '@/domain/services-catalog';
import { filterServices, normalizeArabic } from './filter';

describe('filterServices', () => {
  it('returns everything for all + empty query', () => {
    expect(filterServices(SERVICES, '', 'all')).toHaveLength(SERVICES.length);
  });
  it('filters by group', () => {
    const r = filterServices(SERVICES, '', 'gardens');
    expect(r.map((s) => s.id)).toEqual(['tree']);
  });
  it('searches title and subtitle with loose spelling', () => {
    expect(filterServices(SERVICES, 'مخلفات', 'all').map((s) => s.id)).toEqual(['bulky']);
    expect(filterServices(SERVICES, 'القماما', 'all')).toHaveLength(0);
    expect(filterServices(SERVICES, 'قمامه', 'all').map((s) => s.id)).toEqual(['garbage-schedule']);
  });
  it('has a recycling group with the CityCycle items', () => {
    expect(filterServices(SERVICES, '', 'recycling').map((s) => s.id)).toEqual(['recycle-pickup', 'recycle-guide']);
    expect(SERVICE_GROUPS.map((g) => g.id)).toContain('recycling');
    expect(filterServices(SERVICES, '', 'recycling').every((s) => s.route?.startsWith('/recycle/'))).toBe(true);
  });
  it('combines group and query', () => {
    expect(filterServices(SERVICES, 'شجرة', 'cleaning')).toHaveLength(0);
  });
  it('normalizes alef variants', () => {
    expect(normalizeArabic('أشجار')).toBe(normalizeArabic('اشجار'));
  });
});

describe('filterServices in English', () => {
  afterEach(() => setLang('ar'));
  it('finds services by their English names and still by Arabic', () => {
    setLang('en');
    expect(filterServices(SERVICES, 'bulky', 'all').map((s) => s.id)).toEqual(['bulky']);
    expect(filterServices(SERVICES, 'شجرة', 'all').map((s) => s.id)).toContain('tree');
  });
});
