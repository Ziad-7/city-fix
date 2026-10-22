import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTr } from '@/i18n';
import { isOnlineState } from '@/services/network';
import { colors, radius } from '@/theme/tokens';
import { Icon } from './Icon';
import { AppText } from './ui';

/** Thin banner shown while the phone has no connection; reports are saved and sent later. */
export function OfflineBanner() {
  const tr = useTr();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    try {
      return NetInfo.addEventListener((s) => setOffline(s.isConnected === false || (s.isConnected === true && !isOnlineState(s))));
    } catch {
      return undefined;
    }
  }, []);

  if (!offline) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 84 }]}>
      <View testID="offline-banner" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
        <Icon name="info" size={16} color={colors.urgentDeep} strokeWidth={2.5} />
        <AppText variant="caption" color={colors.urgentDeep} style={styles.text}>
          {tr('مفيش إنترنت. بلاغاتك هتتحفظ وتتبعت أول ما النت يرجع.', 'You are offline. Reports are saved and sent when you are back online.')}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, alignItems: 'center', zIndex: 40 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.urgentSoft },
  text: { flexShrink: 1 },
});
