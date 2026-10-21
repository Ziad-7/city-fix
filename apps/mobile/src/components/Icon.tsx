import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { IconName } from '@/domain/types';
import { useIsRTL } from '@/i18n';
import { colors } from '@/theme/tokens';
import { DIRECTIONAL_ICONS, FILLED_ICONS, ICON_SHAPES } from './icon-shapes';


export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/** Lucide-style SVG icon. Directional icons (back, forward, chevron, play) mirror in RTL (Arabic). */
export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.75, style }: IconProps) {
  const filled = FILLED_ICONS.has(name);
  const rtl = useIsRTL();
  const mirror = rtl && DIRECTIONAL_ICONS.has(name);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={filled ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={[mirror ? { transform: [{ scaleX: -1 }] } : null, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ICON_SHAPES[name].map((s, i) => {
        switch (s[0]) {
          case 'p':
            return <Path key={i} d={s[1]} />;
          case 'c':
            return <Circle key={i} cx={s[1]} cy={s[2]} r={s[3]} />;
          case 'r':
            return <Rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} />;
          case 'e':
            return <Ellipse key={i} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} />;
        }
      })}
    </Svg>
  );
}
