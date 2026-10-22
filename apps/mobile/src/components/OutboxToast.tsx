import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOutbox } from '@/store/useOutbox';
import { colors, radius, shadows } from '@/theme/tokens';
import { Icon } from './Icon';
import { AppText } from './ui';

/** Toast for the offline queue: "بلاغك اتبعت" / "Your report was sent" with a check icon, or why a queued report was dropped. The text is written in the language of the moment it happened. */
export function OutboxToast() {
  const insets = useSafeAreaInsets();
  const notice = useOutbox((s) => s.notice);
  const [hiddenN, setHiddenN] = useState(0);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setHiddenN(notice.n), notice.ok ? 3500 : 6000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice || notice.n === hiddenN) return null;
  const toast = notice;
  const bg = toast.ok ? colors.statusResolvedBg : colors.urgentSoft;
  const fg = toast.ok ? colors.statusResolved : colors.urgentDeep;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View testID="outbox-toast" accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.box, { backgroundColor: bg }]}>
        <Icon name={toast.ok ? 'check' : 'info'} size={18} color={fg} strokeWidth={3} />
        <AppText variant="smallStrong" color={fg} style={styles.text}>{toast.text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, alignItems: 'center', zIndex: 50 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, ...shadows.card },
  text: { flexShrink: 1 },
});
