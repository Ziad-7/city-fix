import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialBadge } from '@/components/citycycle';
import { StateMessage } from '@/components/requests';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { formatEgp, formatKg, materialLabel } from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { useRecycling } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** My recycling impact: kilos, by material, pickups. CO₂ only when the backend sends a verified figure. */
export default function ImpactScreen() {
  const tr = useTr();
  const impact = useRecycling((s) => s.impact);
  const status = useRecycling((s) => s.impactStatus);
  const load = useRecycling((s) => s.loadImpact);
  useEffect(() => {
    void load();
  }, [load]);

  let body: React.ReactNode;
  if (!impact && status !== 'error') {
    body = <StateMessage loading title={tr('بنحسب أثرك…', 'Working out your impact…')} />;
  } else if (!impact) {
    body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل أثرك', "We couldn't load your impact")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void load()} />;
  } else if (impact.pickups === 0) {
    body = (
      <StateMessage icon="leaf" title={tr('لسه مفيش تدوير', 'No recycling yet')} body={tr('أول ما جامع يخلّص طلب ليك هتشوف أثرك هنا.', 'Once a collector completes a request for you, your impact shows up here.')} actionLabel={tr('اطلب جمع تدوير', 'Request a pickup')} onAction={() => router.push('/services/recycling')} />
    );
  } else {
    const max = Math.max(...impact.byMaterial.map((m) => m.kg), 1);
    body = (
      <>
        <Card rounded="lg" padding={18} style={styles.hero} testID="impact-total">
          <AppText style={styles.big}>{formatKg(impact.totalKg)}</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {tr(`اتدوّروا من ${localDigits(impact.pickups)} طلب`, `recycled across ${impact.pickups} pickups`)}
          </AppText>
          {impact.earnedEgp !== undefined ? (
            <AppText variant="smallStrong" color={colors.goldDeep}>{tr('كسبت', 'You earned')} {formatEgp(impact.earnedEgp)}</AppText>
          ) : null}
          {impact.co2AvoidedKg !== undefined ? (
            <AppText variant="smallStrong" color={colors.statusResolved} testID="impact-co2">{tr(`وفّرت حوالي ${localDigits(Math.round(impact.co2AvoidedKg))} كجم انبعاثات كربون`, `About ${Math.round(impact.co2AvoidedKg)} kg of CO₂ avoided`)}</AppText>
          ) : null}
        </Card>
        <Card padding={14} style={styles.list}>
          <AppText style={styles.heading} accessibilityRole="header">{tr('حسب الخامة', 'By material')}</AppText>
          {impact.byMaterial.map((m) => (
            <View key={m.materialId} style={styles.row}>
              <MaterialBadge id={m.materialId} size={32} />
              <View style={styles.flex}>
                <View style={styles.rowTop}>
                  <AppText variant="smallStrong" style={styles.flex} numberOfLines={1}>{materialLabel(m.materialId)}</AppText>
                  <AppText variant="smallStrong">{formatKg(m.kg)}</AppText>
                </View>
                <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(4, (m.kg / max) * 100)}%` }]} /></View>
              </View>
            </View>
          ))}
        </Card>
      </>
    );
  }

  return (
    <Screen header={<ScreenHeader title={tr('أثري في التدوير', 'My recycling impact')} />} gap={14} contentStyle={styles.content}>
      {body}
      <Button label={tr('دليل الفرز', 'Sorting guide')} variant="secondary" icon="info" onPress={() => router.push('/recycling-guide')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },
  hero: { alignItems: 'center', gap: 6 },
  big: { fontFamily: fonts.display700, fontSize: 36, lineHeight: 48, color: colors.red },
  list: { gap: 12 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 4, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.statusResolved },
});
