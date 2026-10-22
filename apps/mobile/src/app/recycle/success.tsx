import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/brand';
import { pickupTitle } from '@/components/recycle';
import { dayText, slotLabel } from '@/components/requests';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { useLang, useTr } from '@/i18n';
import { useCityCycle } from '@/store';
import { colors, fonts, shadows } from '@/theme/tokens';
import { isolateLtr, localDigits } from '@/utils/digits';

/** تسلم إيدك!: the request is in; what happens next (a collector accepts, comes, weighs, pays). */
export default function PickupSuccessScreen() {
  const tr = useTr();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pickup = useCityCycle((s) => s.pickups.find((p) => p.id === id));

  // Android hardware back must not return to the form: it goes home instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.dismissAll();
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!pickup) return <Redirect href="/" />;

  const steps = [
    tr('جامع معتمد من منطقتك هيقبل الطلب، وهنبلّغك', 'A verified collector from your area accepts the request, and we tell you'),
    tr(`هيعدّي عليك ${dayText(pickup.day)}، ${slotLabel(pickup.slot)}`, `They come on ${dayText(pickup.day)}, ${slotLabel(pickup.slot)}`),
    tr('هيوزن الخامات قدامك، والوزن الفعلي هو اللي بيتحسب', 'They weigh the materials in front of you, and the real weight is what counts'),
    pickup.mode === 'paid'
      ? tr('بيدفعلك كاش على الوزن الفعلي', 'They pay you cash for the weighed amount')
      : tr('بتتسلّم مجانًا، وتتحسب في أثرك على البيئة', 'You give them for free, and it counts toward your impact'),
  ];

  return (
    <Screen
      edges={['bottom']}
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button testID="track-pickup" label={tr('تابع الطلب', 'Track your request')} onPress={() => {
            router.dismissAll();
            router.push(`/requests/${pickup.id}`);
          }} />
          <Pressable testID="go-home" accessibilityRole="link" onPress={() => router.dismissAll()} style={styles.home}>
            <AppText variant="smallStrong" color={colors.red}>{tr('الرئيسية', 'Home')}</AppText>
          </Pressable>
        </View>
      }
    >
      <View style={[styles.hero, { paddingTop: insets.top + 24, minHeight: 300 + insets.top }]}>
        <View style={styles.logoDisc}>
          <LogoMark size={72} />
        </View>
        <AppText accessibilityRole="header" color={colors.onRed} style={[styles.title, lang === 'en' ? styles.titleEn : null]}>{tr('تسلم إيدك!', 'Thank you!')}</AppText>
        <AppText color={colors.redSoft} center style={styles.sub}>
          {tr('طلب التدوير وصل، ورقمه ', 'We got your recycling request. Number: ')}
          <AppText color={colors.onRed} style={styles.strong}>{isolateLtr(`#${pickup.id}`)}</AppText>
        </AppText>
        <AppText color={colors.redSoft} center variant="small">{pickupTitle(pickup.items)}</AppText>
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
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  home: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
