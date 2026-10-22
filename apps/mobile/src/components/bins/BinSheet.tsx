import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button } from '@/components/ui';
import { binDisplayState } from '@/domain/bins';
import { binTitle, fillPercent } from '@/domain/bin-map';
import type { Bin } from '@/domain/citycycle';
import { binKindLabel, useTr } from '@/i18n';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { formatDistance } from '@/utils/geo';
import { relativeTime } from '@/utils/time';
import { BinStateChip } from './BinStateChip';
import { FillGauge } from './FillGauge';

type Props = { bin: Bin; distanceM: number; onDetails: () => void; onClose: () => void };

/** Bottom card for the selected bin on the map (the full screen is `/bins/[id]`). */
export function BinSheet({ bin, distanceM, onDetails, onClose }: Props) {
  const tr = useTr();
  const state = binDisplayState(bin);
  return (
    <View style={styles.sheet} testID="bin-sheet">
      <View style={styles.top}>
        <View style={styles.text}>
          <AppText style={styles.title} numberOfLines={2}>{binTitle(bin)}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{binKindLabel(bin.kind)} · {formatDistance(distanceM)}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('إغلاق', 'Close')} onPress={onClose} style={styles.close}>
          <Icon name="x" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>
      <View style={styles.meta}>
        <BinStateChip state={state} />
        {bin.lastSeenAt ? (
          <View style={styles.metaItem}>
            <Icon name="clock" size={14} color={colors.inkMuted} />
            <AppText variant="caption" color={colors.inkMuted}>{relativeTime(bin.lastSeenAt)}</AppText>
          </View>
        ) : null}
      </View>
      <FillGauge pct={fillPercent(bin)} state={state} />
      <Button label={tr('التفاصيل', 'Details')} icon="arrow-forward" iconPosition="end" size="sm" fullWidth onPress={onDetails} testID="bin-details" />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, ...shadows.float },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
