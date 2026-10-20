import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';

export type ProgressBarProps = {
  /** 0..1 */
  value: number;
  color?: string;
  trackColor?: string;
  height?: number;
};

/** Horizontal bar that fills from the reading-start side (right in RTL). */
export function ProgressBar({ value, color = colors.red, trackColor = colors.redSoft, height = 8 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }} style={[styles.track, { height, backgroundColor: trackColor }]}>
      <View style={{ width: `${pct}%`, height, borderRadius: radius.pill, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.pill, overflow: 'hidden', flexDirection: 'row', alignSelf: 'stretch' },
});
