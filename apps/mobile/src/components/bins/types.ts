import type { StyleProp, ViewStyle } from 'react-native';
import type { Bin } from '@/domain/citycycle';
import type { LatLng } from '@/domain/types';

export type BinMapProps = {
  bins: Bin[];
  selectedId?: string | null;
  onSelectBin?: (id: string) => void;
  center: LatLng;
  style?: StyleProp<ViewStyle>;
};
