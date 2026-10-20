import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng, MapPin } from '@/domain/types';

export type IncidentMapProps = {
  pins: MapPin[];
  selectedId?: string | null;
  onSelectPin?: (id: string) => void;
  /** Map centre (default: Nasr City). */
  center?: LatLng;
  /** The citizen's own location / report marker. */
  userLocation?: LatLng | null;
  style?: StyleProp<ViewStyle>;
};

export const NASR_CITY: LatLng = { lat: 30.056, lng: 31.33 };
