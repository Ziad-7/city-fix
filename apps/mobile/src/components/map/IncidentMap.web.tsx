import { Pressable, StyleSheet, View } from 'react-native';
import { getCategory } from '@/domain/categories';
import { STATUS_LABEL_AR } from '@/domain/types';
import { colors, radius } from '@/theme/tokens';
import { AppText } from '../ui/AppText';
import { statusColor, StatusChips } from '../ui/StatusChip';
import { Icon } from '../Icon';
import { pinIsCritical, type IncidentMapProps } from './types';

/** Web preview stand-in: react-native-maps does not support web, so show the pins as a list. */
export function IncidentMap({ pins, selectedId, onSelectPin, style }: IncidentMapProps) {
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.banner}>
        <Icon name="map" size={18} color={colors.inkMuted} />
        <AppText variant="caption" color={colors.inkMuted}>الخريطة بتشتغل على الموبايل. دي قائمة بالبلاغات القريبة.</AppText>
      </View>
      {pins.map((p) => (
        <Pressable
          key={p.id}
          testID={`pin-${p.id}`}
          accessibilityRole="button"
          accessibilityLabel={`${p.title || getCategory(p.categoryId).labelAr}، ${pinIsCritical(p) ? 'خطر، ' : ''}${STATUS_LABEL_AR[p.status]}`}
          onPress={() => onSelectPin?.(p.id)}
          style={[styles.row, selectedId === p.id ? styles.rowOn : null]}
        >
          <View style={[styles.dot, { backgroundColor: statusColor(p.status) }]} />
          <AppText variant="smallStrong" style={styles.title} numberOfLines={1}>{p.title || getCategory(p.categoryId).labelAr}</AppText>
          <StatusChips status={p.status} critical={pinIsCritical(p)} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.sm },
  rowOn: { backgroundColor: colors.redSoft },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1 },
});
