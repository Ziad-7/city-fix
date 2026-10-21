import type { MapPin } from '@/domain/types';
import { CRITICAL_COLOR, STATUS_COLOR } from '../StatusChip';

// Kept apart from IncidentMap so server-rendered pages can use it without loading Leaflet (which needs `window`).
export const pinColor = (p: MapPin) => (p.critical ? CRITICAL_COLOR : STATUS_COLOR[p.status]);
