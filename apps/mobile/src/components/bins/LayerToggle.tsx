import { StyleSheet, View } from 'react-native';
import { Chip } from '@/components/ui';
import { MAP_LAYERS, type MapLayer } from '@/domain/bin-map';
import { useTr } from '@/i18n';

/** "المشاكل / Problems · الصناديق الذكية / Smart bins": which layer the map tab shows. */
export function LayerToggle({ layer, onLayer }: { layer: MapLayer; onLayer: (l: MapLayer) => void }) {
  const tr = useTr();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {MAP_LAYERS.map((l) => (
        <Chip key={l.id} label={tr(l.labelAr, l.labelEn)} icon={l.icon} selected={layer === l.id} onPress={() => onLayer(l.id)} testID={`map-layer-${l.id}`} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
});
