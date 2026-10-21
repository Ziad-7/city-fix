import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { HOTLINES, type Hotline } from '@/domain/hotlines';
import { hotlineLabel, useTr } from '@/i18n';
import { localDigits } from '@/utils/digits';
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

/** One `tel:` tile: big number (Arabic-Indic in Arabic, Western in English) over the service name. */
export function HotlineButton({ hotline, onWhite }: { hotline: Hotline; onWhite?: boolean }) {
  const tr = useTr();
  const t = onWhite ? { bg: colors.surface, fg: colors.urgentDeep } : tone[hotline.tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tr(`اتصل ${hotline.labelAr} ${hotline.number}`, `Call ${hotlineLabel(hotline)} ${hotline.number}`)}
      onPress={() => callHotline(hotline.number)}
      style={({ pressed }) => [styles.tile, { backgroundColor: t.bg, opacity: pressed ? 0.8 : 1 }]}
    >
      <AppText style={{ fontFamily: fonts.display700, fontSize: 15, lineHeight: 18 }} color={t.fg}>{localDigits(hotline.number)}</AppText>
      <AppText variant="caption" color={t.fg} style={{ fontSize: 11, lineHeight: 15, fontFamily: fonts.sans600 }}>{hotlineLabel(hotline)}</AppText>
    </Pressable>
  );
}

const pick = (numbers: string[]) => numbers.map((n) => HOTLINES.find((h) => h.number === n)).filter((h): h is Hotline => !!h);

/** Home footer row: 122 / 123 / 180 / 129 as tel: tiles. */
export function EmergencyRow({ numbers = ['122', '123', '180', '129'] }: { numbers?: string[] }) {
  const tr = useTr();
  return (
    <View accessibilityLabel={tr('أرقام الطوارئ', 'Emergency numbers')} style={styles.row}>
      {pick(numbers).map((h) => <HotlineButton key={h.number} hotline={h} />)}
    </View>
  );
}

/** Category screen box: warning line + 122 / 123 / 180 on urgent-soft. Emergencies are never a report. */
export function EmergencyBox() {
  const tr = useTr();
  return (
    <View accessibilityLabel={tr('طوارئ', 'Emergency')} style={styles.box}>
      <View style={styles.boxTitle}>
        <Icon name="alert-triangle" size={18} color={colors.urgentDeep} strokeWidth={2} />
        <AppText variant="smallStrong" color={colors.urgentDeep} style={{ flex: 1 }}>{tr('فيه خطر على حياة حد؟ متبلّغش هنا، كلّم فورًا', 'Is someone in danger? Don’t report it here. Call now')}</AppText>
      </View>
      <View style={styles.row}>
        {pick(['122', '123', '180']).map((h) => <HotlineButton key={h.number} hotline={h} onWhite />)}
      </View>
    </View>
  );
}

/** Report form: the text mentions gas, fire, an injury or a collapse. Calling comes first; the report can still be sent. */
export function EmergencyAlert() {
  const tr = useTr();
  return (
    <View testID="emergency-alert" accessibilityRole="alert" accessibilityLabel={tr('ده ممكن يكون طوارئ', 'This may be an emergency')} style={styles.alert}>
      <View style={styles.boxTitle}>
        <Icon name="alert-triangle" size={20} color={colors.onRed} strokeWidth={2} />
        <AppText style={{ fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24, flex: 1 }} color={colors.onRed}>{tr('ده ممكن يكون طوارئ — اتصل فورًا', 'This may be an emergency — call now')}</AppText>
      </View>
      <View style={styles.row}>
        {pick(['122', '123', '180', '129']).map((h) => <HotlineButton key={h.number} hotline={h} onWhite />)}
      </View>
      <AppText variant="caption" color={colors.onRed}>{tr('الأرقام دي مجانية. والبلاغ ممكن يتبعت برضه بعد المكالمة.', 'These numbers are free. You can still send the report after the call.')}</AppText>
    </View>
  );
}

/** Utility outages (water, electricity, sewage) + the gas-leak safety line. */
export function UtilityHotlines() {
  const tr = useTr();
  return (
    <View accessibilityLabel={tr('المرافق', 'Utilities')} style={styles.utility}>
      <AppText variant="smallStrong">{tr('المية أو الكهربا قاطعة؟', 'Water or power out?')}</AppText>
      <AppText variant="caption" color={colors.inkMuted}>{tr('الانقطاع بتحلّه شركة المرافق مباشرة. إحنا هنسجّل بلاغك برضه، بس الأسرع تكلمهم.', 'The utility company fixes outages directly. We’ll log your report too, but calling them is faster.')}</AppText>
      <View style={styles.row}>
        {pick(['125', '121', '175']).map((h) => (
          <HotlineButton key={h.number} hotline={{ ...h, tone: 'plain' }} />
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={tr('اتصل طوارئ الغاز 129', 'Call gas emergency 129')} onPress={() => callHotline('129')} style={styles.gas}>
        <AppText style={{ fontFamily: fonts.display700, fontSize: 17 }} color={colors.goldDeep}>{localDigits('129')}</AppText>
        <AppText variant="caption" color={colors.goldDeep} style={{ flex: 1 }}>
          <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans700 }}>{tr('ريحة غاز؟ ', 'Smell gas? ')}</AppText>
          {tr('اقفل المحبس، افتح الشبابيك، اطلع برّه، وكلّم طوارئ الغاز.', 'Turn off the valve, open the windows, get outside, and call the gas emergency line.')}
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
