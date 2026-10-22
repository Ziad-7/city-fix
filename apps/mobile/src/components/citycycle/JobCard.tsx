import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { dayText, slotLabel } from '@/components/requests/labels';
import { AppText, Card } from '@/components/ui';
import { estimateValue, formatEgp, formatKg, pickupModeLabel, type CollectorJob } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { materialsSummary } from '@/logic/citycycle';
import { useRecycling } from '@/store';
import { colors, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { formatDistance } from '@/utils/geo';
import { MaterialBadge } from './MaterialParts';

/** An open pickup as a collector sees it: materials, distance, time, area. No name, phone or exact pin. */
export function JobCard({ job, onPress, pending }: { job: CollectorJob; onPress: () => void; pending?: boolean }) {
  const tr = useTr();
  const title = materialsSummary(job.items, (n) => tr(`+${localDigits(n)}`, `+${n}`));
  const prices = useRecycling((s) => s.prices);
  // Only once the price list has loaded: an empty list would make every item look unpriced.
  const pricesReady = useRecycling((s) => s.pricesStatus === 'ready');
  const partial = pricesReady && estimateValue(job.items, prices).unpriced.length > 0;
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}, ${formatKg(job.estimatedKg)}`} testID={`job-${job.id}`} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.icons}>
          {job.items.slice(0, 3).map((i) => (
            <MaterialBadge key={i.materialId} id={i.materialId} size={34} />
          ))}
        </View>
        <View style={styles.text}>
          <AppText variant="smallStrong" numberOfLines={2}>{title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {tr('تقريبًا', 'About')} {formatKg(job.estimatedKg)}
            {job.mode === 'paid' && job.estimatedValueEgp !== undefined ? ` · ${partial ? tr('من ', 'From ') : ''}${formatEgp(job.estimatedValueEgp)}` : ''}
          </AppText>
        </View>
        {job.distanceM !== undefined ? (
          <View style={styles.dist}>
            <Icon name="pin" size={14} color={colors.red} />
            <AppText variant="smallStrong" color={colors.red}>{formatDistance(job.distanceM)}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Icon name="calendar" size={14} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkMuted}>{dayText(job.day)} · {slotLabel(job.slot)}</AppText>
        </View>
        <View style={styles.metaItem}>
          <Icon name="coins" size={14} color={colors.inkMuted} />
          <AppText variant="caption" color={colors.inkMuted}>{job.mode === 'free' ? tr('بيدّيها مجانًا', 'Giving it away') : pickupModeLabel(job.mode)}</AppText>
        </View>
      </View>
      <AppText variant="caption" color={colors.inkMuted} numberOfLines={2}>
        {job.location.address}{job.location.landmark ? ` · ${job.location.landmark}` : ''}
      </AppText>
      {pending ? <AppText variant="caption" color={colors.goldDeep}>{tr('مستني النت عشان يتأكد', 'Waiting for the internet to confirm')}</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icons: { flexDirection: 'row', gap: 4 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  dist: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.redSoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
