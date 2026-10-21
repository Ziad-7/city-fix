import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark, MedalIcon } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { DISTRICT_TITLE, medalFor } from '@/domain/medals';
import { moreReports } from '@/components/report/text';
import { departmentLabel, medalTitle, useLang, useTr } from '@/i18n';
import { AppText, Button, Card, ProgressBar, Screen } from '@/components/ui';
import { useReports, useSession } from '@/store';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { isolateLtr, localDigits } from '@/utils/digits';

export default function SuccessScreen() {
  const tr = useTr();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { queued } = useLocalSearchParams<{ queued?: string }>();
  const last = useReports((s) => s.lastSubmitted);
  const reportCount = useReports((s) => s.reports.length);
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);

  // Android hardware back must not return to the form: it goes home instead. `dismissAll` pops the whole
  // flow (category, form, this screen) so Home is the same instance as before, not a second copy on top.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissAll();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (queued === '1') return <QueuedSuccess topInset={insets.top} />;
  if (!last) return <Redirect href="/" />;

  const { report, incident } = last;
  const joined = incident.linkedReportIds[0] !== report.id;
  const medal = medalFor(reportCount);
  const n = localDigits(reportCount);
  const titleStyle = [styles.title, lang === 'en' ? styles.titleEn : null];

  const steps = [
    tr('موظف الحي هيراجعه خلال ٢٤ ساعة', 'A district officer will review it within 24 hours'),
    tr(`هيتحوّل للجهة المسؤولة: ${incident.department}`, `It will go to the responsible department: ${departmentLabel(incident.department)}`),
    whatsapp ? tr('هنبعتلك على واتساب في كل خطوة', 'We’ll message you on WhatsApp at every step') : tr('هنبعتلك رسالة SMS في كل خطوة', 'We’ll text you at every step'),
  ];

  const share = async () => {
    try {
      await Share.share({
        message: tr(
          `بلّغت عن مشكلة على سيتي فيكس، ورقم البلاغ ${isolateLtr(`#${report.id}`)}. لو شايفها كمان، افتح التطبيق وقول "أنا كمان" عشان نرفع أولويتها.`,
          `I reported a problem on CityFix. The report number is ${isolateLtr(`#${report.id}`)}. If you see it too, open the app and tap "Me too" to raise its priority.`,
        ),
      });
    } catch {
      // sharing is optional; a dismissed or unsupported share sheet is not an error
    }
  };

  return (
    <Screen
      edges={['bottom']}
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button testID="track-report" label={tr('تابع البلاغ', 'Track your report')} onPress={() => {
            router.dismissAll();
            router.push(`/requests/${report.id}`);
          }} />
          <Button testID="share-report" label={tr('ابعته لجروب العمارة', 'Share with your building group')} variant="secondary" icon="share" onPress={share} style={{ minHeight: 48 }} />
          <Pressable testID="go-home" accessibilityRole="link" onPress={() => router.dismissAll()} style={styles.home}>
            <AppText variant="smallStrong" color={colors.red}>{tr('الرئيسية', 'Home')}</AppText>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.hero, { paddingTop: insets.top + 24, minHeight: 330 + insets.top }]}>
        <View style={styles.logoDisc}>
          <LogoMark size={72} />
        </View>
        <AppText accessibilityRole="header" color={colors.onRed} style={titleStyle}>{tr('تسلم إيدك!', 'Thank you!')}</AppText>
        {joined ? (
          <AppText color={colors.redSoft} center style={styles.sub}>
            {tr('اتضمّيت للبلاغ الموجود، رقمه ', 'You joined the existing report, number ')}<AppText color={colors.onRed} style={styles.strong}>{isolateLtr(`#${incident.linkedReportIds[0]}`)}</AppText>{tr('. ده بيرفع أولويته.', '. This raises its priority.')}
          </AppText>
        ) : (
          <AppText color={colors.redSoft} center style={styles.sub}>
            {tr('بلاغك وصل، ورقمه ', 'We got your report. Its number is ')}<AppText color={colors.onRed} style={styles.strong}>{isolateLtr(`#${report.id}`)}</AppText>
          </AppText>
        )}
      </View>

      <View style={styles.body}>
        <Card rounded="lg" padding={16} style={{ gap: 10 }} accessibilityLabel={tr('اللي جاي', 'What’s next')}>
          <AppText accessibilityRole="header" style={styles.cardTitle}>{tr('اللي جاي', 'What’s next')}</AppText>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={styles.stepNum}>
                <AppText color={colors.redDeep} style={{ fontFamily: fonts.sans700, fontSize: 13, lineHeight: 20 }}>{localDigits(i + 1)}</AppText>
              </View>
              <AppText variant="small" style={{ flex: 1 }}>{s}</AppText>
            </View>
          ))}
        </Card>

        <View testID="medal-card" accessibilityLabel={tr('لقب المجتمع', 'Community title')} style={styles.medal}>
          <View style={styles.medalRow}>
            <MedalIcon size={56} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.goldDeep}>{medal.tier === 'none' ? tr('في الطريق للقب', 'On the way to a title') : medal.tier === 'district' ? tr('أعلى لقب', 'Highest title') : tr('لقب جديد', 'New title')}</AppText>
              <AppText variant="sloganSm" color={colors.goldDeep}>{medalTitle(medal.title)}</AppText>
            </View>
          </View>
          <AppText variant="small">
            {medal.next
              ? tr(`ده بلاغك رقم ${n}. ${moreReports(medal.remaining)} وتاخد لقب `, `This is your report number ${n}. ${moreReports(medal.remaining)} to earn the title `)
              : tr(`ده بلاغك رقم ${n}. ده أعلى لقب، شكرًا على مشاركتك في تصليح مدينتك.`, `This is your report number ${n}. That’s the highest title. Thanks for helping fix your city.`)}
            {medal.next ? <AppText variant="smallStrong">{medalTitle(medal.next.title)}</AppText> : null}
            {medal.next ? '.' : null}
          </AppText>
          <View style={styles.progressRow}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={medal.progress} color={colors.goldDeep} trackColor={colors.surface} />
            </View>
            <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans700 }}>
              {localDigits(Math.min(reportCount, medal.goal))} / {localDigits(medal.goal)}
            </AppText>
          </View>
          {medal.tier === 'street' ? (
            <View style={styles.earned}>
              <Icon name="check" size={14} color={colors.goldDeep} strokeWidth={3} />
              <AppText variant="caption" color={colors.goldDeep}>{tr('اللقب ده بقى ليك. الهدف الجاي: ', 'The title is yours. Next goal: ')}{medalTitle(DISTRICT_TITLE)}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/** Offline variant: the report is saved on the phone and goes out when the network is back. */
function QueuedSuccess({ topInset }: { topInset: number }) {
  const tr = useTr();
  const lang = useLang();
  const titleStyle = [styles.title, lang === 'en' ? styles.titleEn : null];
  const steps = [
    tr('هيتبعت لوحده أول ما النت يرجع، من غير أي خطوة تانية', 'It will send by itself when you’re back online. Nothing else to do'),
    tr('هتلاقيه في طلباتي بعلامة "مستني النت"', 'You’ll find it in My requests, marked "Waiting for internet"'),
    tr('بعد ما يتبعت هتوصلك رسالة برقم البلاغ', 'Once it’s sent, you’ll get a message with the report number'),
  ];
  return (
    <Screen
      edges={['bottom']}
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button testID="open-requests" label={tr('شوف طلباتي', 'See my requests')} onPress={() => {
            router.dismissAll();
            router.push('/requests');
          }} />
          <Pressable testID="go-home" accessibilityRole="link" onPress={() => router.dismissAll()} style={styles.home}>
            <AppText variant="smallStrong" color={colors.red}>{tr('الرئيسية', 'Home')}</AppText>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.hero, { paddingTop: topInset + 24, minHeight: 330 + topInset }]}>
        <View style={styles.logoDisc}>
          <LogoMark size={72} />
        </View>
        <AppText accessibilityRole="header" color={colors.onRed} style={titleStyle}>{tr('تسلم إيدك!', 'Thank you!')}</AppText>
        <AppText color={colors.redSoft} center style={styles.sub}>{tr('بلاغك اتحفظ على الموبايل وهيتبعت أول ما النت يرجع', 'Your report is saved on your phone and will be sent as soon as you’re back online')}</AppText>
      </View>
      <View style={styles.body}>
        <Card rounded="lg" padding={16} style={{ gap: 10 }} accessibilityLabel={tr('اللي جاي', 'What’s next')}>
          <AppText accessibilityRole="header" style={styles.cardTitle}>{tr('اللي جاي', 'What’s next')}</AppText>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={styles.stepNum}>
                <AppText color={colors.redDeep} style={{ fontFamily: fonts.sans700, fontSize: 13, lineHeight: 20 }}>{localDigits(i + 1)}</AppText>
              </View>
              <AppText variant="small" style={{ flex: 1 }}>{s}</AppText>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.red, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 24 },
  logoDisc: { width: 108, height: 108, borderRadius: 54, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.float },
  title: { fontFamily: fonts.ruqaa, fontSize: 40, lineHeight: 56, marginTop: 10 },
  titleEn: { fontFamily: fonts.display700, fontSize: 34, lineHeight: 44 },
  sub: { fontSize: 15, lineHeight: 24 },
  strong: { fontFamily: fonts.sans700, fontSize: 15, lineHeight: 24 },
  body: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  cardTitle: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  medal: { backgroundColor: colors.goldSoft, borderRadius: radius.lg, padding: 16, gap: 12 },
  medalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  earned: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  home: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
