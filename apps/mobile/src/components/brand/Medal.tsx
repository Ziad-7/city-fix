import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import { AppText } from '../ui/AppText';

/** Gold medal with red and black ribbon tails (community badge). */
export function MedalIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M20 34 L12 60 L22 54 L28 62 L32 38 Z" fill={colors.red} />
      <Path d="M44 34 L52 60 L42 54 L36 62 L32 38 Z" fill={colors.ink} />
      <Circle cx={32} cy={24} r={20} fill={colors.gold} />
      <Circle cx={32} cy={24} r={14.5} fill="none" stroke={colors.goldDeep} strokeWidth={1.5} />
      <Path d="M32 14.5l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9z" fill={colors.ink} />
    </Svg>
  );
}

/** Medal + "لقب جديد" label + title in Ruqaa, on gold-soft. */
export function Medal({ title, caption = 'لقب جديد' }: { title: string; caption?: string }) {
  return (
    <View style={styles.row}>
      <MedalIcon />
      <View style={styles.text}>
        <AppText variant="caption" color={colors.goldDeep}>{caption}</AppText>
        <AppText variant="sloganSm" color={colors.goldDeep}>{title}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
});
