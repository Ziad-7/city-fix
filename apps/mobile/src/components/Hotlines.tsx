import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { HOTLINES, type Hotline } from '@/domain/hotlines';
import { toArabicDigits } from '@/utils/digits';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './ui/AppText';
import { Icon } from './Icon';

export const callHotline = (number: string) => {
  Linking.openURL(`tel:${number}`).catch(() => undefined);
};

const tone = {
  urgent: { bg: colors.urgentSoft, fg: colors.urgentDeep },
  gold: { bg: colors.goldSoft, fg: colors.goldDeep },
  plain: { bg: colors.paper, fg: colors.redDeep },
} as const;

/** One `tel:` tile: big Arabic-Indic number over the service name. */
export function HotlineButton({ hotline, onWhite }: { hotline: Hotline; onWhite?: boolean }) {
  const t = onWhite ? { bg: colors.surface, fg: colors.urgentDeep } : tone[hotline.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`اتصل ${hotline.labelAr} ${hotline.number}`}
      onPress={() => callHotline(hotline.number)}
      style={({ pressed }) => [styles.tile, { backgroundColor: t.bg, opacity: pressed ? 0.8 : 1 }]}
    >
      <AppText style={{ fontFamily: fonts.display700, fontSize: 15, lineHeight: 18 }} color={t.fg}>{toArabicDigits(hotline.number)}</AppText>
      <AppText variant="caption" color={t.fg} style={{ fontSize: 11, lineHeight: 15, fontFamily: fonts.sans600 }}>{hotline.labelAr}</AppText>
    </Pressable>
  );
}

const pick = (numbers: string[]) => numbers.map((n) => HOTLINES.find((h) => h.number === n)).filter((h): h is Hotline => !!h);

/** Home footer row: 122 / 123 / 180 / 129 as tel: tiles. */
export function EmergencyRow({ numbers = ['122', '123', '180', '129'] }: { numbers?: string[] }) {
  return (
    <View accessibilityLabel="أرقام الطوارئ" style={styles.row}>
      {pick(numbers).map((h) => <HotlineButton key={h.number} hotline={h} />)}
    </View>
  );
}

/** Category screen box: warning line + 122 / 123 / 180 on urgent-soft. Emergencies are never a report. */
export function EmergencyBox() {
  return (
    <View accessibilityLabel="طوارئ" style={styles.box}>
      <View style={styles.boxTitle}>
        <Icon name="alert-triangle" size={18} color={colors.urgentDeep} strokeWidth={2} />
        <AppText variant="smallStrong" color={colors.urgentDeep} style={{ flex: 1 }}>فيه خطر على حياة حد؟ متبلّغش هنا، كلّم فورًا</AppText>
      </View>
      <View style={styles.row}>
        {pick(['122', '123', '180']).map((h) => <HotlineButton key={h.number} hotline={h} onWhite />)}
      </View>
    </View>
  );
}

/** Report form: the text mentions gas, fire, an injury or a collapse. Calling comes first; the report can still be sent. */
export function EmergencyAlert() {
  return (
    <View testID="emergency-alert" accessibilityRole="alert" accessibilityLabel="ده ممكن يكون طوارئ" style={styles.alert}>
      <View style={styles.boxTitle}>
        <Icon name="alert-triangle" size={20} color={colors.onRed} strokeWidth={2} />
        <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24, flex: 1 }} color={colors.onRed}>ده ممكن يكون طوارئ — اتصل فورًا</AppText>
      </View>
      <View style={styles.row}>
        {pick(['122', '123', '180', '129']).map((h) => <HotlineButton key={h.number} hotline={h} onWhite />)}
      </View>
      <AppText variant="caption" color={colors.onRed}>الأرقام دي مجانية. وتقدر تبعت البلاغ برضه بعد ما تتصل.</AppText>
    </View>
  );
}

/** Utility outages (water, electricity, sewage) + the gas-leak safety line. */
export function UtilityHotlines() {
  return (
    <View accessibilityLabel="المرافق" style={styles.utility}>
      <AppText variant="smallStrong">المية أو الكهربا قاطعة؟</AppText>
      <AppText variant="caption" color={colors.inkMuted}>الانقطاع بتحلّه شركة المرافق مباشرة. إحنا هنسجّل بلاغك برضه، بس الأسرع تكلمهم.</AppText>
      <View style={styles.row}>
        {pick(['125', '121', '175']).map((h) => (
          <HotlineButton key={h.number} hotline={{ ...h, tone: 'plain' }} />
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="اتصل طوارئ الغاز 129" onPress={() => callHotline('129')} style={styles.gas}>
        <AppText style={{ fontFamily: fonts.display700, fontSize: 17 }} color={colors.goldDeep}>{toArabicDigits('129')}</AppText>
        <AppText variant="caption" color={colors.goldDeep} style={{ flex: 1 }}>
          <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans700 }}>ريحة غاز؟ </AppText>
          اقفل المحبس، افتح الشبابيك، اطلع برّه، وكلّم طوارئ الغاز.
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  tile: { flex: 1, minHeight: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: colors.urgentSoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  boxTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alert: { backgroundColor: colors.urgent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  utility: { gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 },
  gas: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 10 },
});
