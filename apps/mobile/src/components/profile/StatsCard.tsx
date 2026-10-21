import { StyleSheet, View } from 'react-native';
import { Medal } from '@/components/brand';
import { AppText, Card, ProgressBar } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';
import { toArabicDigits } from '@/utils/digits';
import { medalFor, remainingLine } from '@/domain/medals';

type Props = { reports: number; fixed: number };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${toArabicDigits(value)}`}>
      <AppText style={styles.num}>{toArabicDigits(value)}</AppText>
      <AppText variant="caption" color={colors.inkMuted}>{label}</AppText>
    </View>
  );
}

/** "إحصائياتي": report and fixed counts, medal title (or progress toward the next one). */
export function StatsCard({ reports, fixed }: Props) {
  const medal = medalFor(reports);
  const title = medal.earnedTitle;
  const next = medal.next;
  return (
    <Card rounded="lg" padding={16} style={styles.card}>
      <AppText style={styles.heading} accessibilityRole="header">إحصائياتي</AppText>
      <View style={styles.stats}>
        <Stat value={reports} label="بلاغاتك" />
        <View style={styles.divider} />
        <Stat value={fixed} label="اتصلّحت" />
      </View>
      {title ? (
        <View style={styles.medal}>
          <Medal title={title} caption="لقبك" />
        </View>
      ) : null}
      {next ? (
        <View style={styles.next} accessible accessibilityLabel={remainingLine(medal.remaining, next.title)}>
          <AppText variant="caption" color={colors.inkMuted}>
            {remainingLine(medal.remaining, next.title)}
          </AppText>
          <ProgressBar value={medal.progress} color={colors.gold} trackColor={colors.goldSoft} height={6} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  num: { fontFamily: fonts.display600, fontSize: 28, lineHeight: 34, color: colors.red },
  divider: { width: 1, height: 36, backgroundColor: colors.line },
  medal: { backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: 12 },
  next: { gap: 6 },
});
