import { SERVICES } from '@/domain/services-catalog';
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
  it('combines group and query', () => {
    expect(filterServices(SERVICES, 'شجرة', 'cleaning')).toHaveLength(0);
  });
  it('normalizes alef variants', () => {
    expect(normalizeArabic('أشجار')).toBe(normalizeArabic('اشجار'));
  });
});
