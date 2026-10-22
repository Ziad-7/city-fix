import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { BIN_ICON } from '@/domain/bins';
import { BIN_LEGEND_ORDER } from '@/domain/bin-map';
import { binStateLabel, useTr } from '@/i18n';
import { colors } from '@/theme/tokens';
import { binColors } from './style';

/** Legend of the bins layer: icon + colour + word per state. */
export function BinLegend() {
  const tr = useTr();
  const names = BIN_LEGEND_ORDER.map(binStateLabel).join(tr('، ', ', '));
  return (
    <View style={styles.row} accessible accessibilityLabel={`${tr('دليل حالات الصناديق', 'Bin state key')}: ${names}`} testID="bin-legend">
      {BIN_LEGEND_ORDER.map((s) => (
        <View key={s} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: binColors(s).bg }]}>
            <Icon name={BIN_ICON[s]} size={11} color={binColors(s).fg} strokeWidth={2.2} />
          </View>
          <AppText variant="caption" color={colors.inkMuted}>{binStateLabel(s)}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingHorizontal: 16, paddingBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
