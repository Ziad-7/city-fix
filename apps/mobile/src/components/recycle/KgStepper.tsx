import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import type { MaterialId } from '@/domain/citycycle';
import { PICKUP_LIMITS, getMaterial } from '@/domain/materials';
import { materialLabel, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatKg } from '@/utils/money';
import { stepKg } from './form';

type Props = { id: MaterialId; kg: number; onChange: (kg: number) => void; onRemove: () => void };

/** One chosen material: icon, name, and a "-" / "+" stepper for the approximate kg (with a remove button). */
export function KgStepper({ id, kg, onChange, onRemove }: Props) {
  const tr = useTr();
  const label = materialLabel(id);
  return (
    <View style={styles.row} testID={`kg-row-${id}`}>
      <View style={styles.head}>
        <Icon name={getMaterial(id).icon} size={22} color={colors.red} />
        <AppText variant="smallStrong" numberOfLines={2} style={styles.name}>{label}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={tr(`شيل ${label}`, `Remove ${label}`)} onPress={onRemove} hitSlop={8} style={styles.remove} testID={`kg-remove-${id}`}>
          <Icon name="x" size={18} color={colors.inkMuted} />
        </Pressable>
      </View>
      <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={tr(`الوزن التقريبي لـ ${label}`, `Approximate weight of ${label}`)} accessibilityValue={{ text: formatKg(kg) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('أقل', 'Less')}
          disabled={kg <= PICKUP_LIMITS.minKg}
          onPress={() => onChange(stepKg(kg, -1, id))}
          style={[styles.btn, kg <= PICKUP_LIMITS.minKg ? { opacity: 0.4 } : null]}
          testID={`kg-minus-${id}`}
        >
          <AppText style={styles.glyph} color={colors.red}>−</AppText>
        </Pressable>
        <AppText style={styles.value} center testID={`kg-value-${id}`}>{formatKg(kg)}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('أكتر', 'More')}
          disabled={kg >= PICKUP_LIMITS.maxKgPerMaterial}
          onPress={() => onChange(stepKg(kg, 1, id))}
          style={[styles.btn, kg >= PICKUP_LIMITS.maxKgPerMaterial ? { opacity: 0.4 } : null]}
          testID={`kg-plus-${id}`}
        >
          <AppText style={styles.glyph} color={colors.red}>+</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, minWidth: 0 },
  remove: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  btn: { width: 52, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.red, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: fonts.display700, fontSize: 26, lineHeight: 30 },
  value: { flex: 1, fontFamily: fonts.display700, fontSize: 20, lineHeight: 28 },
});
