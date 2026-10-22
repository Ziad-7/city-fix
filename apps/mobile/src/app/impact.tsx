import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { impactBars, impactIsEmpty, pickupCount, pickupMoney } from '@/components/recycle';
import { StateMessage } from '@/components/requests';
import { AppText, Card, ProgressBar, Screen, ScreenHeader } from '@/components/ui';
import { SHOW_CO2_IMPACT, getMaterial } from '@/domain/materials';
import { demoPricesLabel, materialLabel, useTr } from '@/i18n';
import { useCityCycle, usePricesAreDemo } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { formatEgp, formatKg } from '@/utils/money';

/** أثري في التدوير: kg recycled (total + by material), EGP earned or donated, pickups. CO2 only when its factors are sourced. */
export default function ImpactScreen() {
  const tr = useTr();
  const impact = useCityCycle((s) => s.impact);
  const pickups = useCityCycle((s) => s.pickups);
  const status = useCityCycle((s) => s.status);
  const refresh = useCityCycle((s) => s.refresh);
  const demo = usePricesAreDemo();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === 'idle') void refresh();
  }, [status, refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  const bars = useMemo(() => impactBars(impact?.byMaterial ?? []), [impact]);
  const money = useMemo(() => pickupMoney(pickups), [pickups]);
  const done = impact?.pickups ?? pickupCount(pickups);
  const loading = !impact && (status === 'idle' || status === 'loading');
  const showMoney = money.earnedEgp > 0 || money.donatedEgp > 0;

  let body: React.ReactNode;
  if (loading) {
    body = <StateMessage loading title={tr('بنجيب أثرك…', 'Loading your impact…')} />;
  } else if (!impact && status === 'error') {
    body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل أثرك', "We couldn't load your impact")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={onRefresh} />;
  } else if (impactIsEmpty(impact)) {
    body = (
      <StateMessage
        icon="recycle"
        title={tr('لسه محدش اتحسب هنا', 'Nothing counted here yet')}
        body={tr('أول ما تسلّم خامات لجامع ويتوزنوا، هتشوف هنا كام كيلو اتحوّلوا لإعادة تدوير.', 'Once you hand materials to a collector and they are weighed, you will see how many kilos were recycled.')}
        actionLabel={tr('اطلب أول استلام', 'Request your first pickup')}
        onAction={() => router.push('/recycle/new')}
      />
    );
  } else if (impact) {
    body = (
      <>
        <Card rounded="lg" padding={20} background={colors.redSoft} style={styles.hero} testID="impact-total">
          <AppText variant="caption" color={colors.redDeep}>{tr('اتحوّل لإعادة تدوير', 'Sent to recycling')}</AppText>
          <AppText style={styles.metric} accessibilityLabel={formatKg(impact.totalKg)}>{formatKg(impact.totalKg)}</AppText>
          <AppText variant="small" color={colors.inkMuted}>{tr(`الطلبات اللي خلصت: ${localDigits(done)}`, `Completed pickups: ${done}`)}</AppText>
        </Card>

        {SHOW_CO2_IMPACT && impact.co2AvoidedKg ? (
          <Card rounded="lg" padding={16} testID="impact-co2">
            <View style={styles.line}>
              <Icon name="leaf" size={22} color={colors.statusResolved} />
              <AppText variant="smallStrong" style={{ flex: 1 }}>{tr('CO₂ اتفادى (تقديري)', 'CO₂ avoided (estimate)')}</AppText>
              <AppText style={styles.value}>{formatKg(impact.co2AvoidedKg)}</AppText>
            </View>
          </Card>
        ) : null}

        {showMoney ? (
          <Card rounded="lg" padding={16} style={{ gap: 10 }} testID="impact-money">
            <AppText style={styles.heading} accessibilityRole="header">{tr('الفلوس', 'Money')}</AppText>
            {money.earnedEgp > 0 ? (
              <View style={styles.line}>
                <Icon name="banknote" size={22} color={colors.red} />
                <AppText variant="small" style={{ flex: 1 }}>{tr('اتدفعلك', 'You earned')}</AppText>
                <AppText style={styles.value} testID="impact-earned">{formatEgp(money.earnedEgp)}</AppText>
              </View>
            ) : null}
            {money.donatedEgp > 0 ? (
              <View style={styles.line}>
                <Icon name="recycle" size={22} color={colors.red} />
                <AppText variant="small" style={{ flex: 1 }}>{tr('قيمة اللي اتبرّعت بيه', 'Value you gave for free')}</AppText>
                <AppText style={styles.value} testID="impact-donated">{formatEgp(money.donatedEgp)}</AppText>
              </View>
            ) : null}
            {demo ? <AppText variant="caption" color={colors.goldDeep}>{demoPricesLabel()}</AppText> : null}
          </Card>
        ) : null}

        <Card rounded="lg" padding={16} style={{ gap: 12 }} testID="impact-bars">
          <AppText style={styles.heading} accessibilityRole="header">{tr('حسب الخامة', 'By material')}</AppText>
          {bars.map((b) => (
            <View key={b.materialId} style={{ gap: 6 }} accessible accessibilityLabel={`${materialLabel(b.materialId)}: ${formatKg(b.kg)}`}>
              <View style={styles.line}>
                <Icon name={getMaterial(b.materialId).icon} size={20} color={colors.red} />
                <AppText variant="small" style={{ flex: 1 }}>{materialLabel(b.materialId)}</AppText>
                <AppText variant="smallStrong">{formatKg(b.kg)}</AppText>
              </View>
              <ProgressBar value={b.fraction} height={10} />
            </View>
          ))}
        </Card>
      </>
    );
  }

  return (
    <Screen
      header={<ScreenHeader title={tr('أثري في التدوير', 'My recycling impact')} />}
      gap={14}
      contentStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} colors={[colors.red]} />}
    >
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 4 },
  metric: { fontFamily: fonts.display700, fontSize: 44, lineHeight: 56, color: colors.redDeep },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24 },
});
