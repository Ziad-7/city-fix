import { StyleSheet, View } from 'react-native';
import { AppText, ProgressBar } from '@/components/ui';
import { BIN_THRESHOLDS, type BinDisplayState } from '@/domain/bins';
import { useTr } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';
import { binColors, pctText } from './style';

type Props = { pct?: number; state: BinDisplayState; big?: boolean };

/** Fill bar with the percentage written out; `fullPct` is marked so people see how close "full" is. */
export function FillGauge({ pct, state, big }: Props) {
  const tr = useTr();
  if (pct === undefined) {
    return <AppText variant="caption" color={colors.inkMuted}>{tr('مفيش قراءة لمستوى الامتلاء', 'No fill reading yet')}</AppText>;
  }
  const c = binColors(state);
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={tr(`مستوى الامتلاء ${pctText(pct)}`, `Fill level ${pctText(pct)}`)}
      testID="fill-gauge"
    >
      <View style={styles.top}>
        <AppText style={[styles.pct, big ? styles.pctBig : null]} color={c.fg}>{pctText(pct)}</AppText>
        {big ? <AppText variant="caption" color={colors.inkMuted}>{tr(`بيتعتبر ممتلي من ${pctText(BIN_THRESHOLDS.fullPct)}`, `Counts as full from ${pctText(BIN_THRESHOLDS.fullPct)}`)}</AppText> : null}
      </View>
      <View>
        <ProgressBar value={pct / 100} color={c.fg} trackColor={c.bg} height={big ? 14 : 8} />
        {big ? <View style={[styles.tick, { start: `${BIN_THRESHOLDS.fullPct}%` }]} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, alignSelf: 'stretch' },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  pct: { fontFamily: fonts.display700, fontSize: 16, lineHeight: 22 },
  pctBig: { fontSize: 34, lineHeight: 44 },
  tick: { position: 'absolute', top: -3, bottom: -3, width: 2, backgroundColor: colors.ink, opacity: 0.55 },
});
