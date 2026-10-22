import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DemoTag, ModeChip, WaitingBanner, netEarningsEgp, useDemoPrices } from '@/components/collector';
import { AppText, Card, Chip, ProgressBar, Screen, ScreenHeader } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { earningsRange, type Earnings, type EarningsPeriodKind } from '@/domain/citycycle';
import { getMaterial } from '@/domain/materials';
import { materialLabel, useTr } from '@/i18n';
import { useCollector, useFinishedJobs } from '@/store/useCollector';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, localDigits } from '@/utils/digits';
import { formatEgp, formatKg } from '@/utils/money';
import { formatDateTime } from '@/utils/time';

/** الأرباح: today / this week, kg by material, the value, what was paid to households, and the net. */
export default function CollectorEarningsScreen() {
  const tr = useTr();
  const [period, setPeriod] = useState<EarningsPeriodKind>('today');
  const today = useCollector((s) => s.earningsToday);
  const week = useCollector((s) => s.earningsWeek);
  const status = useCollector((s) => s.status);
  const finished = useFinishedJobs();
  const demo = useDemoPrices();

  useFocusEffect(
    useCallback(() => {
      void useCollector.getState().refreshEarnings().catch(() => undefined);
      void useCollector.getState().refreshJobs().catch(() => undefined);
    }, []),
  );

  const e: Earnings | null = period === 'today' ? today : week;
  const from = useMemo(() => earningsRange(period).from, [period]);
  const jobsInPeriod = useMemo(() => finished.filter((p) => (p.timeline[p.timeline.length - 1]?.at ?? p.createdAt) >= from), [finished, from]);
  const maxKg = e ? Math.max(...e.byMaterial.map((m) => m.kg), 1) : 1;

  return (
    <Screen edges={['top']} header={<ScreenHeader title={tr('أرباحي', 'My earnings')} hideBack action={<ModeChip />} />} gap={14} contentStyle={styles.content} testID="collector-earnings">
      <WaitingBanner />
      <View style={styles.chips} accessibilityRole="radiogroup">
        <Chip label={tr('النهارده', 'Today')} selected={period === 'today'} onPress={() => setPeriod('today')} testID="period-today" />
        <Chip label={tr('الأسبوع ده', 'This week')} selected={period === 'week'} onPress={() => setPeriod('week')} testID="period-week" />
      </View>

      {!e ? (
        <AppText color={colors.inkMuted}>{status === 'error' ? tr('مقدرناش نحمّل الأرباح', "We couldn't load your earnings") : tr('بنحمّل الأرباح...', 'Loading your earnings...')}</AppText>
      ) : (
        <>
          <Card rounded="lg" padding={16} background={colors.ink} style={styles.hero} testID="net-card">
            <AppText variant="smallStrong" color={colors.gold}>{tr('صافي ربحك', 'Your net earnings')}</AppText>
            <AppText style={styles.heroNumber} color={colors.onRed} testID="net-value">{formatEgp(netEarningsEgp(e))}</AppText>
            <AppText variant="caption" color={colors.onRed}>
              {tr(`${localDigits(e.jobs)} شغل، ${formatKg(e.totalKg)}`, `${e.jobs} ${e.jobs === 1 ? 'job' : 'jobs'}, ${formatKg(e.totalKg)}`)}
            </AppText>
          </Card>

          <Card rounded="lg" padding={16} style={styles.rows}>
            <Row label={tr('قيمة الخامات (بالأسعار)', 'Value of materials (at the price list)')} value={formatEgp(e.valueEgp)} />
            <Row label={tr('اتدفع للأسر', 'Paid to households')} value={`− ${formatEgp(e.paidToHouseholdsEgp)}`} />
            <View style={styles.sep} />
            <Row label={tr('الصافي', 'Net')} value={formatEgp(netEarningsEgp(e))} strong />
            <AppText variant="caption" color={colors.inkMuted}>{tr('الصافي = قيمة الخامات − اللي اتدفع للأسر.', 'Net = value of materials − cash paid to households.')}</AppText>
            {demo ? <DemoTag /> : null}
          </Card>

          <AppText variant="h3" accessibilityRole="header">{tr('حسب الخامة', 'By material')}</AppText>
          {e.byMaterial.length === 0 ? (
            <AppText color={colors.inkMuted} testID="no-earnings">{tr('لسه مفيش شغل خلص في الفترة دي.', 'No finished jobs in this period yet.')}</AppText>
          ) : (
            <Card rounded="lg" padding={16} style={styles.rows}>
              {e.byMaterial.map((m) => (
                <View key={m.materialId} style={styles.matRow}>
                  <View style={styles.matHead}>
                    <Icon name={getMaterial(m.materialId).icon} size={20} color={colors.ink} />
                    <AppText variant="smallStrong" style={styles.flex}>{materialLabel(m.materialId)}</AppText>
                    <AppText variant="smallStrong">{formatKg(m.kg)}</AppText>
                    <AppText variant="small" color={colors.inkMuted}>{formatEgp(m.valueEgp)}</AppText>
                  </View>
                  <ProgressBar value={m.kg / maxKg} color={colors.ink} trackColor={colors.line} height={10} />
                </View>
              ))}
            </Card>
          )}
        </>
      )}

      <AppText variant="h3" accessibilityRole="header">{tr('الشغل اللي خلص', 'Finished jobs')}</AppText>
      {jobsInPeriod.length === 0 ? (
        <AppText color={colors.inkMuted}>{tr('مفيش شغل خلص في الفترة دي.', 'No finished jobs in this period.')}</AppText>
      ) : (
        jobsInPeriod.map((p) => (
          <Card key={p.id} rounded="lg" padding={14} onPress={() => router.push(`/collector/job/${p.id}`)} accessibilityLabel={`${p.id}, ${formatKg(p.totalKg ?? 0)}`} testID={`done-${p.id}`}>
            <View style={styles.matHead}>
              <View style={styles.flex}>
                <AppText variant="smallStrong">{formatKg(p.totalKg ?? 0)}</AppText>
                <AppText variant="caption" color={colors.inkMuted}>{isolateLtr(p.id)}{tr('، ', ', ')}{formatDateTime(p.timeline[p.timeline.length - 1]?.at ?? p.createdAt)}</AppText>
              </View>
              <View style={styles.end}>
                <AppText variant="smallStrong">{formatEgp(p.totalValueEgp ?? 0)}</AppText>
                <AppText variant="caption" color={colors.inkMuted}>{tr(`اتدفع ${formatEgp(p.paidToHouseholdEgp ?? 0)}`, `Paid ${formatEgp(p.paidToHouseholdEgp ?? 0)}`)}</AppText>
              </View>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={strong ? 'bodyStrong' : 'small'} style={styles.flex}>{label}</AppText>
      <AppText variant={strong ? 'bodyStrong' : 'smallStrong'}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  chips: { flexDirection: 'row', gap: 8 },
  hero: { gap: 4 },
  heroNumber: { fontFamily: fonts.display700, fontSize: 40, lineHeight: 48 },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sep: { height: 1, backgroundColor: colors.line },
  matRow: { gap: 6 },
  matHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end' },
});
