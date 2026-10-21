import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors } from '@/theme/tokens';

type Props = { title: string; hint?: string; error?: string | null; children: React.ReactNode };

/** Titled group inside the booking form, with an inline error line. */
export function FormSection({ title, hint, error, children }: Props) {
  return (
    <View style={styles.section}>
      <View>
        <AppText variant="label" accessibilityRole="header">{title}</AppText>
        {hint ? <AppText variant="caption" color={colors.inkMuted}>{hint}</AppText> : null}
      </View>
      {children}
      {error ? <AppText variant="caption" color={colors.urgent} accessibilityLiveRegion="polite">{error}</AppText> : null}
    </View>
  );
}

export const gridStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  half: { flexBasis: '48%', flexGrow: 1 },
});

const styles = StyleSheet.create({
  section: { gap: 8 },
});
