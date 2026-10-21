import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme/tokens';
import { AppText } from './AppText';

/** Gold-soft one-line notice ("قريبًا", session expired). Works the same on web and native, unlike Alert.alert. */
export function InlineNotice({ text, testID }: { text: string; testID?: string }) {
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <AppText variant="caption" color={colors.goldDeep}>{text}</AppText>
    </View>
  );
}

/** A notice that clears itself: `show("…")` displays it for `ms`. */
export function useTransientNotice(ms = 3500) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setNotice(text);
      timer.current = setTimeout(() => setNotice(null), ms);
    },
    [ms],
  );
  return { notice, show };
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
});
