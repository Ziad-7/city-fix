import { usePrefs } from '@/store/usePrefs';
import { formatDistance, formatDistanceAr, formatDistanceEn } from '../geo';

describe('distance labels', () => {
  afterEach(() => usePrefs.setState({ lang: 'ar' }));

  it('formats Arabic as before', () => {
    expect(formatDistanceAr(251)).toBe('٢٥٠ متر');
    expect(formatDistanceAr(1234)).toBe('١٫٢ كم');
  });

  it('formats English with Western digits', () => {
    expect(formatDistanceEn(251)).toBe('250 m');
    expect(formatDistanceEn(2)).toBe('5 m');
    expect(formatDistanceEn(1234)).toBe('1.2 km');
  });

  it('follows the current language', () => {
    expect(formatDistance(251)).toBe('٢٥٠ متر');
    usePrefs.setState({ lang: 'en' });
    expect(formatDistance(251)).toBe('250 m');
  });
});
