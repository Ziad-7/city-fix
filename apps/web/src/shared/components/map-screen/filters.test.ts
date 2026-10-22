import type { MapPin } from '@/domain/types';
import { buildSeed } from '@/services/mock/seed';
import { filterPins, incidentToPin, statusGroup } from './filters';

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

describe('incidentToPin critical flag', () => {
  const seed = buildSeed(Date.UTC(2026, 9, 21, 12)).incidents;
  it('marks critical-severity incidents (open manhole, exposed wire) and not ordinary ones', () => {
    expect(incidentToPin(seed.find((i) => i.id === 'INC-502')!).critical).toBe(true);
    expect(incidentToPin(seed.find((i) => i.id === 'INC-507')!).critical).toBe(true);
    expect(incidentToPin(seed.find((i) => i.id === 'INC-504')!).critical).toBe(false);
  });
});
