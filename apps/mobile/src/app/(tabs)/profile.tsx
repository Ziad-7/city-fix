import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { EmergencyRow } from '@/components';
import { Icon } from '@/components/Icon';
import { StatsCard } from '@/components/profile';
import { ImpactEntryCard } from '@/components/recycle/ImpactEntryCard';
import { AppText, Button, Card, ChoiceChip, Screen, ScreenHeader, SelectField, TextField, ToggleRow, confirmAction } from '@/components/ui';
import { setLang, placeName, useLang, useTr, type Lang } from '@/i18n';
import { GOVERNORATES, findGovernorate } from '@/domain/locations';
import { isOpenStatus } from '@/domain/types';
import { ensureNotificationPermission, setupOsNotifications } from '@/notifications/os';
import { signOutAll, usePrefs, useReports, useSession } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, localDigits, maskPhone } from '@/utils/digits';

/** Account (حسابي): name, phone, area, preferences, stats, language, emergency numbers, sign out. */
const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'ar', label: 'العربية' },
  { id: 'en', label: 'English' },
];

export default function ProfileScreen() {
  const tr = useTr();
  const lang = useLang();
  const { phone, name, governorate, district, prefs, setArea, setPrefs, setName } = useSession();
  const largeText = usePrefs((s) => s.largeText);
  const setLargeText = usePrefs((s) => s.setLargeText);
  const appNotifications = usePrefs((s) => s.appNotifications);
  const setAppNotifications = usePrefs((s) => s.setAppNotifications);
  const [notifDenied, setNotifDenied] = useState(false);
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);

  const [draft, setDraft] = useState(name ?? '');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const stats = useMemo(() => {
    const byId = new Map(incidents.map((i) => [i.id, i]));
    const fixed = reports.filter((r) => {
      const inc = byId.get(r.incidentId);
      return inc ? !isOpenStatus(inc.status) : false;
    }).length;
    return { reports: reports.length, fixed };
  }, [reports, incidents]);

  const trimmed = draft.trim();
  const dirty = trimmed !== (name ?? '');
  const initial = (name ?? '').trim().charAt(0);
  const districts = findGovernorate(governorate)?.districts ?? [];
  const masked = phone ? isolateLtr(maskPhone(phone)) : '';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const saveName = () => {
    setName(trimmed || null);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  };

  const toggleNotifications = async (on: boolean) => {
    setNotifDenied(false);
    setAppNotifications(on);
    if (!on || Platform.OS === 'web') return; // the web preview has no OS notifications: the in-app centre only
    await setupOsNotifications();
    // Asks for the OS permission now; a refusal keeps the in-app centre working and says so.
    if (!(await ensureNotificationPermission())) setNotifDenied(true);
  };

  const changeGovernorate = (g: string) => {
    const first = findGovernorate(g)?.districts[0]?.nameAr ?? district;
    setArea(g, first);
  };

  return (
    <Screen edges={['top']} header={<ScreenHeader title={tr('حسابي', 'Account')} hideBack />} gap={14} contentStyle={styles.content}>
      <Card rounded="lg" padding={16} style={styles.profileCard}>
        <View style={styles.identity}>
          <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={tr('صورة الحساب', 'Profile picture')}>
            {initial ? <AppText style={styles.avatarText}>{initial}</AppText> : <Icon name="user" size={30} color={colors.red} />}
          </View>
          <View style={styles.identityText}>
            <AppText variant="bodyStrong" numberOfLines={1}>{name?.trim() || tr('مواطن', 'Citizen')}</AppText>
            {masked ? <AppText variant="small" color={colors.inkMuted}>{masked}</AppText> : null}
          </View>
        </View>
        <TextField label={tr('اسمك', 'Your name')} value={draft} onChangeText={(t) => { setDraft(t); setSaved(false); }} placeholder={tr('اكتب اسمك (اختياري)', 'Your name (optional)')} maxLength={40} testID="name-input" />
        {dirty ? <Button label={tr('حفظ الاسم', 'Save name')} size="sm" onPress={saveName} testID="save-name" /> : null}
        {saved && !dirty ? <AppText variant="caption" color={colors.statusResolved} accessibilityLiveRegion="polite">{tr('اتحفظ الاسم', 'Name saved')}</AppText> : null}
      </Card>

      <Card rounded="lg" padding={16} style={styles.section}>
        <AppText style={styles.heading} accessibilityRole="header">{tr('منطقتك', 'Your area')}</AppText>
        <View style={styles.selects}>
          <SelectField label={tr('المحافظة', 'Governorate')} value={governorate} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: placeName(g.nameAr) }))} onChange={changeGovernorate} testID="select-governorate" />
          <SelectField label={tr('الحي', 'District')} value={district} options={districts.map((d) => ({ value: d.nameAr, label: placeName(d.nameAr) }))} onChange={(d) => setArea(governorate, d)} testID="select-district" />
        </View>
      </Card>

      <Card rounded="lg" padding={16} style={styles.section}>
        <ToggleRow
          bare
          icon="whatsapp"
          title={tr('تحديثات واتساب', 'WhatsApp updates')}
          subtitle={masked ? tr(`على رقم ${masked} — ولو مفيش نت هتوصلك SMS`, `To ${masked} — and if there’s no internet, we’ll send an SMS`) : tr('ولو مفيش نت هتوصلك SMS', 'And if there’s no internet, we’ll send an SMS')}
          value={prefs.whatsappUpdates}
          onValueChange={(v) => setPrefs({ whatsappUpdates: v })}
          testID="pref-whatsapp"
        />
        <ToggleRow
          bare
          icon="bell"
          title={tr('إشعارات التطبيق', 'App notifications')}
          subtitle={tr('تنبيه على موبايلك لما حالة بلاغ أو طلب تتغيّر', 'An alert on your phone when a report or request changes status')}
          value={appNotifications}
          onValueChange={(v) => void toggleNotifications(v)}
          testID="pref-notifications"
        />
        {notifDenied ? (
          <AppText variant="caption" color={colors.goldDeep} accessibilityLiveRegion="polite">
            {tr('الإذن مش متاح. هتلاقي التحديثات في مركز الإشعارات جوه التطبيق، وتقدر تسمح بالتنبيهات من إعدادات الموبايل.', 'Notifications are turned off for CityFix. You’ll still see updates in the app’s notification centre, and you can turn alerts on in your phone settings.')}
          </AppText>
        ) : null}
        <ToggleRow
          bare
          icon="wifi"
          title={tr('توفير البيانات', 'Data saver')}
          subtitle={tr('صور أخف، والخريطة بتتحمّل لما تطلبها', 'Lighter photos, and the map loads only when you ask')}
          value={prefs.dataSaver}
          onValueChange={(v) => setPrefs({ dataSaver: v })}
          testID="pref-datasaver"
        />
        <ToggleRow
          bare
          icon="search"
          title={tr('خط أكبر', 'Larger text')}
          subtitle={tr('يكبّر الكلام في التطبيق كله', 'Makes text bigger across the whole app')}
          value={largeText}
          onValueChange={setLargeText}
          testID="pref-largetext"
        />
      </Card>

      <StatsCard reports={stats.reports} fixed={stats.fixed} />

      <ImpactEntryCard />

      <Card rounded="lg" padding={16} style={styles.section}>
        <View style={styles.langRow}>
          <Icon name="info" size={20} color={colors.inkMuted} />
          <AppText variant="smallStrong" style={styles.flex} accessibilityRole="header">{tr('اللغة', 'Language')}</AppText>
        </View>
        <View style={styles.langChoices} accessibilityRole="radiogroup">
          {LANGUAGES.map((l) => (
            <View key={l.id} style={styles.flex}>
              <ChoiceChip label={l.label} radio selected={lang === l.id} onPress={() => setLang(l.id)} testID={`lang-${l.id}`} />
            </View>
          ))}
        </View>
      </Card>

      <View style={styles.section}>
        <AppText style={styles.heading} accessibilityRole="header">{tr('أرقام الطوارئ', 'Emergency numbers')}</AppText>
        <EmergencyRow />
      </View>

      <Button
        label={tr('خروج', 'Sign out')}
        variant="secondary"
        icon="x"
        onPress={() => confirmAction(tr('تسجيل الخروج', 'Sign out'), tr('هتخرج من حسابك على الجهاز ده. تقدر تدخل تاني برقم موبايلك.', 'You’ll be signed out on this device. You can sign back in with your mobile number.'), tr('خروج', 'Sign out'), () => void signOutAll())}
        testID="sign-out"
      />
      <View style={styles.version}>
        <AppText variant="caption" color={colors.inkMuted} center>{tr('CityFix · النسخة', 'CityFix · Version')} {localDigits(version)}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  flex: { flex: 1 },
  profileCard: { gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display700, fontSize: 28, lineHeight: 36, color: colors.red },
  identityText: { flex: 1, minWidth: 0 },
  section: { gap: 12 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  selects: { flexDirection: 'row', gap: 10 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
  langChoices: { flexDirection: 'row', gap: 8 },
  version: { paddingVertical: 4 },
});
