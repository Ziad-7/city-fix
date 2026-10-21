import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type LatLng as MapLatLng } from 'react-native-maps';
import { colors } from '@/theme/tokens';
import type { LocationPickerProps } from './LocationPicker.types';

const DELTA = 0.006;
export const PICKER_HEIGHT = 180;

/** Native pin picker: tap the map or drag the pin to set the exact spot; recentres when GPS moves the place. */
export function LocationPicker({ lat, lng, onMove }: LocationPickerProps) {
  const ref = useRef<MapView>(null);
  /** The last point that came FROM the map (tap/drag): the map is already there, no need to animate. */
  const fromMap = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const f = fromMap.current;
    if (f && f.lat === lat && f.lng === lng) return;
    ref.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA }, 350);
  }, [lat, lng]);

  const pick = (c: MapLatLng) => {
    fromMap.current = { lat: c.latitude, lng: c.longitude };
    onMove(c.latitude, c.longitude);
  };

  return (
    <View testID="location-picker" accessibilityLabel="خريطة: دوس أو اسحب الدبوس لتحديد مكان المشكلة" style={styles.frame}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA }}
        toolbarEnabled={false}
        showsUserLocation
        onPress={(e) => pick(e.nativeEvent.coordinate)}
      >
        <Marker
          coordinate={{ latitude: lat, longitude: lng }}
          draggable
          pinColor={colors.red}
          onDragEnd={(e) => pick(e.nativeEvent.coordinate)}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: PICKER_HEIGHT, backgroundColor: colors.mapGround },
});
