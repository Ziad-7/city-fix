import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, fonts } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from '../Icon';

export type ScreenHeaderProps = {
  title: string;
  /** e.g. "خطوة ١ من ٣" */
  step?: string;
  /** Slot at the end (share button, etc.). */
  action?: React.ReactNode;
  /** Override back behaviour (default: router.back, or home if there is nothing to go back to). */
  onBack?: () => void;
  hideBack?: boolean;
};

export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Back button (mirrors in RTL) + 20 px Readex title + optional step label. */
export function ScreenHeader({ title, step, action, onBack, hideBack }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {hideBack ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="رجوع" onPress={onBack ?? goBack} style={styles.back} hitSlop={6}>
          <Icon name="arrow-back" size={22} />
        </Pressable>
      )}
      <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
      {step ? <AppText variant="caption" color={colors.inkMuted} style={styles.step}>{step}</AppText> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.display700, fontSize: 20, lineHeight: 30 },
  step: { paddingEnd: 8 },
});
