import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Grid3 } from '@/components/report/Grid3';
import { BinRow, IMPACT, RECYCLE_GUIDE, RECYCLE_NEW, binHref } from '@/components/bins';
import { AppText } from '@/components/ui';
import { nearestBins } from '@/domain/bin-map';
import type { LatLng } from '@/domain/types';
import { useTr } from '@/i18n';
import { useCityCycle } from '@/store';
import { colors } from '@/theme/tokens';
import { SectionTitle, ServiceTile } from './HomeParts';

/** Home: "إعادة التدوير / Recycling" (pickup request, sorting guide, my impact) and the nearest smart bins. */
export function CityCycleSection({ center }: { center: LatLng }) {
  const tr = useTr();
  const bins = useCityCycle((s) => s.bins);
  const nearest = useMemo(() => nearestBins(bins, center, 2), [bins, center]);
  return (
    <View style={styles.section} testID="home-citycycle">
      <SectionTitle title={tr('إعادة التدوير', 'Recycling')} />
      <Grid3>
        <ServiceTile testID="tile-recycle" icon="recycle" label={tr('اطلب استلام', 'Request a pickup')} onPress={() => router.push(RECYCLE_NEW)} />
        <ServiceTile testID="tile-guide" icon="bottle" label={tr('دليل الفرز', 'Sorting guide')} onPress={() => router.push(RECYCLE_GUIDE)} />
        <ServiceTile testID="tile-impact" icon="leaf" label={tr('أثري', 'My impact')} onPress={() => router.push(IMPACT)} />
      </Grid3>
      {nearest.length > 0 ? (
        <View style={styles.bins}>
          <AppText variant="smallStrong" color={colors.inkMuted} accessibilityRole="header">{tr('أقرب صناديق ذكية', 'Nearest smart bins')}</AppText>
          {nearest.map(({ bin, state, distanceM }) => (
            <BinRow key={bin.id} testID={`home-bin-${bin.id}`} bin={bin} state={state} distanceM={distanceM} onPress={() => router.push(binHref(bin.id))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  bins: { gap: 8 },
});
