import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, radius } from '@/theme/tokens';
import { statusColor } from '../ui/StatusChip';
import { NASR_CITY, type IncidentMapProps } from './types';

function Pin({ color, selected }: { color: string; selected: boolean }) {
  const size = selected ? 44 : 34;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill={color} stroke="#FFFFFF" strokeWidth={3} />
      <Circle cx={32} cy={26.5} r={10} fill="#FFFFFF" />
      {selected ? <Circle cx={32} cy={26.5} r={5} fill={colors.gold} /> : null}
    </Svg>
  );
}

/** Native map (Expo Go, no API key): status-coloured brand pins. */
export function IncidentMap({ pins, selectedId, onSelectPin, center = NASR_CITY, userLocation, style }: IncidentMapProps) {
  return (
    <View style={[styles.frame, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        showsUserLocation={!!userLocation}
        toolbarEnabled={false}
      >
        {pins.map((p) => (
          <Marker
            key={`${p.id}-${p.status}-${selectedId === p.id}`}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.title}
            anchor={{ x: 0.5, y: 1 }}
            onPress={() => onSelectPin?.(p.id)}
          >
            <Pin color={statusColor(p.status)} selected={selectedId === p.id} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.line, minHeight: 240 },
});
