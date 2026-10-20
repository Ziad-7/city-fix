import type { MapPin } from '@/domain/types';
import { filterPins, statusGroup } from './filters';

const pin = (id: string, status: MapPin['status'], categoryId: MapPin['categoryId']): MapPin => ({
  id, status, categoryId, title: id, severity: 'low', lat: 30, lng: 31,
});
const pins = [pin('a', 'received', 'pothole'), pin('b', 'triaged', 'garbage'), pin('c', 'in_progress', 'pothole'), pin('d', 'closed', 'garbage')];

describe('map filters', () => {
  it('groups statuses', () => {
    expect(statusGroup('triaged')).toBe('received');
    expect(statusGroup('closed')).toBe('resolved');
    expect(statusGroup('assigned')).toBe('assigned');
  });
  it('filters by status group', () => {
    expect(filterPins(pins, 'received', 'all').map((p) => p.id)).toEqual(['a', 'b']);
    expect(filterPins(pins, 'resolved', 'all').map((p) => p.id)).toEqual(['d']);
  });
  it('filters by category and combines', () => {
    expect(filterPins(pins, 'all', 'pothole').map((p) => p.id)).toEqual(['a', 'c']);
    expect(filterPins(pins, 'in_progress', 'pothole').map((p) => p.id)).toEqual(['c']);
    expect(filterPins(pins, 'all', 'all')).toHaveLength(4);
  });
});
