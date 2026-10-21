import { Pressable, StyleSheet, View } from 'react-native';
import type { IconName } from '@/domain/types';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from '../Icon';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  testID?: string;
};

/** Pill filter chip (map filters, service groups). Selected = red fill. */
export function Chip({ label, selected, onPress, icon, testID }: ChipProps) {
  const fg = selected ? colors.onRed : colors.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <AppText variant="small" color={fg} style={{ fontFamily: selected ? fonts.sans600 : fonts.sans500 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export type ChoiceChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional second line (e.g. the date under a weekday). */
  sublabel?: string;
  /** Show a check mark when selected (multi-select lists). */
  check?: boolean;
  /** Show a radio dot before the label (single choice, e.g. SMS / WhatsApp). */
  radio?: boolean;
  testID?: string;
};

/** Boxed single/multi choice (OTP channel, items, day, slot, payment). 48 px, red-soft when selected. */
export function ChoiceChip({ label, sublabel, selected, onPress, check, radio, testID }: ChoiceChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.box, selected ? styles.boxOn : styles.boxOff]}
    >
      <View style={styles.boxRow}>
        {radio ? (
          <View style={[styles.radio, { borderColor: selected ? colors.red : colors.inkMuted }]}>
            {selected ? <View style={styles.radioDot} /> : null}
          </View>
        ) : null}
        {check && selected ? <Icon name="check" size={16} color={colors.redDeep} strokeWidth={3} /> : null}
        <AppText variant="small" color={selected ? colors.redDeep : colors.ink} style={{ fontFamily: selected ? fonts.sans600 : fonts.sans500 }}>
          {label}
        </AppText>
      </View>
      {sublabel ? (
        <AppText variant="caption" color={selected ? colors.redDeep : colors.inkMuted}>
          {sublabel}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipOn: { backgroundColor: colors.red, borderColor: colors.red },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
  box: { minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  boxOn: { backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 2 },
  boxOff: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
