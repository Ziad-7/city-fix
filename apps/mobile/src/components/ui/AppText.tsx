import { Text, type TextProps } from 'react-native';
import { colors, typography, type TextVariant } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: string;
  /** Text follows the writing direction by default; only centring needs a flag. */
  center?: boolean;
};

/** All text goes through here so fonts, sizes and line-heights follow the tokens. */
export function AppText({ variant = 'body', color = colors.ink, center, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[typography[variant], { color }, center ? { textAlign: 'center' } : null, style]} />;
}
