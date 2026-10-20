import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Cairo skyline on the Nile in the colours of the flag (port of docs/design/assets/cairo-skyline.svg).
 * Fills the parent's width at the given height (default 150), cropping from the centre-bottom.
 * Place it absolutely at the bottom of a red hero.
 */
export function Skyline({ height = 150, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 390 150" preserveAspectRatio="xMidYMax slice" style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={320} cy={44} r={22} fill="#D4A20B" />
      <Path d="M232 108 L272 62 L312 108 Z" fill="#D4A20B" />
      <Path d="M290 108 L318 76 L346 108 Z" fill="#D4A20B" fillOpacity={0.7} />
      <G fill="#FFFFFF" fillOpacity={0.3}>
        <Rect x={0} y={72} width={28} height={36} />
        <Rect x={94} y={62} width={24} height={46} />
        <Rect x={160} y={70} width={30} height={38} />
        <Rect x={350} y={70} width={40} height={38} />
      </G>
      <G fill="#FFFFFF">
        <Rect x={58} y={12} width={2} height={12} />
        <Path d="M50 24 h18 l-3 13 h-12 z" />
        <Path d="M54 37 h10 l-1.6 71 h-6.8 z" />
        <Rect x={8} y={84} width={38} height={24} />
        <Rect x={72} y={88} width={26} height={20} />
        <Rect x={112} y={76} width={40} height={32} />
        <Rect x={150} y={90} width={28} height={18} />
        <Rect x={182} y={80} width={34} height={28} />
        <Rect x={214} y={94} width={26} height={14} />
        <Rect x={336} y={86} width={42} height={22} />
      </G>
      <G fill="#C8102E">
        <Rect x={14} y={90} width={4} height={4} /><Rect x={26} y={90} width={4} height={4} /><Rect x={36} y={98} width={4} height={4} />
        <Rect x={118} y={82} width={4} height={4} /><Rect x={130} y={90} width={4} height={4} /><Rect x={142} y={82} width={4} height={4} />
        <Rect x={188} y={86} width={4} height={4} /><Rect x={200} y={94} width={4} height={4} /><Rect x={78} y={94} width={4} height={4} /><Rect x={344} y={92} width={4} height={4} /><Rect x={364} y={92} width={4} height={4} />
      </G>
      <Rect x={0} y={108} width={390} height={42} fill="#161616" />
      <G fill="none" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={2} strokeLinecap="round">
        <Path d="M14 120 q8 -4 16 0 t16 0" />
        <Path d="M150 128 q8 -4 16 0 t16 0" />
        <Path d="M222 118 q8 -4 16 0 t16 0" />
        <Path d="M80 140 q8 -4 16 0 t16 0" />
      </G>
      <G fill="#D4A20B" fillOpacity={0.85}>
        <Rect x={308} y={116} width={24} height={2.5} rx={1.25} />
        <Rect x={313} y={123} width={14} height={2.5} rx={1.25} />
      </G>
      <G fill="#FFFFFF">
        <Path d="M262 134 h48 l-7 8 h-34 z" />
        <Rect x={286} y={100} width={2} height={34} />
        <Path d="M266 132 L312 88 L304 132 Z" />
      </G>
    </Svg>
  );
}
