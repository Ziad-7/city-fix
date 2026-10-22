import { Pressable, StyleSheet, View } from 'react-native';
import { useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { AppText } from '../ui/AppText';
import { pressKey, stepValue, type PadKey, type PadOptions } from './logic';

export type NumberPadProps = {
  /** The typed text ("" = nothing yet). */
  value: string;
  onChange: (next: string) => void;
  unit: string;
  options: PadOptions;
  /** Stepper size (kg: 0.5, EGP: 5). */
  step: number;
  /** Accessibility name of the field ("Weight in kg"). */
  label: string;
  testID?: string;
};

const ROWS: PadKey[][] = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['.', '0', 'back']];

/**
 * Big number display + stepper + keypad. Built for gloves and sunlight: 60 px keys, black on white, one decimal for kg.
 * The keypad is always laid out 1-2-3 left to right (like every calculator), in both languages.
 */
export function NumberPad({ value, onChange, unit, options, step, label, testID }: NumberPadProps) {
  const tr = useTr();
  const shown = localDigits(value === '' ? '0' : value).replace('.', tr('٫', '.'));
  const hasDot = options.maxDecimals > 0;
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.displayRow}>
        <Stepper sign="-" label={tr(`أقل ${step}`, `Minus ${step}`)} onPress={() => onChange(stepValue(value, -step, options))} testID={testID ? `${testID}-minus` : undefined} />
        <View style={styles.display} accessibilityRole="text" accessibilityLabel={`${label}: ${shown} ${unit}`} accessibilityLiveRegion="polite">
          <AppText style={[styles.number, value === '' ? { color: colors.inkMuted } : null]} numberOfLines={1} adjustsFontSizeToFit>{shown}</AppText>
          <AppText variant="smallStrong" color={colors.inkMuted}>{unit}</AppText>
        </View>
        <Stepper sign="+" label={tr(`زوّد ${step}`, `Plus ${step}`)} onPress={() => onChange(stepValue(value, step, options))} testID={testID ? `${testID}-plus` : undefined} />
      </View>
      <View style={styles.grid}>
        {ROWS.map((row, r) => (
          <View key={r} style={styles.keyRow}>
            {row.map((k) => {
              const disabled = k === '.' && !hasDot;
              const text = k === 'back' ? '⌫' : k === '.' ? tr('٫', '.') : localDigits(k);
              return (
                <Pressable
                  key={k}
                  testID={testID ? `${testID}-${k}` : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={k === 'back' ? tr('مسح رقم', 'Delete last digit') : k === '.' ? tr('الفاصلة العشرية', 'Decimal point') : localDigits(k)}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onChange(pressKey(value, k, options))}
                  onLongPress={k === 'back' ? () => onChange('') : undefined}
                  style={({ pressed }) => [styles.key, pressed ? styles.keyPressed : null, disabled ? { opacity: 0.35 } : null]}
                >
                  <AppText style={styles.keyText}>{text}</AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function Stepper({ sign, label, onPress, testID }: { sign: '+' | '-'; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.stepper, pressed ? styles.keyPressed : null]}>
      <AppText style={styles.stepperText}>{sign === '+' ? '+' : '−'}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, direction: 'ltr' },
  display: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ink, borderRadius: radius.md, paddingHorizontal: 8 },
  number: { fontFamily: fonts.display700, fontSize: 48, lineHeight: 56, color: colors.ink },
  stepper: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepperText: { fontFamily: fonts.display700, fontSize: 32, lineHeight: 38, color: colors.onRed },
  grid: { gap: 8, direction: 'ltr' },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, minHeight: 60, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.goldSoft },
  keyText: { fontFamily: fonts.display700, fontSize: 26, lineHeight: 34, color: colors.ink },
});
