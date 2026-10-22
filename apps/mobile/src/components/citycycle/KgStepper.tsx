import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { MAX_KG, MIN_KG, formatKg, stepKg } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';

type Props = { value: number; onChange: (kg: number) => void; testID?: string };

/** − 2 kg + : half-kilo steps, big touch targets. */
export function KgStepper({ value, onChange, testID }: Props) {
  const tr = useTr();
  return (
    <View style={styles.row} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('أقل', 'Less')}
        disabled={value <= MIN_KG}
        onPress={() => onChange(stepKg(value, -1))}
        style={[styles.btn, value <= MIN_KG ? styles.off : null]}
        hitSlop={4}
        testID={testID ? `${testID}-minus` : undefined}
      >
        <View style={styles.minus} />
      </Pressable>
      <AppText variant="smallStrong" style={styles.value} accessibilityLiveRegion="polite">{formatKg(value)}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr('أكتر', 'More')}
        disabled={value >= MAX_KG}
        onPress={() => onChange(stepKg(value, 1))}
        style={[styles.btn, value >= MAX_KG ? styles.off : null]}
        hitSlop={4}
        testID={testID ? `${testID}-plus` : undefined}
      >
        <Icon name="plus" size={20} color={colors.red} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 44, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.red, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  off: { opacity: 0.35 },
  minus: { width: 16, height: 2.5, borderRadius: 2, backgroundColor: colors.red },
  value: { minWidth: 64, textAlign: 'center' },
});
