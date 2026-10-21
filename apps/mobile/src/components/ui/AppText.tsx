import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { useLang } from '@/i18n';
import { scaleTextStyle, textScaleFor, usePrefs } from '@/store/usePrefs';
import { colors, fonts, typography, type TextVariant } from '@/theme/tokens';

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
  const lang = useLang();
  const scale = fixedSize ? 1 : textScaleFor(largeText);
  // Aref Ruqaa is Arabic-only: English slogans use the display font (Readex Pro bold).
  const base = lang === 'en' && typography[variant].fontFamily === fonts.ruqaa ? { ...typography[variant], fontFamily: fonts.display700 } : typography[variant];
  const merged: TextStyle[] = [base, { color }, center ? { textAlign: 'center' } : {}, StyleSheet.flatten(style) ?? {}];
  const flat = StyleSheet.flatten(merged);
  return <Text {...rest} style={scale === 1 ? flat : scaleTextStyle(flat, scale)} />;
}
