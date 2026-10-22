import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useTr } from '@/i18n';
import { materialLabel } from '@/i18n/labels';
import { colors, radius } from '@/theme/tokens';
import { formatKg } from '@/utils/money';
import { APPROX_RADIUS_M, type JobsMapProps } from './JobsMap.types';

/** Native map of open jobs: a marker and a soft circle (the pin is approximate) per job; the selected one is gold. */
export function JobsMap({ jobs, origin, selectedId, onSelect, style }: JobsMapProps) {
  const tr = useTr();
  return (
    <View style={[styles.frame, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: origin.lat, longitude: origin.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        toolbarEnabled={false}
      >
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lng }} pinColor={colors.ink} title={tr('أنت هنا تقريبًا', 'You are around here')} />
        {jobs.map((j) => {
          const on = selectedId === j.id;
          return [
            <Circle
              key={`c-${j.id}`}
              center={{ latitude: j.location.lat, longitude: j.location.lng }}
              radius={APPROX_RADIUS_M}
              strokeColor={on ? colors.gold : colors.red}
              fillColor={on ? 'rgba(212,162,11,0.25)' : 'rgba(200,16,46,0.15)'}
              strokeWidth={2}
            />,
            <Marker
              key={`m-${j.id}`}
              coordinate={{ latitude: j.location.lat, longitude: j.location.lng }}
              pinColor={on ? colors.gold : colors.red}
              accessibilityLabel={`${j.items.map((i) => materialLabel(i.materialId)).join(tr('، ', ', '))}, ${formatKg(j.estimatedKg)}`}
              onPress={() => onSelect?.(j.id)}
            />,
          ];
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.line, minHeight: 280 },
});
