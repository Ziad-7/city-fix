import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useTr } from '@/i18n';
import { flushCollectorQueue } from '@/store/collectorSync';
import { useCollectorQueue, useSession } from '@/store';
import { colors } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** "Saved on your phone, waiting for the internet": the collector's offline actions, with a "send now" button. */
export function QueueBanner() {
  const tr = useTr();
  const userId = useSession((s) => s.userId);
  const items = useCollectorQueue((s) => s.items);
  const [busy, setBusy] = useState(false);
  const mine = items.filter((i) => i.userId === userId);
  if (mine.length === 0) return null;
  const send = async () => {
    setBusy(true);
    try {
      await flushCollectorQueue({ force: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card background={colors.goldSoft} padding={12} style={styles.card} testID="collector-queue-banner">
      <View style={styles.row}>
        <Icon name="wifi" size={20} color={colors.goldDeep} />
        <View style={styles.text}>
          <AppText variant="smallStrong" color={colors.goldDeep}>
            {tr(`${localDigits(mine.length)} حاجة محفوظة على موبايلك`, mine.length === 1 ? '1 action saved on your phone' : `${mine.length} actions saved on your phone`)}
          </AppText>
          <AppText variant="caption" color={colors.goldDeep}>{tr('هتتبعت لوحدها أول ما النت يرجع.', 'They will be sent by themselves when the internet is back.')}</AppText>
        </View>
      </View>
      <Button label={tr('ابعت دلوقتي', 'Send now')} size="sm" variant="secondary" loading={busy} onPress={send} testID="collector-queue-send" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1, minWidth: 0 },
});
