import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, radius } from '@/theme/tokens';

export type InfoTile = { label: string; value: string };

/** Two-up grey tiles ("الجهة المسؤولة" / "متوقع يخلص"). */
export function InfoTiles({ tiles }: { tiles: InfoTile[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <View key={t.label} style={styles.tile} accessible accessibilityLabel={`${t.label}: ${t.value}`}>
          <AppText variant="caption" color={colors.inkMuted}>{t.label}</AppText>
          <AppText variant="smallStrong">{t.value}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, backgroundColor: colors.paper, borderRadius: radius.sm, padding: 10, gap: 2 },
});
