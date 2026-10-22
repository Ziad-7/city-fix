import type { StyleProp, ViewStyle } from 'react-native';
import type { IconName, LatLng, MapPin } from '@/domain/types';

/** A non-incident point on the map (smart bins, collector jobs): a coloured round badge with an icon. Never colour-only: `label` is read out. */
export type MapMarker = { id: string; lat: number; lng: number; color: string; icon: IconName; label: string };

export type IncidentMapProps = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  /** Extra points drawn as icon badges (smart bins, jobs). */
  markers?: MapMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (id: string) => void;
  /** Map centre (default: Nasr City). */
  center?: LatLng;
  /** The citizen's own location / report marker. */
  userLocation?: LatLng | null;
  style?: StyleProp<ViewStyle>;
};

export const NASR_CITY: LatLng = { lat: 30.056, lng: 31.33 };

/** Critical pins get an alert glyph and the "خطر" chip. */
export const pinIsCritical = (p: MapPin): boolean => p.critical ?? p.severity === 'critical';
