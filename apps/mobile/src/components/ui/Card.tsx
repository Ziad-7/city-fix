import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows } from '@/theme/tokens';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  /** Inner padding (default 12). */
  padding?: number;
  /** `lg` uses the 22 px radius of service tiles. */
  rounded?: 'md' | 'lg';
  /** Tint instead of white, e.g. red-soft for the AI suggestion. */
  background?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** Surface card on paper: radius-md, shadow-card. Pressable when `onPress` is given. */
export function Card({ children, onPress, padding = 12, rounded = 'md', background = colors.surface, style, accessibilityLabel, testID }: CardProps) {
  const base = [
    styles.card,
    { padding, backgroundColor: background, borderRadius: rounded === 'lg' ? radius.lg : radius.md },
    background === colors.surface ? shadows.card : null,
    style,
  ];
  if (!onPress) return <View testID={testID} style={base}>{children}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...base, pressed ? styles.pressed : null]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  pressed: { opacity: 0.85 },
});
