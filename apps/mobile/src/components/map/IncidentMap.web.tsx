import { Pressable, StyleSheet, View } from 'react-native';
import { getCategory } from '@/domain/categories';
import { STATUS_LABEL_AR } from '@/domain/types';
import { useTr } from '@/i18n';
import { labelOfCategory, statusLabel } from '@/i18n/labels';
import { colors, radius } from '@/theme/tokens';
import { AppText } from '../ui/AppText';
import { statusColor, StatusChips } from '../ui/StatusChip';
import { Icon } from '../Icon';
import { pinIsCritical, type IncidentMapProps } from './types';

/** Web preview stand-in: react-native-maps does not support web, so show the pins as a list. */
export function IncidentMap({ pins, selectedId, onSelectPin, markers, selectedMarkerId, onSelectMarker, style }: IncidentMapProps) {
  const tr = useTr();
  const sep = tr('، ', ', ');
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.banner}>
        <Icon name="map" size={18} color={colors.inkMuted} />
        <AppText variant="caption" color={colors.inkMuted}>
          {tr('الخريطة بتشتغل على الموبايل. دي قائمة بالبلاغات القريبة.', 'The map works on your phone. Here is a list of nearby reports.')}
        </AppText>
      </View>
      {pins.map((p) => {
        const title = p.title || labelOfCategory(getCategory(p.categoryId));
        return (
          <Pressable
            key={p.id}
            testID={`pin-${p.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${title}${sep}${pinIsCritical(p) ? `${tr('خطر', 'Danger')}${sep}` : ''}${statusLabel(p.status, STATUS_LABEL_AR[p.status])}`}
            onPress={() => onSelectPin?.(p.id)}
            style={[styles.row, selectedId === p.id ? styles.rowOn : null]}
          >
            <View style={[styles.dot, { backgroundColor: statusColor(p.status) }]} />
            <AppText variant="smallStrong" style={styles.title} numberOfLines={1}>{title}</AppText>
            <StatusChips status={p.status} critical={pinIsCritical(p)} />
          </Pressable>
        );
      })}
      {(markers ?? []).map((m) => (
        <Pressable
          key={m.id}
          testID={`marker-${m.id}`}
          accessibilityRole="button"
          accessibilityLabel={m.label}
          onPress={() => onSelectMarker?.(m.id)}
          style={[styles.row, selectedMarkerId === m.id ? styles.rowOn : null]}
        >
          <View style={[styles.badge, { backgroundColor: m.color }]}>
            <Icon name={m.icon} size={14} color={colors.onRed} strokeWidth={2.2} />
          </View>
          <AppText variant="smallStrong" style={styles.title} numberOfLines={1}>{m.label}</AppText>
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
  badge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
});
