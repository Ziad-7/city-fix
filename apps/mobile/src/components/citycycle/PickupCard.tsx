import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { RequestThumb } from '@/components/requests';
import { dayText, slotLabel } from '@/components/requests/labels';
import { AppText, Card } from '@/components/ui';
import { formatEgp, formatKg, pickupStatusLabel, sumKg, type RecyclingPickup } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { materialsSummary } from '@/logic/citycycle';
import { colors } from '@/theme/tokens';
import { isolateLtr, localDigits } from '@/utils/digits';
import { relativeTime } from '@/utils/time';
import { PickupStatusChip } from './PickupStatusChip';

/** List row in طلباتي for a recycling pickup. */
export function PickupCard({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  const title = `${tr('جمع تدوير', 'Recycling pickup')} · ${materialsSummary(pickup.items, (n) => tr(`+${localDigits(n)}`, `+${n}`))}`;
  const total = pickup.totalKg ?? sumKg(pickup.items);
  return (
    <Card
      onPress={() => router.push(`/requests/${pickup.id}`)}
      accessibilityLabel={`${title}, ${pickupStatusLabel(pickup.status)}`}
      testID={`request-${pickup.id}`}
    >
      <View style={styles.row}>
        <RequestThumb icon="recycle" tone="service" />
        <View style={styles.text}>
          <AppText variant="smallStrong" style={styles.title} numberOfLines={2}>{title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{`${isolateLtr(`#${pickup.id}`)} · ${relativeTime(pickup.createdAt)}`}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {tr('الميعاد', 'Scheduled')}: {dayText(pickup.day)} · {slotLabel(pickup.slot)}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {pickup.totalKg !== undefined ? tr('الوزن الفعلي', 'Weighed') : tr('تقريبًا', 'About')} {formatKg(total)}
            {pickup.mode === 'paid' && (pickup.totalValueEgp ?? pickup.estimatedValueEgp) !== undefined
              ? ` · ${formatEgp((pickup.totalValueEgp ?? pickup.estimatedValueEgp) as number)}`
              : ''}
          </AppText>
        </View>
        <PickupStatusChip status={pickup.status} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 24 },
});
