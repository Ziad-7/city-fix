import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { MapMarker } from '@/components/map/types';
import { AppText, Button } from '@/components/ui';
import { binDisplayName, binStateLabel, binNeedsAttention, type Bin, type BinState } from '@/domain/citycycle';
import type { IconName } from '@/domain/types';
import { useTr } from '@/i18n';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { relativeTime } from '@/utils/time';

/** State colours: green = fine, red = full, gold = overheating or weak battery, grey = no signal. Never colour-only (icon + label). */
export const BIN_COLOR: Record<BinState, string> = {
  ok: colors.statusResolved,
  full: colors.urgent,
  hot: colors.urgentDeep,
  low_battery: colors.statusProgress,
  offline: colors.statusReceived,
};

const BIN_ICON: Record<BinState, IconName> = { ok: 'trash', full: 'alert-triangle', hot: 'flame', low_battery: 'zap', offline: 'wifi' };

export function binToMarker(b: Bin): MapMarker {
  return { id: b.id, lat: b.location.lat, lng: b.location.lng, color: BIN_COLOR[b.state], icon: BIN_ICON[b.state], label: `${binDisplayName(b)}, ${binStateLabel(b.state)}` };
}

/** Pill with the bin state: colour, icon and words. */
export function BinStateChip({ state }: { state: BinState }) {
  useTr();
  return (
    <View style={[styles.chip, { backgroundColor: `${BIN_COLOR[state]}1A` }]}>
      <Icon name={BIN_ICON[state]} size={14} color={BIN_COLOR[state]} />
      <AppText variant="caption" color={BIN_COLOR[state]} style={styles.chipText}>{binStateLabel(state)}</AppText>
    </View>
  );
}

type SheetProps = {
  bin: Bin;
  busy?: boolean;
  /** null = not sent yet; 'sent' = a report was created; 'error' = it failed. */
  result: 'sent' | 'error' | null;
  onReportFull: () => void;
  onOpenRequests: () => void;
  onClose: () => void;
};

/** Bottom card for the selected bin: state, fill level, temperature, and the "bin is full" report button. */
export function BinSheet({ bin, busy, result, onReportFull, onOpenRequests, onClose }: SheetProps) {
  const tr = useTr();
  const fill = bin.fillPct;
  return (
    <View style={styles.sheet} testID="bin-sheet">
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: `${BIN_COLOR[bin.state]}1A` }]}>
          <Icon name={bin.kind === 'hub' ? 'scale' : 'trash'} size={22} color={BIN_COLOR[bin.state]} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.title} numberOfLines={2}>{binDisplayName(bin)}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {bin.kind === 'hub' ? tr('نقطة تجميع بميزان', 'Collection hub with a scale') : tr('صندوق ذكي', 'Smart bin')} · {bin.id}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={tr('إغلاق', 'Close')} onPress={onClose} style={styles.close}>
          <Icon name="x" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>

      <View style={styles.meta}>
        <BinStateChip state={bin.state} />
        {fill !== undefined ? (
          <AppText variant="caption" color={colors.inkMuted}>{tr('مليان', 'Filled')} {localDigits(Math.round(fill))}٪</AppText>
        ) : null}
        {bin.tempC !== undefined ? <AppText variant="caption" color={colors.inkMuted}>{localDigits(Math.round(bin.tempC))}°</AppText> : null}
        {bin.lastSeenAt ? <AppText variant="caption" color={colors.inkMuted}>{tr('آخر إشارة', 'Last signal')} {relativeTime(bin.lastSeenAt)}</AppText> : null}
      </View>

      {fill !== undefined ? (
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(fill) }}>
          <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, fill))}%`, backgroundColor: BIN_COLOR[bin.state] }]} />
        </View>
      ) : null}

      {binNeedsAttention(bin) ? (
        <AppText variant="caption" color={colors.urgentDeep}>
          {bin.state === 'hot' ? tr('الصندوق سخن. بلّغ لو شايف دخان أو ريحة.', 'The bin is hot. Report it if you see smoke or smell burning.') : tr('الصندوق وصل لآخره وبنبلّغ الحي أوتوماتيك.', 'The bin is full and the district is alerted automatically.')}
        </AppText>
      ) : null}

      {result === 'sent' ? (
        <View style={styles.sent} accessibilityLiveRegion="polite">
          <AppText variant="smallStrong" color={colors.statusResolved}>{tr('بلاغك وصل، وهتتابعه من طلباتي.', 'Your report is in. Follow it in My requests.')}</AppText>
          <Button label={tr('طلباتي', 'My requests')} size="sm" variant="secondary" onPress={onOpenRequests} testID="bin-open-requests" />
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Button label={tr('بلّغ إن الصندوق مليان', 'Report: this bin is full')} icon="alert-triangle" size="sm" fullWidth loading={busy} onPress={onReportFull} testID="bin-report-full" />
          {result === 'error' ? <AppText variant="caption" color={colors.urgent} accessibilityLiveRegion="polite">{tr('معرفناش نبعت البلاغ، جرّب تاني.', "We couldn't send the report. Try again.")}</AppText> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 10, ...shadows.float },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.sans600, lineHeight: 18 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  sent: { gap: 8 },
});

