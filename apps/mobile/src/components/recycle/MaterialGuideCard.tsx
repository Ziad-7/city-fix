import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Card } from '@/components/ui';
import type { MaterialId } from '@/domain/citycycle';
import { getMaterial } from '@/domain/materials';
import { materialLabel, materialTip, useTr } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';
import { guideTips } from './guide';

/** One card of the sorting guide: big icon, material name, one tip, then "good" and "not good" lines (icon + words). */
export function MaterialGuideCard({ id }: { id: MaterialId }) {
  const tr = useTr();
  const tips = guideTips(id);
  const label = materialLabel(id);
  return (
    <Card rounded="lg" padding={16} style={styles.card} testID={`guide-${id}`} accessibilityLabel={`${label}. ${materialTip(id)}`}>
      <View style={styles.head}>
        <View style={styles.disc}>
          <Icon name={getMaterial(id).icon} size={40} color={colors.red} />
        </View>
        <View style={styles.headText}>
          <AppText accessibilityRole="header" style={styles.title}>{label}</AppText>
          <AppText variant="small" color={colors.inkMuted}>{materialTip(id)}</AppText>
        </View>
      </View>
      <View style={styles.cols}>
        <View style={[styles.col, { backgroundColor: colors.statusResolvedBg }]}>
          <AppText variant="smallStrong" color={colors.statusResolved}>{tr('كده تمام', 'Good')}</AppText>
          {tips.do.map((t) => (
            <View key={t} style={styles.line}>
              <Icon name="check" size={18} color={colors.statusResolved} strokeWidth={3} />
              <AppText variant="small" style={styles.lineText}>{t}</AppText>
            </View>
          ))}
        </View>
        <View style={[styles.col, { backgroundColor: colors.urgentSoft }]}>
          <AppText variant="smallStrong" color={colors.urgentDeep}>{tr('ماينفعش', 'Please avoid')}</AppText>
          {tips.dont.map((t) => (
            <View key={t} style={styles.line}>
              <Icon name="x" size={18} color={colors.urgentDeep} strokeWidth={3} />
              <AppText variant="small" style={styles.lineText}>{t}</AppText>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  disc: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display700, fontSize: 19, lineHeight: 28 },
  cols: { gap: 8 },
  col: { borderRadius: 14, padding: 12, gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineText: { flex: 1 },
});
