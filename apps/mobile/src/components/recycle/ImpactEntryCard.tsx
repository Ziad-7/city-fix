import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Card } from '@/components/ui';
import { useTr } from '@/i18n';
import { useCityCycle } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { formatKg } from '@/utils/money';
import { impactIsEmpty } from './impact';

/** Profile entry to the impact screen: "أثري في التدوير" with the kg so far, or an invitation to start. */
export function ImpactEntryCard() {
  const tr = useTr();
  const impact = useCityCycle((s) => s.impact);
  const empty = impactIsEmpty(impact);
  const subtitle = empty || !impact ? tr('ابدأ بأول طلب استلام خامات', 'Start with your first recycling pickup') : tr(`${formatKg(impact.totalKg)} اتحوّلت لإعادة تدوير`, `${formatKg(impact.totalKg)} sent to recycling`);
  return (
    <Card rounded="lg" padding={16} onPress={() => router.push('/impact')} accessibilityLabel={`${tr('أثري في التدوير', 'My recycling impact')}. ${subtitle}`} testID="impact-entry">
      <View style={styles.row}>
        <View style={styles.disc}>
          <Icon name="recycle" size={24} color={colors.red} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.title}>{tr('أثري في التدوير', 'My recycling impact')}</AppText>
          <AppText variant="small" color={colors.inkMuted}>{subtitle}</AppText>
        </View>
        <Icon name="chevron" size={18} color={colors.inkMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disc: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24 },
});
