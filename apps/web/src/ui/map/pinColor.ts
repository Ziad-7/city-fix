import type { IncidentStatus, MapPin } from '@/domain/types';
import { STATUS_LABEL_AR } from '@/domain/types';
import type { PinGlyph } from '../brand';
import { CRITICAL_COLOR, STATUS_COLOR } from '../StatusChip';

// Kept apart from IncidentMap so server-rendered pages can use it without loading Leaflet (which needs `window`).
export const pinColor = (p: MapPin) => (p.critical ? CRITICAL_COLOR : STATUS_COLOR[p.status]);

const STATUS_GLYPH: Record<IncidentStatus, PinGlyph> = {
  received: 'dot',
  triaged: 'dot',
  assigned: 'arrow',
  in_progress: 'clock',
  resolved: 'check',
  closed: 'dot',
};

/** Dot = received, arrow = assigned, clock = in progress, check = resolved, "!" = critical. */
export const pinGlyph = (p: MapPin): PinGlyph => (p.critical ? 'alert' : STATUS_GLYPH[p.status]);

/** Text for the marker's title and alt: "title · status" (and "· خطر" when critical). */
export const pinLabel = (p: MapPin) => `${p.title} · ${STATUS_LABEL_AR[p.status]}${p.critical ? ' · خطر' : ''}`;
