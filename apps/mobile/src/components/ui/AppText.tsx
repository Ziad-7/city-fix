import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { scaleTextStyle, textScaleFor, usePrefs } from '@/store/usePrefs';
import { colors, typography, type TextVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
  /** Text follows the writing direction by default; only centring needs a flag. */
  center?: boolean;
  /** Skip the "خط أكبر" scaling (tab bar labels). The system font scale still applies. */
  fixedSize?: boolean;
};

/**
 * All text goes through here so fonts, sizes and line-heights follow the tokens.
 * With "خط أكبر" on, font size and line height are multiplied by 1.15 (on top of the system font scale).
 */
export function AppText({ variant = 'body', color = colors.ink, center, fixedSize, style, ...rest }: AppTextProps) {
  const largeText = usePrefs((s) => s.largeText);
  const scale = fixedSize ? 1 : textScaleFor(largeText);
  const merged: TextStyle[] = [typography[variant], { color }, center ? { textAlign: 'center' } : {}, StyleSheet.flatten(style) ?? {}];
  const flat = StyleSheet.flatten(merged);
  return <Text {...rest} style={scale === 1 ? flat : scaleTextStyle(flat, scale)} />;
}
