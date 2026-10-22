import { StyleSheet, View } from 'react-native';
import type { CollectorJob, RecyclingPickup } from '@/domain/citycycle';
import { pickupStatusLabel, priceToBeSetLabel, useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';
import { formatDistance } from '@/utils/geo';
import { formatEgp, formatKg } from '@/utils/money';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusChip } from '../ui/StatusChip';
import { Icon } from '../Icon';
import { DemoTag, ItemsRow, useDemoPrices, whenLabel } from './parts';
import { pickupChipStatus } from '@/domain/citycycle';

/** "Household gives it for free" / "Household wants payment", from the collector's side. */
export function useModeText() {
  const tr = useTr();
  return (mode: CollectorJob['mode']) => (mode === 'free' ? tr('الأسرة بتدّيهم مجانًا', 'Household gives it for free') : tr('الأسرة عايزة مقابل', 'Household wants to be paid'));
}

type JobCardProps = {
  job: CollectorJob;
  selected?: boolean;
  accepting?: boolean;
  onAccept: () => void;
  onOpen?: () => void;
  testID?: string;
};

/** An open job: materials, estimated kg and value, approximate distance, slot, and the big "accept" button. */
export function JobCard({ job, selected, accepting, onAccept, testID }: JobCardProps) {
  const tr = useTr();
  const demo = useDemoPrices();
  const modeText = useModeText();
  return (
    <Card rounded="lg" padding={16} style={[styles.card, selected ? styles.selected : null]} testID={testID}>
      <View style={styles.topRow}>
        <View style={styles.dist}>
          <Icon name="navigation" size={18} color={colors.ink} />
          <AppText variant="smallStrong">
            {job.distanceM !== undefined ? tr(`حوالي ${formatDistance(job.distanceM)}`, `About ${formatDistance(job.distanceM)} away`) : tr('قريب منك', 'Near you')}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.inkMuted}>{job.id}</AppText>
      </View>
      <ItemsRow items={job.items} />
      <View style={styles.facts}>
        <Fact icon="scale" text={`${tr('تقريبًا', 'About')} ${formatKg(job.estimatedKg)}`} />
        <Fact icon="banknote" text={job.estimatedValueEgp !== undefined ? `${tr('حوالي', 'About')} ${formatEgp(job.estimatedValueEgp)}` : priceToBeSetLabel()} />
        <Fact icon="clock" text={whenLabel(job)} />
        <Fact icon="users" text={modeText(job.mode)} />
      </View>
      {demo && job.estimatedValueEgp !== undefined ? <DemoTag /> : null}
      <View style={styles.approx}>
        <Icon name="pin" size={16} color={colors.goldDeep} />
        <AppText variant="caption" color={colors.goldDeep} style={styles.flex}>
          {tr('المكان تقريبي. العنوان بالظبط بيظهر بعد ما تقبل.', 'This is the approximate area. The exact address shows after you accept.')}
        </AppText>
      </View>
      <Button
        label={tr('اقبل الشغل', 'Accept job')}
        icon="check"
        onPress={onAccept}
        loading={accepting}
        style={styles.big}
        testID={testID ? `${testID}-accept` : 'accept-job'}
      />
    </Card>
  );
}

function Fact({ icon, text }: { icon: 'scale' | 'banknote' | 'clock' | 'users'; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={colors.inkMuted} />
      <AppText variant="small" style={styles.flex}>{text}</AppText>
    </View>
  );
}

/** The job the collector is doing now (accepted, not finished). */
export function CurrentJobCard({ job, onContinue, waiting }: { job: RecyclingPickup; onContinue: () => void; waiting?: boolean }) {
  const tr = useTr();
  return (
    <Card rounded="lg" padding={16} background={colors.ink} style={styles.card} testID="current-job">
      <View style={styles.topRow}>
        <AppText variant="smallStrong" color={colors.gold}>{tr('شغلك دلوقتي', 'Your job now')}</AppText>
        <StatusChip status={pickupChipStatus(job.status)} label={waiting ? tr('مستني النت', 'Waiting for internet') : pickupStatusLabel(job.status)} />
      </View>
      <AppText variant="bodyStrong" color={colors.onRed}>{job.location.address}</AppText>
      <View style={styles.wrap}>
        {job.items.map((i) => (
          <AppText key={i.materialId} variant="small" color={colors.onRed}>
            {`${formatKg(i.estimatedKg)}`}
          </AppText>
        ))}
      </View>
      <Button label={tr('كمّل الشغل', 'Continue job')} variant="gold" icon="arrow-forward" iconPosition="end" onPress={onContinue} style={styles.big} testID="continue-job" />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  selected: { borderWidth: 2, borderColor: colors.gold },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dist: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  facts: { gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  approx: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 8 },
  big: { minHeight: 60 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
