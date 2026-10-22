import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, StatusChip } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import type { OutboxItem } from '@/store/useOutbox';
import { colors } from '@/theme/tokens';
import { useTr } from '@/i18n';
import { labelOfCategory } from '@/i18n/labels';
import { relativeTime } from '@/utils/time';
import { RequestThumb } from './RequestThumb';

/**
 * A report saved on the phone, waiting for the network. It has no id yet, so it cannot open a detail screen.
 * `onSend` resolves true when it went through (the card then disappears) and false when it stays queued.
 */
export function QueuedCard({ item, onSend }: { item: OutboxItem; onSend: (id: string) => Promise<boolean> }) {
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const tr = useTr();
  const cat = getCategory(item.input.categoryId);
  const press = async () => {
    setSending(true);
    setFailed(false);
    try {
      const ok = await onSend(item.id);
      setFailed(!ok);
    } finally {
      setSending(false);
    }
  };
  return (
    <Card testID={`queued-${item.id}`}>
      <View style={styles.row}>
        <RequestThumb uri={item.input.photoUris[0]} icon={cat.icon} />
        <View style={styles.text}>
          <AppText variant="smallStrong" style={styles.title} numberOfLines={2}>{labelOfCategory(cat)}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{tr('اتحفظ على الموبايل', 'Saved on your phone')} · {relativeTime(item.createdAt)}</AppText>
        </View>
        <StatusChip status="received" label={tr('مستني النت', 'Waiting for internet')} />
      </View>
      <View style={styles.actions}>
        <AppText variant="caption" color={failed ? colors.urgent : colors.inkMuted} style={styles.hint}>
          {failed
            ? tr('لسه مقدرناش نبعته، هنحاول تاني لوحدنا.', "We couldn't send it yet. We'll keep trying.")
            : tr('هيتبعت لوحده أول ما النت يرجع.', "It'll send by itself when you're back online.")}
        </AppText>
        <Button label={tr('ابعت دلوقتي', 'Send now')} icon="refresh" size="sm" variant="secondary" loading={sending} onPress={press} testID={`send-queued-${item.id}`} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  hint: { flex: 1 },
});
