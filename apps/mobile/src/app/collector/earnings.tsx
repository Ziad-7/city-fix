import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { DemoPricesNote, MaterialBadge } from '@/components/citycycle';
import { StateMessage } from '@/components/requests';
import { AppText, Card, Chip, Screen, ScreenHeader } from '@/components/ui';
import { formatEgp, formatKg, materialLabel, type EarningsPeriod } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { useCollector } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** Collector earnings: today / last 7 days / all time. */
export default function CollectorEarningsScreen() {
  const tr = useTr();
  const [period, setPeriod] = useState<EarningsPeriod>('today');
  const earnings = useCollector((s) => s.earnings[period]);
  const status = useCollector((s) => s.earningsStatus);
  const load = useCollector((s) => s.loadEarnings);
  useEffect(() => {
    void load(period);
  }, [load, period]);

  const chips: { id: EarningsPeriod; ar: string; en: string }[] = [
    { id: 'today', ar: 'النهاردة', en: 'Today' },
    { id: 'week', ar: 'آخر ٧ أيام', en: 'Last 7 days' },
    { id: 'all', ar: 'الكل', en: 'All time' },
  ];

  let body: React.ReactNode;
  if (!earnings && status === 'error') body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الأرباح', "We couldn't load earnings")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void load(period)} />;
  else if (!earnings) body = <StateMessage loading title={tr('بنحسب أرباحك…', 'Working out your earnings…')} />;
  else if (earnings.jobs === 0) body = <StateMessage icon="coins" title={tr('مفيش شغل في الفترة دي', 'No jobs in this period')} />;
  else
    body = (
      <>
        <Card rounded="lg" padding={18} style={styles.hero} testID="earnings-total">
          <AppText style={styles.big}>{formatEgp(earnings.valueEgp)}</AppText>
          <AppText variant="small" color={colors.inkMuted}>{formatKg(earnings.totalKg)} · {tr(`${localDigits(earnings.jobs)} طلب`, `${earnings.jobs} jobs`)}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{tr('دفعت للأهالي', 'Paid to households')}: {formatEgp(earnings.paidToHouseholdsEgp)}</AppText>
        </Card>
        <Card padding={14} style={styles.list}>
          {earnings.byMaterial.map((m) => (
            <View key={m.materialId} style={styles.row}>
              <MaterialBadge id={m.materialId} size={30} />
              <AppText variant="smallStrong" style={styles.flex}>{materialLabel(m.materialId)}</AppText>
              <AppText variant="small">{formatKg(m.kg)}</AppText>
              <AppText variant="smallStrong">{formatEgp(m.valueEgp)}</AppText>
            </View>
          ))}
        </Card>
        <DemoPricesNote />
      </>
    );

  return (
    <Screen header={<ScreenHeader title={tr('أرباحي', 'My earnings')} />} gap={14} contentStyle={styles.content}>
      <View style={styles.chips} accessibilityRole="tablist">
        {chips.map((c) => <Chip key={c.id} label={tr(c.ar, c.en)} selected={period === c.id} onPress={() => setPeriod(c.id)} testID={`earn-${c.id}`} />)}
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  chips: { flexDirection: 'row', gap: 8 },
  hero: { alignItems: 'center', gap: 6 },
  big: { fontFamily: fonts.display700, fontSize: 34, lineHeight: 46, color: colors.red },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
});
