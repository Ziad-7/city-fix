import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogoPill, Skyline } from '@/components/brand';
import { Icon } from '@/components/Icon';
import { AppText, Button, ChoiceChip, InlineNotice, Screen, SelectField, TextField, ToggleRow, useTransientNotice } from '@/components/ui';
import { DEFAULT_DISTRICT, GOVERNORATES, findGovernorate } from '@/domain/locations';
import { otpSchema, phoneSchema } from '@/domain/schemas';
import { MOCK_OTP, services } from '@/services';
import { usePrefs, useSession } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatEgyptPhone, isolateLtr, normalizeEgyptPhone, toWesternDigits } from '@/utils/digits';

type Step = 'phone' | 'code';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { governorate: savedGov, district: savedDistrict, otpChannel, prefs, notice: sessionNotice, setOtpChannel, setPrefs, startSession } = useSession();
  const { notice: soonNotice, show: showSoon } = useTransientNotice();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [governorate, setGovernorate] = useState(savedGov);
  const [district, setDistrict] = useState(savedDistrict);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const districts = findGovernorate(governorate)?.districts ?? [];

  const changeGovernorate = (name: string) => {
    setGovernorate(name);
    setDistrict(findGovernorate(name)?.districts[0]?.nameAr ?? DEFAULT_DISTRICT);
  };

  const sendCode = async () => {
    const parsed = phoneSchema.safeParse(phone);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await services.auth.requestCode(normalizeEgyptPhone(phone), otpChannel);
      setStep('code');
    } catch {
      setError('معرفناش نبعت الكود، جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string = code) => {
    if (busy) return;
    const digits = toWesternDigits(value);
    const parsed = otpSchema.safeParse(digits);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setBusy(true);
    Keyboard.dismiss();
    try {
      const session = await services.auth.verifyCode(normalizeEgyptPhone(phone), digits);
      startSession(session, { governorate, district });
      router.replace('/');
    } catch {
      setError('الكود مش صح، جرّب تاني');
      setBusy(false);
    }
  };

  // Alert.alert does nothing on web, so "coming soon" is an inline notice everywhere.
  const largeText = usePrefs((st) => st.largeText);
  const setLargeText = usePrefs((st) => st.setLargeText);
  const toggleLargeText = () => {
    const next = !largeText;
    setLargeText(next);
    showSoon(next ? 'اتفعّل الخط الأكبر. تقدر تقفله من حسابي.' : 'رجعنا للخط العادي.');
  };
  const soon = () => showSoon('الميزة دي قريبًا، هتتضاف في نسخة جاية.');

  // The 6th digit submits the code: the number pad has no return key.
  const onCodeChange = (t: string) => {
    const digits = toWesternDigits(t).replace(/\D/g, '');
    setCode(digits);
    if (digits.length === 6) void verify(digits);
  };

  const hero = (
    <View style={[styles.hero, { paddingTop: insets.top + 24, height: 310 + insets.top }]}>
      <Skyline style={styles.skyline} />
      <LogoPill />
      <AppText variant="slogan" color={colors.onRed} style={styles.slogan}>مدينتك أحلى لما نصلّحها سوا</AppText>
    </View>
  );

  return (
    <Screen
      avoidKeyboard
      edges={['bottom']}
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button
            testID="sign-in-submit"
            label={step === 'phone' ? 'ابعتلي الكود' : 'دخول'}
            onPress={step === 'phone' ? sendCode : () => void verify()}
            loading={busy}
          />
          {soonNotice ? <InlineNotice text={soonNotice} testID="soon-notice" /> : null}
          <View style={styles.links}>
            {step === 'code' ? (
              <Pressable accessibilityRole="button" onPress={() => { setStep('phone'); setCode(''); setError(null); }}>
                <AppText variant="smallStrong" color={colors.red}>غيّر الرقم</AppText>
              </Pressable>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={soon}><AppText variant="smallStrong" color={colors.red}>English</AppText></Pressable>
                <AppText color={colors.line}>|</AppText>
                <Pressable testID="large-text-link" accessibilityRole="button" accessibilityState={{ selected: largeText }} onPress={toggleLargeText}><AppText variant="smallStrong" color={colors.red}>{largeText ? 'خط عادي' : 'خط أكبر'}</AppText></Pressable>
              </>
            )}
          </View>
        </View>
      }
    >
      {hero}
      <View style={styles.form}>
        {sessionNotice ? <InlineNotice text={sessionNotice} testID="session-notice" /> : null}
        {step === 'phone' ? (
          <>
            <TextField
              testID="phone-input"
              label="رقم موبايلك"
              value={phone}
              onChangeText={(t) => setPhone(toWesternDigits(t).replace(/[^\d ]/g, ''))}
              keyboardType="phone-pad"
              maxLength={13}
              ltr
              large
              placeholder="010 1234 5678"
              error={error}
              helper="فودافون، أورانج، اتصالات، أو WE — هنبعتلك كود من ٦ أرقام."
              onSubmitEditing={sendCode}
              prefix={
                <View style={styles.cc}>
                  <EgyptFlag />
                  <AppText style={{ fontFamily: fonts.sans600, fontSize: 15 }}>+20</AppText>
                </View>
              }
            />

            <View style={styles.group}>
              <AppText variant="label">ابعتلي الكود على</AppText>
              <View style={styles.pair}>
                <View style={styles.flex}><ChoiceChip testID="otp-sms" radio label="رسالة SMS" selected={otpChannel === 'sms'} onPress={() => setOtpChannel('sms')} /></View>
                <View style={styles.flex}><ChoiceChip testID="otp-whatsapp" radio label="واتساب" selected={otpChannel === 'whatsapp'} onPress={() => setOtpChannel('whatsapp')} /></View>
              </View>
            </View>

            <View style={styles.pair}>
              <SelectField label="المحافظة" value={governorate} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: g.nameAr }))} onChange={changeGovernorate} />
              <SelectField label="الحي" value={district} options={districts.map((d) => ({ value: d.nameAr, label: d.nameAr }))} onChange={setDistrict} />
            </View>

            <View style={styles.privacy}>
              <Icon name="shield-check" size={20} color={colors.red} style={styles.privacyIcon} />
              <AppText variant="small" style={styles.privacyText}>رقمك مش هيظهر لحد. بنستخدمه بس عشان نبعتلك تحديثات بلاغك، وتقدر تبلّغ من غير اسم.</AppText>
            </View>

            <ToggleRow icon="wifi" title="توفير باقة النت" subtitle="صور أخف، والخريطة بتحمّل بس لما تفتحها" value={prefs.dataSaver} onValueChange={(v) => setPrefs({ dataSaver: v })} />
          </>
        ) : (
          <>
            <View style={styles.group}>
              <AppText variant="h2">اكتب الكود</AppText>
              <AppText variant="small" color={colors.inkMuted}>
                بعتنا كود من ٦ أرقام على {otpChannel === 'sms' ? 'رسالة SMS' : 'واتساب'} للرقم {isolateLtr(formatEgyptPhone(phone))}.
              </AppText>
            </View>
            <TextField
              testID="code-input"
              label="الكود"
              value={code}
              onChangeText={onCodeChange}
              keyboardType="number-pad"
              maxLength={6}
              ltr
              large
              autoFocus
              placeholder="······"
              error={error}
              onSubmitEditing={() => void verify()}
            />
            <View style={styles.hint}>
              <Icon name="info" size={18} color={colors.goldDeep} />
              <AppText variant="small" color={colors.goldDeep}>الكود التجريبي: {MOCK_OTP}</AppText>
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

function EgyptFlag() {
  return (
    <View style={styles.flag} accessibilityElementsHidden>
      <View style={{ flex: 1, backgroundColor: '#CE1126' }} />
      <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />
      <View style={{ flex: 1, backgroundColor: '#161616' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.red, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', paddingHorizontal: 20, gap: 12 },
  skyline: { position: 'absolute', bottom: 0, start: 0, end: 0 },
  slogan: { marginTop: 0 },
  form: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: '100%', borderEndWidth: 1, borderEndColor: colors.line },
  flag: { width: 22, height: 15, borderRadius: 2, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  privacyIcon: { marginTop: 2 },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 21 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goldSoft, borderRadius: radius.md, padding: 12 },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 16, minHeight: 24 },
});
