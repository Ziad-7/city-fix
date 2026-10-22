import { useEffect, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from '@/components/Icon';
import { STATUS_LABEL_AR } from '@/domain/types';
import { useTr } from '@/i18n';
import { statusLabel } from '@/i18n/labels';
import { colors, radius } from '@/theme/tokens';
import { statusColor } from '../ui/StatusChip';
import { NASR_CITY, pinIsCritical, type IncidentMapProps, type MapMarker } from './types';

function Pin({ color, selected, critical }: { color: string; selected: boolean; critical: boolean }) {
  const size = selected ? 44 : 34;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill={color} stroke={colors.surface} strokeWidth={3} />
      <Circle cx={32} cy={26.5} r={10} fill={colors.surface} />
      {critical ? (
        // Alert glyph: critical pins are never colour-only.
        <>
          <Path d="M32 19.5v7.5" stroke={colors.urgentDeep} strokeWidth={4} strokeLinecap="round" />
          <Circle cx={32} cy={32.2} r={2.3} fill={colors.urgentDeep} />
        </>
      ) : selected ? (
        <Circle cx={32} cy={26.5} r={5} fill={colors.gold} />
      ) : null}
    </Svg>
  );
}

/** Custom marker views are bitmapped once they have drawn: tracking every frame is slow on Android. */
function PinMarker({ pin, selected, onPress }: { pin: IncidentMapProps['pins'][number]; selected: boolean; onPress?: (id: string) => void }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);
  const tr = useTr();
  const sep = tr('، ', ', ');
  const critical = pinIsCritical(pin);
  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracks}
      accessibilityLabel={`${pin.title}${sep}${critical ? `${tr('خطر', 'Danger')}${sep}` : ''}${statusLabel(pin.status, STATUS_LABEL_AR[pin.status])}`}
      onPress={() => onPress?.(pin.id)}
    >
      <Pin color={statusColor(pin.status)} selected={selected} critical={critical} />
    </Marker>
  );
}

/** Round icon badge for bins and jobs; like the pins it is bitmapped after it has drawn. */
function BadgeMarker({ marker, selected, onPress }: { marker: MapMarker; selected: boolean; onPress?: (id: string) => void }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);
  const size = selected ? 46 : 36;
  return (
    <Marker
      coordinate={{ latitude: marker.lat, longitude: marker.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      accessibilityLabel={marker.label}
      onPress={() => onPress?.(marker.id)}
    >
      <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: marker.color }, selected ? styles.badgeOn : null]}>
        <Icon name={marker.icon} size={Math.round(size * 0.5)} color={colors.onRed} strokeWidth={2.2} />
      </View>
    </Marker>
  );
}

/** Native map (Expo Go, no API key): status-coloured brand pins; critical pins carry an alert glyph. */
export function IncidentMap({ pins, selectedId, onSelectPin, markers, selectedMarkerId, onSelectMarker, center = NASR_CITY, userLocation, style }: IncidentMapProps) {
  return (
    <View style={[styles.frame, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        showsUserLocation={!!userLocation}
        toolbarEnabled={false}
      >
        {pins.map((p) => (
          // The key changes with status/selection so the bitmap is redrawn, then tracking stops again.
          <PinMarker key={`${p.id}-${p.status}-${selectedId === p.id}`} pin={p} selected={selectedId === p.id} onPress={onSelectPin} />
        ))}
        {(markers ?? []).map((m) => (
          <BadgeMarker key={`${m.id}-${m.color}-${selectedMarkerId === m.id}`} marker={m} selected={selectedMarkerId === m.id} onPress={onSelectMarker} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.line, minHeight: 240 },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  badgeOn: { borderColor: colors.gold },
});
