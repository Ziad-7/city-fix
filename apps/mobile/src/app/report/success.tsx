import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark, MedalIcon } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { DISTRICT_TITLE, medalFor } from '@/domain/medals';
import { moreReportsAr } from '@/components/report/text';
import { AppText, Button, Card, ProgressBar, Screen } from '@/components/ui';
import { useReports, useSession } from '@/store';
import { colors, fonts, radius, shadows } from '@/theme/tokens';
import { isolateLtr, toArabicDigits } from '@/utils/digits';

export default function SuccessScreen() {
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
  const n = toArabicDigits(reportCount);

  const steps = [
    'موظف الحي هيراجعه خلال ٢٤ ساعة',
    `هيتحوّل للجهة المسؤولة: ${incident.department}`,
    whatsapp ? 'هنبعتلك على واتساب في كل خطوة' : 'هنبعتلك رسالة SMS في كل خطوة',
  ];

  const share = async () => {
    try {
      await Share.share({
        message: `بلّغت عن مشكلة على فيكس ذا سيتي، ورقم البلاغ ${isolateLtr(`#${report.id}`)}. لو شايفها كمان، افتح التطبيق وقول "أنا كمان" عشان نرفع أولويتها.`,
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
          <Button testID="track-report" label="تابع البلاغ" onPress={() => {
            router.dismissAll();
            router.push(`/requests/${report.id}`);
          }} />
          <Button testID="share-report" label="ابعته لجروب العمارة" variant="secondary" icon="share" onPress={share} style={{ minHeight: 48 }} />
          <Pressable testID="go-home" accessibilityRole="link" onPress={() => router.dismissAll()} style={styles.home}>
            <AppText variant="smallStrong" color={colors.red}>الرئيسية</AppText>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.hero, { paddingTop: insets.top + 24, minHeight: 330 + insets.top }]}>
        <View style={styles.logoDisc}>
          <LogoMark size={72} />
        </View>
        <AppText accessibilityRole="header" color={colors.onRed} style={styles.title}>تسلم إيدك!</AppText>
        {joined ? (
          <AppText color={colors.redSoft} center style={styles.sub}>
            اتضمّيت للبلاغ الموجود، رقمه <AppText color={colors.onRed} style={styles.strong}>{isolateLtr(`#${incident.linkedReportIds[0]}`)}</AppText>. ده بيرفع أولويته.
          </AppText>
        ) : (
          <AppText color={colors.redSoft} center style={styles.sub}>
            بلاغك وصل، ورقمه <AppText color={colors.onRed} style={styles.strong}>{isolateLtr(`#${report.id}`)}</AppText>
          </AppText>
        )}
      </View>

      <View style={styles.body}>
        <Card rounded="lg" padding={16} style={{ gap: 10 }} accessibilityLabel="اللي جاي">
          <AppText accessibilityRole="header" style={styles.cardTitle}>اللي جاي</AppText>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={styles.stepNum}>
                <AppText color={colors.redDeep} style={{ fontFamily: fonts.sans700, fontSize: 13, lineHeight: 20 }}>{toArabicDigits(i + 1)}</AppText>
              </View>
              <AppText variant="small" style={{ flex: 1 }}>{s}</AppText>
            </View>
          ))}
        </Card>

        <View testID="medal-card" accessibilityLabel="لقب المجتمع" style={styles.medal}>
          <View style={styles.medalRow}>
            <MedalIcon size={56} />
            <View style={{ flex: 1 }}>
              <AppText variant="caption" color={colors.goldDeep}>{medal.tier === 'none' ? 'في الطريق للقب' : medal.tier === 'district' ? 'أعلى لقب' : 'لقب جديد'}</AppText>
              <AppText variant="sloganSm" color={colors.goldDeep}>{medal.title}</AppText>
            </View>
          </View>
          <AppText variant="small">
            {medal.next
              ? `ده بلاغك رقم ${n}. ${moreReportsAr(medal.remaining)} وتاخد لقب `
              : `ده بلاغك رقم ${n}. ده أعلى لقب، شكرًا إنك بتصلّح مدينتك.`}
            {medal.next ? <AppText variant="smallStrong">{medal.next.title}</AppText> : null}
            {medal.next ? '.' : null}
          </AppText>
          <View style={styles.progressRow}>
            <View style={{ flex: 1 }}>
              <ProgressBar value={medal.progress} color={colors.goldDeep} trackColor={colors.surface} />
            </View>
            <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans700 }}>
              {toArabicDigits(Math.min(reportCount, medal.goal))} / {toArabicDigits(medal.goal)}
            </AppText>
          </View>
          {medal.tier === 'street' ? (
            <View style={styles.earned}>
              <Icon name="check" size={14} color={colors.goldDeep} strokeWidth={3} />
              <AppText variant="caption" color={colors.goldDeep}>اللقب ده بقى ليك. الهدف الجاي: {DISTRICT_TITLE}</AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

/** Offline variant: the report is saved on the phone and goes out when the network is back. */
function QueuedSuccess({ topInset }: { topInset: number }) {
  const steps = ['هنبعته لوحدنا أول ما النت يرجع، من غير ما تعمل حاجة', 'هتلاقيه في طلباتي بعلامة "مستني النت"', 'بعد ما يتبعت هتوصلك رسالة برقم البلاغ'];
  return (
    <Screen
      edges={['bottom']}
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button testID="open-requests" label="شوف طلباتي" onPress={() => {
            router.dismissAll();
            router.push('/requests');
          }} />
          <Pressable testID="go-home" accessibilityRole="link" onPress={() => router.dismissAll()} style={styles.home}>
            <AppText variant="smallStrong" color={colors.red}>الرئيسية</AppText>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.hero, { paddingTop: topInset + 24, minHeight: 330 + topInset }]}>
        <View style={styles.logoDisc}>
          <LogoMark size={72} />
        </View>
        <AppText accessibilityRole="header" color={colors.onRed} style={styles.title}>تسلم إيدك!</AppText>
        <AppText color={colors.redSoft} center style={styles.sub}>بلاغك اتحفظ على الموبايل وهيتبعت أول ما النت يرجع</AppText>
      </View>
      <View style={styles.body}>
        <Card rounded="lg" padding={16} style={{ gap: 10 }} accessibilityLabel="اللي جاي">
          <AppText accessibilityRole="header" style={styles.cardTitle}>اللي جاي</AppText>
          {steps.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={styles.stepNum}>
                <AppText color={colors.redDeep} style={{ fontFamily: fonts.sans700, fontSize: 13, lineHeight: 20 }}>{toArabicDigits(i + 1)}</AppText>
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
