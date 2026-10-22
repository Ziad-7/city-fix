import type { AdminIncident } from '@/domain/admin-types';


export type PinKind = 'received' | 'assigned' | 'progress' | 'resolved' | 'critical';

export interface MapPinModel {
  id: string;
  lat: number;
  lng: number;
  kind: PinKind;
  title: string;
  near?: boolean;
}

const PIN_PATH = 'M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z';

const PIN_STYLE: Record<PinKind, { body: string; glyph: string; svg: string }> = {
  received: { body: '#3D4A50', glyph: '#3D4A50', svg: '<circle cx="12" cy="12" r="3.2" fill="#3D4A50" stroke="none"/>' },
  assigned: { body: '#1E4F87', glyph: '#1E4F87', svg: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>' },
  progress: { body: '#D4A20B', glyph: '#7A5A00', svg: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>' },
  resolved: { body: '#1F6B33', glyph: '#1F6B33', svg: '<path d="M20 6 9 17l-5-5"/>' },
  critical: { body: '#A50E25', glyph: '#A50E25', svg: '<path d="M12 6v7"/><path d="M12 17.5h.01"/>' },
};

export function pinSvg(kind: PinKind): string {
  const s = PIN_STYLE[kind];
  return `<svg viewBox="4 2 52 60" aria-hidden="true"><path d="${PIN_PATH}" fill="${s.body}" stroke="#fff" stroke-width="3"/><circle cx="32" cy="26.5" r="12.5" fill="#fff"/><g transform="translate(23.6 18.1) scale(.7)" fill="none" stroke="${s.glyph}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${s.svg}</g></svg>`;
}

/** Determine the pin kind based on incident status and critical flag */
export function pinKind(incident: AdminIncident): PinKind {
  const isCritical = incident.priority.score >= 85 && (incident.status === 'received' || incident.status === 'triaged' || incident.status === 'assigned' || incident.status === 'in_progress');
  if (isCritical) return 'critical';

  switch (incident.status) {
    case 'received':
    case 'triaged':
      return 'received';
    case 'assigned':
      return 'assigned';
    case 'in_progress':
      return 'progress';
    case 'resolved':
    case 'closed':
      return 'resolved';
    default:
      return 'received';
  }
}

/** Convert incident to map pin model */
export function incidentToPin(incident: AdminIncident): MapPinModel {
  return {
    id: incident.id,
    lat: incident.location.lat,
    lng: incident.location.lng,
    kind: pinKind(incident),
    title: incident.title,
  };
}

/** Simple grid-based clustering (client-side, no external plugin) */
export function clusterPins(pins: MapPinModel[], zoomLevel: number): MapPinModel[][] {
  if (zoomLevel >= 17) {
    // No clustering at high zoom
    return pins.map(p => [p]);
  }

  // Grid size in degrees based on zoom
  const gridSize = Math.pow(2, 17 - zoomLevel) * 0.01;

  const clusters: Map<string, MapPinModel[]> = new Map();

  pins.forEach(pin => {
    const gridX = Math.floor(pin.lat / gridSize);
    const gridY = Math.floor(pin.lng / gridSize);
    const key = `${gridX},${gridY}`;

    if (!clusters.has(key)) {
      clusters.set(key, []);
    }
    clusters.get(key)!.push(pin);
  });

  return Array.from(clusters.values());
}

/** Filter pins by status, category, department, and period */
export function filterPins(
  pins: MapPinModel[],
  statuses: PinKind[],
  _categoryId?: string,
  _department?: string,
): MapPinModel[] {
  void _categoryId;
  void _department;
  return pins.filter(pin => {
    if (!statuses.includes(pin.kind)) return false;
    // Note: categoryId and department filtering happens at the API level
    return true;
  });
}
