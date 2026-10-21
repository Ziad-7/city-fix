import { Pressable, StyleSheet } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';
import { dayParts } from './day';

type Props = { day: string; selected: boolean; onPress: () => void };

/** Weekday over a big Arabic-Indic date (Services.html day picker). */
export function DayTile({ day, selected, onPress }: Props) {
  const { weekday, dayOfMonth } = dayParts(day);
  const fg = selected ? colors.onRed : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${weekday} ${dayOfMonth}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tile, selected ? styles.on : styles.off]}
      testID={`day-${day}`}
    >
      <AppText variant="caption" color={fg}>{weekday}</AppText>
      <AppText color={fg} style={styles.num}>{dayOfMonth}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '31%', flexGrow: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  on: { backgroundColor: colors.red },
  off: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  num: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26 },
});
