import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTr } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';
import { AppText } from '../ui/AppText';

/** The brand mark: red pin, white disc, red check, gold dot. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M32 4C19.3 4 9 14.1 9 26.8 9 42.6 32 60 32 60s23-17.4 23-33.2C55 14.1 44.7 4 32 4z" fill={colors.red} />
      <Circle cx={32} cy={26.5} r={12.5} fill="#FFFFFF" />
      <Path d="M26 26.8l4.4 4.4 8-8.6" fill="none" stroke={colors.red} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={50} cy={10} r={6.5} fill={colors.gold} />
    </Svg>
  );
}

/** The brand name as styled text: "سيتي فيكس" (سيتي ink, فيكس red) in Arabic, "CityFix" (City ink, Fix red) in English. */
function BrandName({ size, lineHeight }: { size: number; lineHeight: number }) {
  const tr = useTr();
  const style = { fontFamily: fonts.display700, fontSize: size, lineHeight };
  return (
    <AppText style={style} accessibilityLabel={tr('سيتي فيكس', 'CityFix')}>
      {tr('سيتي ', 'City')}
      <AppText color={colors.red} style={style}>{tr('فيكس', 'Fix')}</AppText>
    </AppText>
  );
}

/** Lockup: mark at the start + the brand name, see docs/design/assets/cityfix-lockup-ar.svg and -en.svg. */
export function LogoLockup({ height = 36 }: { height?: number }) {
  const tr = useTr();
  return (
    <View style={styles.lockup} accessibilityRole="image" accessibilityLabel={tr('سيتي فيكس', 'CityFix')}>
      <LogoMark size={height} />
      <BrandName size={height * 0.5} lineHeight={height * 0.7} />
    </View>
  );
}

/** White pill with the mark and the brand name, for placing on red heroes. */
export function LogoPill() {
  return (
    <View style={styles.pill}>
      <LogoMark size={26} />
      <BrandName size={15} lineHeight={22} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingStart: 10, paddingEnd: 14, borderRadius: 999, backgroundColor: '#FFFFFF', alignSelf: 'flex-start' },
});
