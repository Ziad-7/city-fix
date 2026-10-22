import type { StyleProp, ViewStyle } from 'react-native';
import type { CollectorJob } from '@/domain/citycycle';
import type { LatLng } from '@/domain/types';

export type JobsMapProps = {
  jobs: CollectorJob[];
  /** Where the search is centred (the collector's area). */
  origin: LatLng;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

/** The pin of a job is approximate (about 100 m): the map draws this radius around it. */
export const APPROX_RADIUS_M = 120;
