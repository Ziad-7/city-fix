import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EmergencyRow } from '@/components';
import { Icon } from '@/components/Icon';
import { StatsCard, confirmAction } from '@/components/profile';
import { AppText, Button, Card, Screen, ScreenHeader, SelectField, TextField, ToggleRow } from '@/components/ui';
import { GOVERNORATES, findGovernorate } from '@/domain/locations';
import { isOpenStatus } from '@/domain/types';
import { signOutAll, useReports, useSession } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, maskPhone, toArabicDigits } from '@/utils/digits';

/** حسابي: name, phone, area, preferences, stats, language, emergency numbers, sign out. */
export default function ProfileScreen() {
  const { phone, name, governorate, district, prefs, setArea, setPrefs, setName } = useSession();
  const reports = useReports((s) => s.reports);
  const incidents = useReports((s) => s.incidents);

  const [draft, setDraft] = useState(name ?? '');
  const [saved, setSaved] = useState(false);

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
    setTimeout(() => setSaved(false), 2000);
  };

  const changeGovernorate = (g: string) => {
    const first = findGovernorate(g)?.districts[0]?.nameAr ?? district;
    setArea(g, first);
  };

  return (
    <Screen edges={['top']} header={<ScreenHeader title="حسابي" hideBack />} gap={14} contentStyle={styles.content}>
      <Card rounded="lg" padding={16} style={styles.profileCard}>
        <View style={styles.identity}>
          <View style={styles.avatar} accessibilityRole="image" accessibilityLabel="صورة الحساب">
            {initial ? <AppText style={styles.avatarText}>{initial}</AppText> : <Icon name="user" size={30} color={colors.red} />}
          </View>
          <View style={styles.identityText}>
            <AppText variant="bodyStrong" numberOfLines={1}>{name?.trim() || 'مواطن'}</AppText>
            {masked ? <AppText variant="small" color={colors.inkMuted} style={styles.phone}>{masked}</AppText> : null}
          </View>
        </View>
        <TextField label="اسمك" value={draft} onChangeText={(t) => { setDraft(t); setSaved(false); }} placeholder="اكتب اسمك (اختياري)" maxLength={40} testID="name-input" />
        {dirty ? <Button label="حفظ الاسم" size="sm" onPress={saveName} testID="save-name" /> : null}
        {saved && !dirty ? <AppText variant="caption" color={colors.statusResolved} accessibilityLiveRegion="polite">اتحفظ الاسم</AppText> : null}
      </Card>

      <Card rounded="lg" padding={16} style={styles.section}>
        <AppText style={styles.heading} accessibilityRole="header">منطقتك</AppText>
        <View style={styles.selects}>
          <SelectField label="المحافظة" value={governorate} options={GOVERNORATES.map((g) => ({ value: g.nameAr, label: g.nameAr }))} onChange={changeGovernorate} testID="select-governorate" />
          <SelectField label="الحي" value={district} options={districts.map((d) => ({ value: d.nameAr, label: d.nameAr }))} onChange={(d) => setArea(governorate, d)} testID="select-district" />
        </View>
      </Card>

      <Card rounded="lg" padding={16} style={styles.section}>
        <ToggleRow
          bare
          icon="whatsapp"
          title="تحديثات واتساب"
          subtitle={masked ? `على رقم ${masked} — ولو مفيش نت هتوصلك SMS` : 'ولو مفيش نت هتوصلك SMS'}
          value={prefs.whatsappUpdates}
          onValueChange={(v) => setPrefs({ whatsappUpdates: v })}
          testID="pref-whatsapp"
        />
        <ToggleRow
          bare
          icon="wifi"
          title="توفير البيانات"
          subtitle="صور أخف، والخريطة بتتحمّل لما تطلبها"
          value={prefs.dataSaver}
          onValueChange={(v) => setPrefs({ dataSaver: v })}
          testID="pref-datasaver"
        />
      </Card>

      <StatsCard reports={stats.reports} fixed={stats.fixed} />

      <Card rounded="lg" padding={16} style={styles.section}>
        <View style={styles.langRow} accessible accessibilityLabel="اللغة: English، قريبًا">
          <Icon name="info" size={20} color={colors.inkMuted} />
          <AppText variant="smallStrong" style={styles.flex}>اللغة</AppText>
          <AppText variant="small" color={colors.inkMuted}>English — قريبًا</AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <AppText style={styles.heading} accessibilityRole="header">أرقام الطوارئ</AppText>
        <EmergencyRow />
      </View>

      <Button
        label="خروج"
        variant="secondary"
        icon="x"
        onPress={() => confirmAction('تسجيل الخروج', 'هتخرج من حسابك على الجهاز ده. تقدر تدخل تاني برقم موبايلك.', 'خروج', () => void signOutAll())}
        testID="sign-out"
      />
      <View style={styles.version}>
        <AppText variant="caption" color={colors.inkMuted} center>FixTheCity · النسخة {toArabicDigits(version)}</AppText>
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
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  phone: { textAlign: 'right' },
  version: { paddingVertical: 4 },
});
