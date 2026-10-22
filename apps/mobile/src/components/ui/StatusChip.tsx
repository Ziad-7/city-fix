import { StyleSheet, View } from 'react-native';
import { STATUS_LABEL_AR, type IncidentStatus } from '@/domain/types';
import { statusLabel, tr, useLang } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './AppText';

export type ChipKind = IncidentStatus | 'critical';

export const STATUS_COLORS: Record<ChipKind, { fg: string; bg: string }> = {
  received: { fg: colors.statusReceived, bg: colors.statusReceivedBg },
  triaged: { fg: colors.statusReceived, bg: colors.statusReceivedBg },
  assigned: { fg: colors.statusAssigned, bg: colors.statusAssignedBg },
  in_progress: { fg: colors.statusProgress, bg: colors.statusProgressBg },
  resolved: { fg: colors.statusResolved, bg: colors.statusResolvedBg },
  closed: { fg: colors.statusReceived, bg: colors.statusReceivedBg },
  critical: { fg: colors.urgentDeep, bg: colors.urgentSoft },
};

/** Pin colours for the map (same status language as chips). */
export const statusColor = (s: IncidentStatus) => STATUS_COLORS[s].fg;

export type StatusChipProps = {
  status: ChipKind;
  /** Override the Arabic label (default: the status label; critical = "خطر" / "Danger"). */
  label?: string;
};

/** Pill with a 6 px dot and an Arabic word: status is never colour-only. */
export function StatusChip({ status, label }: StatusChipProps) {
  useLang();
  const c = STATUS_COLORS[status];
  const text = label ?? (status === 'critical' ? tr('خطر', 'Danger') : statusLabel(status, STATUS_LABEL_AR[status]));
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <AppText variant="caption" color={c.fg} style={styles.text}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * Status chip, plus the red "خطر" chip when the incident is critical (severity or priority).
 * `stack` puts them in a column (row cards, end-aligned); the default is a wrapping row.
 */
export function StatusChips({ status, critical, stack }: { status: IncidentStatus; critical?: boolean; stack?: boolean }) {
  if (!critical) return <StatusChip status={status} />;
  return (
    <View style={stack ? styles.stack : styles.inline}>
      <StatusChip status="critical" />
      <StatusChip status={status} />
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  stack: { alignItems: 'flex-end', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 26, paddingHorizontal: 10, borderRadius: radius.pill },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.sans600, lineHeight: 18 },
});
