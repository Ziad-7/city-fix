import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, StatusChip } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import type { OutboxItem } from '@/store/useOutbox';
import { colors } from '@/theme/tokens';
import { relativeTimeAr } from '@/utils/time';
import { RequestThumb } from './RequestThumb';

/**
 * A report saved on the phone, waiting for the network. It has no id yet, so it cannot open a detail screen.
 * `onSend` resolves true when it went through (the card then disappears) and false when it stays queued.
 */
export function QueuedCard({ item, onSend }: { item: OutboxItem; onSend: (id: string) => Promise<boolean> }) {
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
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
          <AppText variant="smallStrong" style={styles.title} numberOfLines={2}>{cat.labelAr}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>اتحفظ على الموبايل · {relativeTimeAr(item.createdAt)}</AppText>
        </View>
        <StatusChip status="received" label="مستني النت" />
      </View>
      <View style={styles.actions}>
        <AppText variant="caption" color={failed ? colors.urgent : colors.inkMuted} style={styles.hint}>
          {failed ? 'لسه مقدرناش نبعته، هنحاول تاني لوحدنا.' : 'هيتبعت لوحده أول ما النت يرجع.'}
        </AppText>
        <Button label="ابعت دلوقتي" icon="refresh" size="sm" variant="secondary" loading={sending} onPress={press} testID={`send-queued-${item.id}`} />
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
