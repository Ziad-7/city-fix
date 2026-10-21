import { StyleSheet, View } from 'react-native';
import { AppText, STATUS_COLORS } from '@/components/ui';
import { colors } from '@/theme/tokens';
import type { MapStatusFilter } from './filters';

const ITEMS: { status: 'received' | 'assigned' | 'in_progress' | 'resolved'; label: string }[] = [
  { status: 'received', label: 'وصل' },
  { status: 'assigned', label: 'اتحوّل' },
  { status: 'in_progress', label: 'جاري التنفيذ' },
  { status: 'resolved', label: 'اتصلّح' },
];

/** Pin colour key (status is also written out, never colour-only). */
export function Legend({ active }: { active?: MapStatusFilter }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="دليل ألوان الدبابيس: وصل، اتحوّل، جاري التنفيذ، اتصلّح">
      {ITEMS.map((i) => (
        <View key={i.status} style={[styles.item, active && active !== 'all' && active !== i.status ? styles.dim : null]}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLORS[i.status].fg }]} />
          <AppText variant="caption" color={colors.inkMuted}>{i.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dim: { opacity: 0.4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
