import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, fonts, radius } from '@/theme/tokens';
import { toArabicDigits } from '@/utils/digits';

/** Score in Arabic digits + the reason line ("أولوية عالية: قريب من مدرسة + ٧ بلاغات"). */
export function PriorityStrip({ score, reason }: { score: number; reason: string }) {
  const i = reason.indexOf(':');
  const head = i > 0 ? reason.slice(0, i) : reason;
  const tail = i > 0 ? reason.slice(i + 1).trim() : '';
  return (
    <View style={styles.strip} accessible accessibilityLabel={`درجة الأولوية ${toArabicDigits(score)}. ${reason}`}>
      <AppText style={styles.score}>{toArabicDigits(score)}</AppText>
      <AppText style={styles.reason}>
        <AppText style={styles.reasonStrong}>{head}</AppText>
        {tail ? ` — ${tail}` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.redSoft, borderRadius: radius.sm, padding: 10 },
  score: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 28, color: colors.redDeep },
  reasonStrong: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 20, color: colors.ink },
  reason: { flex: 1, fontFamily: fonts.sans400, fontSize: 13, lineHeight: 20, color: colors.ink },
});
