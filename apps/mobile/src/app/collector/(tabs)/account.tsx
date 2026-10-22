import { StyleSheet, View } from 'react-native';
import { ModeChip, WaitingBanner } from '@/components/collector';
import { Icon } from '@/components/Icon';
import { AppText, Button, Card, ChoiceChip, Screen, ScreenHeader, confirmAction } from '@/components/ui';
import { collectorStatusLabel, materialLabel, setLang, useLang, useTr, type Lang } from '@/i18n';
import { signOutAll, switchMode } from '@/store/actions';
import { useCollector } from '@/store/useCollector';
import { colors, fonts } from '@/theme/tokens';
import { formatEgp, formatKg } from '@/utils/money';
import { localDigits } from '@/utils/digits';

const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
];

/** حسابي: who I am as a collector, my totals, language, the way back to citizen mode, sign out. */
export default function CollectorAccountScreen() {
  const tr = useTr();
  const lang = useLang();
  const profile = useCollector((s) => s.profile);
  const impact = useCollector((s) => s.impact);
  const name = profile?.name ?? null;
  const initial = (name ?? '').trim().charAt(0);

  return (
    <Screen edges={['top']} header={<ScreenHeader title={tr('حسابي', 'Account')} hideBack action={<ModeChip />} />} gap={14} contentStyle={styles.content} testID="collector-account">
      <WaitingBanner />
      <Card rounded="lg" padding={16} style={styles.gap}>
        <View style={styles.identity}>
          <View style={styles.avatar}>{initial ? <AppText style={styles.avatarText}>{initial}</AppText> : <Icon name="user" size={30} color={colors.ink} />}</View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>{name ?? tr('جامع', 'Collector')}</AppText>
            {profile ? (
              <AppText variant="small" color={colors.inkMuted}>
                {profile.id} · {collectorStatusLabel(profile.status)}
              </AppText>
            ) : null}
          </View>
        </View>
        {profile ? (
          <View style={styles.gap}>
            <AppText variant="small" color={colors.inkMuted}>{tr('الحي', 'District')}: {profile.district}</AppText>
            {profile.vehicle ? <AppText variant="small" color={colors.inkMuted}>{tr('وسيلة النقل', 'Vehicle')}: {profile.vehicle}</AppText> : null}
            <AppText variant="small" color={colors.inkMuted}>{tr('الخامات', 'Materials')}: {profile.materials.map(materialLabel).join(tr('، ', ', '))}</AppText>
          </View>
        ) : null}
      </Card>

      {impact ? (
        <Card rounded="lg" padding={16} style={styles.gap}>
          <AppText variant="bodyStrong" accessibilityRole="header">{tr('إجمالي شغلك', 'Your totals')}</AppText>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <AppText style={styles.statNumber}>{formatKg(impact.totalKg)}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{tr('اتجمّعت', 'Collected')}</AppText>
            </View>
            <View style={styles.stat}>
              <AppText style={styles.statNumber}>{localDigits(impact.pickups)}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{tr('شغل خلص', 'Jobs done')}</AppText>
            </View>
            {impact.earnedEgp !== undefined ? (
              <View style={styles.stat}>
                <AppText style={styles.statNumber}>{formatEgp(impact.earnedEgp)}</AppText>
                <AppText variant="caption" color={colors.inkMuted}>{tr('قيمة الخامات', 'Value of materials')}</AppText>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      <Card rounded="lg" padding={16} style={styles.gap}>
        <AppText variant="smallStrong" accessibilityRole="header">{tr('اللغة', 'Language')}</AppText>
        <View style={styles.langs} accessibilityRole="radiogroup">
          {LANGUAGES.map((l) => (
            <View key={l.id} style={styles.flex}>
              <ChoiceChip label={l.label} radio selected={lang === l.id} onPress={() => setLang(l.id)} testID={`lang-${l.id}`} />
            </View>
          ))}
        </View>
      </Card>

      <Button label={tr('ارجع لوضع المواطن', 'Back to citizen mode')} variant="gold" icon="home" onPress={() => void switchMode('citizen')} style={styles.big} testID="switch-to-citizen" />
      <Button
        label={tr('خروج', 'Sign out')}
        variant="secondary"
        icon="x"
        onPress={() => confirmAction(tr('تسجيل الخروج', 'Sign out'), tr('هتخرج من حسابك على الجهاز ده. أي حاجة لسه متبعتش هتفضل محفوظة.', 'You will be signed out on this device. Anything not sent yet stays saved.'), tr('خروج', 'Sign out'), () => void signOutAll())}
        testID="sign-out"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  gap: { gap: 10 },
  flex: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display700, fontSize: 28, lineHeight: 36, color: colors.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stat: { gap: 2 },
  statNumber: { fontFamily: fonts.display700, fontSize: 22, lineHeight: 30 },
  langs: { flexDirection: 'row', gap: 8 },
  big: { minHeight: 60 },
});
