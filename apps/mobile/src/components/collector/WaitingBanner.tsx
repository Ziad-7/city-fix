import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Icon } from '../Icon';
import { waitingCount } from './queue';
import { flushCollectorQueue, useActorId, useCollectorQueue } from './useCollectorQueue';

/** "مستني النت": shown while weighings or finished jobs are saved on the phone and not sent yet. */
export function WaitingBanner() {
  const tr = useTr();
  const items = useCollectorQueue((s) => s.items);
  const dropped = useCollectorQueue((s) => s.dropped);
  const userId = useActorId();
  const [busy, setBusy] = useState(false);
  const n = waitingCount(items, userId);
  if (n === 0 && !dropped) return null;
  const retry = async () => {
    setBusy(true);
    try {
      await flushCollectorQueue();
    } finally {
      setBusy(false);
    }
  };
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box} testID="waiting-banner">
      {n > 0 ? (
        <>
          <View style={styles.row}>
            <Icon name="wifi" size={20} color={colors.goldDeep} />
            <View style={styles.flex}>
              <AppText variant="smallStrong" color={colors.goldDeep}>{tr('مستني النت', 'Waiting for internet')}</AppText>
              <AppText variant="caption" color={colors.goldDeep}>
                {tr(`${localDigits(n)} حاجة محفوظة على موبايلك وهتتبعت لوحدها لما النت يرجع.`, `${n} ${n === 1 ? 'item is' : 'items are'} saved on your phone and will be sent when the internet is back.`)}
              </AppText>
            </View>
          </View>
          <Button label={tr('جرّب دلوقتي', 'Try now')} size="sm" variant="secondary" onPress={() => void retry()} loading={busy} testID="waiting-retry" />
        </>
      ) : null}
      {dropped ? (
        <View style={styles.row}>
          <AppText variant="caption" color={colors.urgentDeep} style={styles.flex}>{dropped}</AppText>
          <Button label={tr('تمام', 'OK')} size="sm" variant="ghost" onPress={() => useCollectorQueue.getState().setDropped(null)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
