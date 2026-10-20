import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { IconName } from '@/domain/types';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** `sm` is a 40px pill for inline actions ("أنا كمان"). */
  size?: 'md' | 'sm';
  /** Stretch to the container width (default for md). */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; pressed: string }> = {
  primary: { bg: colors.red, fg: colors.onRed, pressed: colors.redDeep },
  secondary: { bg: colors.surface, fg: colors.red, border: colors.red, pressed: colors.redSoft },
  gold: { bg: colors.gold, fg: colors.ink, pressed: '#BC8F09' },
  ghost: { bg: 'transparent', fg: colors.red, pressed: colors.redSoft },
};

export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, size = 'md', fullWidth, style, testID }: ButtonProps) {
  const p = palette[variant];
  const small = size === 'sm';
  const stretch = fullWidth ?? !small;
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.medium,
        variant === 'gold' && !small ? styles.pill : null,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1.5 : 0, opacity: disabled ? 0.5 : 1 },
        stretch ? styles.stretch : styles.auto,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={small ? 16 : 20} color={p.fg} strokeWidth={2} /> : null}
          <AppText variant="bodyStrong" color={p.fg} style={{ fontFamily: fonts.sans700, fontSize: small ? 13 : 16, lineHeight: small ? 20 : 24 }}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  medium: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: 20 },
  small: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: 12 },
  pill: { borderRadius: radius.pill },
  stretch: { alignSelf: 'stretch' },
  auto: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
