import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { placeName, useLang, useTr } from '@/i18n';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import {
  DEFAULT_GARBAGE_SCHEDULE,
  WEEKDAY_CODES,
  nextCollection,
  perWeekAr,
  scheduleSummary,
  weekdayLabel,
  windowLabel,
  type GarbageSchedule,
} from '@/domain/garbage-schedule';
import { getGarbageSchedule } from '@/services/garbage-schedule';
import { useSession } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';

const TIPS: { ar: string; en: string }[] = [
  { ar: 'حط الأكياس مقفولة قبل الميعاد بساعة.', en: 'Put your bags out, tied shut, an hour before pickup.' },
  { ar: 'سيب الأكياس جنب باب العمارة مش في نص الشارع.', en: 'Leave bags next to the building entrance, not in the middle of the street.' },
  { ar: 'افصل المخلفات الكبيرة، وللعفش القديم احجز خدمة "رفع مخلفات كبيرة".', en: 'Keep large items separate. For old furniture, book “Bulky waste pickup”.' },
];

/** English text for the demo schedule notes (the Arabic note comes with the schedule data). */
const NOTE_EN: Record<string, string> = {
  'لو العربية اتأخرت أكتر من ساعتين، بلّغ من الزرار تحت.': 'If the truck is more than 2 hours late, report it with the button below.',
};

/** "٣ مرات في الأسبوع" / "3 times a week". */
function perWeekLabel(n: number, lang: 'ar' | 'en'): string {
  if (lang === 'ar') return perWeekAr(n);
  return n === 1 ? 'Once a week' : n === 2 ? 'Twice a week' : `${n} times a week`;
}

/** مواعيد جمع القمامة in the citizen's district, with the next collection highlighted. */
export default function GarbageScheduleScreen() {
  const tr = useTr();
  const lang = useLang();
  const district = useSession((s) => s.district);
  const governorate = useSession((s) => s.governorate);
  const [schedule, setSchedule] = useState<GarbageSchedule | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getGarbageSchedule(district).then((s) => {
      if (!cancelled) setSchedule(s);
    });
    return () => {
      cancelled = true;
    };
  }, [district]);

  const days = schedule?.days ?? DEFAULT_GARBAGE_SCHEDULE.days;
  const next = nextCollection(days); // the label depends on the language; this component re-renders on a switch

  return (
    <Screen header={<ScreenHeader title={tr('مواعيد جمع القمامة', 'Garbage collection times')} />} gap={14} contentStyle={styles.content}>
      <View style={styles.area}>
        <Icon name="pin" size={16} color={colors.inkMuted} />
        <AppText variant="small" color={colors.inkMuted}>{lang === 'en' ? `${placeName(district)}, ${placeName(governorate)}` : `حي ${district}، ${governorate}`}</AppText>
      </View>

      {schedule ? (
        <>
          {next ? (
            <View style={styles.next} accessible accessibilityLabel={`${tr('الجاية', 'Next pickup')}: ${next.label}`}>
              <AppText variant="caption" color={colors.redSoft}>{tr('الجاية', 'Next pickup')}</AppText>
              <AppText color={colors.onRed} style={styles.nextLabel}>{next.label}</AppText>
              <AppText variant="small" color={colors.onRed}>{`${tr('العربية بتعدّي', 'The truck comes')} ${windowLabel(schedule.window)}`}</AppText>
            </View>
          ) : null}

          <Card rounded="lg" padding={16} style={styles.section}>
            <View style={styles.rowTop}>
              <AppText style={styles.heading} accessibilityRole="header">{tr('الجدول الأسبوعي', 'Weekly schedule')}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{perWeekLabel(schedule.days.length, lang)}</AppText>
            </View>
            <View style={styles.week}>
              {WEEKDAY_CODES.map((code) => {
                const on = schedule.days.includes(code);
                const isNext = next?.code === code;
                return (
                  <View
                    key={code}
                    accessible
                    accessibilityLabel={`${weekdayLabel(code)}: ${on ? tr('فيه جمع', 'Collection day') : tr('مفيش جمع', 'No collection')}`}
                    style={[styles.day, on ? styles.dayOn : null, isNext ? styles.dayNext : null]}
                  >
                    <AppText fixedSize style={[styles.dayText, { color: on ? colors.onRed : colors.inkMuted }]} numberOfLines={1}>
                      {lang === 'en' ? weekdayLabel(code).slice(0, 3) : weekdayLabel(code)}
                    </AppText>
                  </View>
                );
              })}
            </View>
            <AppText variant="small" color={colors.inkMuted}>{scheduleSummary(schedule)}</AppText>
            {schedule.note ? <AppText variant="small" color={colors.goldDeep}>{lang === 'en' ? NOTE_EN[schedule.note] ?? schedule.note : schedule.note}</AppText> : null}
          </Card>

          <Card rounded="lg" padding={16} style={styles.section}>
            <AppText style={styles.heading} accessibilityRole="header">{tr('نصايح', 'Tips')}</AppText>
            {TIPS.map((t) => (
              <View key={t.ar} style={styles.tip}>
                <Icon name="check" size={16} color={colors.statusResolved} strokeWidth={2.5} />
                <AppText variant="small" style={styles.flex}>{tr(t.ar, t.en)}</AppText>
              </View>
            ))}
          </Card>

          <Button
            testID="garbage-missed"
            label={tr('بلّغ إن العربية مجتش', 'Report a missed pickup')}
            icon="alert-triangle"
            onPress={() => router.push('/report/new?category=garbage')}
          />
        </>
      ) : (
        <AppText variant="small" color={colors.inkMuted} center>{tr('بنجيب المواعيد…', 'Loading the schedule…')}</AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  flex: { flex: 1 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  next: { backgroundColor: colors.red, borderRadius: radius.lg, padding: 18, gap: 4 },
  nextLabel: { fontFamily: fonts.display700, fontSize: 26, lineHeight: 38 },
  section: { gap: 12 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { minWidth: 70, flexGrow: 1, flexBasis: '22%', minHeight: 40, borderRadius: radius.pill, backgroundColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dayOn: { backgroundColor: colors.statusResolved },
  dayNext: { backgroundColor: colors.red },
  dayText: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 20 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
