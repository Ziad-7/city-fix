import type { CategoryId, Incident, IncidentStatus, MapPin } from '@/domain/types';

export type MapStatusFilter = 'all' | 'received' | 'assigned' | 'in_progress' | 'resolved';

export const MAP_STATUS_FILTERS: { id: MapStatusFilter; labelAr: string }[] = [
  { id: 'all', labelAr: 'الكل' },
  { id: 'received', labelAr: 'وصل' },
  { id: 'assigned', labelAr: 'اتحوّل' },
  { id: 'in_progress', labelAr: 'جاري التنفيذ' },
  { id: 'resolved', labelAr: 'اتصلّح' },
];

/** Chips group the six statuses into the four the citizen sees: triaged counts as وصل, closed as اتصلّح. */
export function statusGroup(s: IncidentStatus): Exclude<MapStatusFilter, 'all'> {
  if (s === 'received' || s === 'triaged') return 'received';
  if (s === 'closed') return 'resolved';
  return s;
}

export function filterPins(pins: MapPin[], status: MapStatusFilter, category: CategoryId | 'all'): MapPin[] {
  return pins.filter((p) => (status === 'all' || statusGroup(p.status) === status) && (category === 'all' || p.categoryId === category));
}

export function incidentToPin(i: Incident): MapPin {
  return { id: i.id, categoryId: i.categoryId, title: i.title, status: i.status, severity: i.severity, lat: i.location.lat, lng: i.location.lng };
}
