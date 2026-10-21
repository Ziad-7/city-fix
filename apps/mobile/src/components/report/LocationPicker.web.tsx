import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';
import type { LocationPickerProps } from './LocationPicker.types';

/** Web preview (react-native-maps does not run on web): the static map sketch with a pin. */
export function LocationPicker(_: LocationPickerProps) {
  return (
    <Svg accessibilityLabel="خريطة: موقع البلاغ" width="100%" height={180} viewBox="0 0 356 132" preserveAspectRatio="xMidYMid slice" style={{ backgroundColor: colors.mapGround }}>
      <Path d="M0 44h356M0 98h356M88 0v132M210 0v132M300 0v132" stroke="#FFFFFF" strokeWidth={10} />
      <Path d="M0 70h356" stroke="#FFFFFF" strokeWidth={16} />
      <Rect x={226} y={8} width={60} height={26} rx={6} fill={colors.statusResolvedBg} />
      <Circle cx={178} cy={70} r={34} fill={colors.gold} fillOpacity={0.14} stroke={colors.gold} strokeDasharray="4 4" />
      <Path d="M178 38c-9 0-16 7-16 16 0 12 16 24 16 24s16-12 16-24c0-9-7-16-16-16z" fill={colors.red} />
      <Circle cx={178} cy={54} r={6} fill={colors.surface} />
    </Svg>
  );
}
