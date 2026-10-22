import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { BIN_ICON, type BinDisplayState } from '@/domain/bins';
import { binTitle, fillPercent } from '@/domain/bin-map';
import type { Bin } from '@/domain/citycycle';
import { binStateLabel, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatDistance } from '@/utils/geo';
import { BinStateChip } from './BinStateChip';
import { FillGauge } from './FillGauge';
import { binColors, pctText } from './style';

type Props = { bin: Bin; state: BinDisplayState; distanceM?: number; selected?: boolean; onPress: () => void; testID?: string };

/** One bin as a card row: state icon, name, address, distance, chip and fill bar. Used by Home and the web map list. */
export function BinRow({ bin, state, distanceM, selected, onPress, testID }: Props) {
  const tr = useTr();
  const sep = tr('، ', ', ');
  const c = binColors(state);
  const pct = fillPercent(bin);
  return (
    <Pressable
      testID={testID ?? `bin-${bin.id}`}
      accessibilityRole="button"
      accessibilityLabel={[binTitle(bin), binStateLabel(state), pct !== undefined ? tr(`ممتلي ${pctText(pct)}`, `${pctText(pct)} full`) : null, distanceM !== undefined ? formatDistance(distanceM) : null].filter(Boolean).join(sep)}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected ? styles.on : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.icon, { backgroundColor: c.bg }]}>
        <Icon name={BIN_ICON[state]} size={20} color={c.fg} strokeWidth={2} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText style={styles.title} numberOfLines={1}>{binTitle(bin)}</AppText>
          {distanceM !== undefined ? <AppText variant="caption" color={colors.inkMuted}>{formatDistance(distanceM)}</AppText> : null}
        </View>
        <AppText variant="caption" color={colors.inkMuted} numberOfLines={1}>{bin.location.address}</AppText>
        <View style={styles.meta}>
          <BinStateChip state={state} />
        </View>
        {pct !== undefined ? <FillGauge pct={pct} state={state} /> : null}
      </View>
      <Icon name="chevron" size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  on: { borderColor: colors.red, backgroundColor: colors.redSoft },
  pressed: { opacity: 0.85 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
  meta: { flexDirection: 'row' },
});
