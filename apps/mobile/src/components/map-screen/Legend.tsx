import { StyleSheet, View } from 'react-native';
import { AppText, STATUS_COLORS } from '@/components/ui';
import { useTr } from '@/i18n';
import { colors } from '@/theme/tokens';
import type { MapStatusFilter } from './filters';

const ITEMS: { status: 'received' | 'assigned' | 'in_progress' | 'resolved'; ar: string; en: string }[] = [
  { status: 'received', ar: 'وصل', en: 'Received' },
  { status: 'assigned', ar: 'اتحوّل', en: 'Assigned' },
  { status: 'in_progress', ar: 'جاري التنفيذ', en: 'In progress' },
  { status: 'resolved', ar: 'اتصلّح', en: 'Fixed' },
];

/** Pin colour key (status is also written out, never colour-only). */
export function Legend({ active }: { active?: MapStatusFilter }) {
  const tr = useTr();
  const names = ITEMS.map((i) => tr(i.ar, i.en)).join(tr('، ', ', '));
  return (
    <View style={styles.row} accessible accessibilityLabel={`${tr('دليل ألوان الدبابيس', 'Pin colour key')}: ${names}`}>
      {ITEMS.map((i) => (
        <View key={i.status} style={[styles.item, active && active !== 'all' && active !== i.status ? styles.dim : null]}>
          <View style={[styles.dot, { backgroundColor: STATUS_COLORS[i.status].fg }]} />
          <AppText variant="caption" color={colors.inkMuted}>{tr(i.ar, i.en)}</AppText>
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
