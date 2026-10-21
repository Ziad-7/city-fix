import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button, Card, Screen, ScreenHeader } from '@/components/ui';
import {
  DEFAULT_GARBAGE_SCHEDULE,
  WEEKDAY_CODES,
  WEEKDAY_NAME_AR,
  nextCollection,
  perWeekAr,
  scheduleSummary,
  type GarbageSchedule,
} from '@/domain/garbage-schedule';
import { getGarbageSchedule } from '@/services/garbage-schedule';
import { useSession } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';

const TIPS = [
  'حط الأكياس مقفولة قبل الميعاد بساعة.',
  'سيب الأكياس جنب باب العمارة مش في نص الشارع.',
  'افصل المخلفات الكبيرة، وللعفش القديم احجز خدمة "رفع مخلفات كبيرة".',
];

/** مواعيد جمع القمامة in the citizen's district, with the next collection highlighted. */
export default function GarbageScheduleScreen() {
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
  const next = useMemo(() => nextCollection(days), [days]);

  return (
    <Screen header={<ScreenHeader title="مواعيد جمع القمامة" />} gap={14} contentStyle={styles.content}>
      <View style={styles.area}>
        <Icon name="pin" size={16} color={colors.inkMuted} />
        <AppText variant="small" color={colors.inkMuted}>{`حي ${district}، ${governorate}`}</AppText>
      </View>

      {schedule ? (
        <>
          {next ? (
            <View style={styles.next} accessible accessibilityLabel={`الجاية: ${next.label}`}>
              <AppText variant="caption" color={colors.redSoft}>الجاية</AppText>
              <AppText color={colors.onRed} style={styles.nextLabel}>{next.label}</AppText>
              <AppText variant="small" color={colors.onRed}>{`العربية بتعدّي ${schedule.window}`}</AppText>
            </View>
          ) : null}

          <Card rounded="lg" padding={16} style={styles.section}>
            <View style={styles.rowTop}>
              <AppText style={styles.heading} accessibilityRole="header">الجدول الأسبوعي</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{perWeekAr(schedule.days.length)}</AppText>
            </View>
            <View style={styles.week}>
              {WEEKDAY_CODES.map((code) => {
                const on = schedule.days.includes(code);
                const isNext = next?.code === code;
                return (
                  <View
                    key={code}
                    accessible
                    accessibilityLabel={`${WEEKDAY_NAME_AR[code]}: ${on ? 'فيه جمع' : 'مفيش جمع'}`}
                    style={[styles.day, on ? styles.dayOn : null, isNext ? styles.dayNext : null]}
                  >
                    <AppText fixedSize style={[styles.dayText, { color: on ? colors.onRed : colors.inkMuted }]} numberOfLines={1}>
                      {WEEKDAY_NAME_AR[code]}
                    </AppText>
                  </View>
                );
              })}
            </View>
            <AppText variant="small" color={colors.inkMuted}>{scheduleSummary(schedule)}</AppText>
            {schedule.note ? <AppText variant="small" color={colors.goldDeep}>{schedule.note}</AppText> : null}
          </Card>

          <Card rounded="lg" padding={16} style={styles.section}>
            <AppText style={styles.heading} accessibilityRole="header">نصايح</AppText>
            {TIPS.map((t) => (
              <View key={t} style={styles.tip}>
                <Icon name="check" size={16} color={colors.statusResolved} strokeWidth={2.5} />
                <AppText variant="small" style={styles.flex}>{t}</AppText>
              </View>
            ))}
          </Card>

          <Button
            testID="garbage-missed"
            label="بلّغ إن العربية مجتش"
            icon="alert-triangle"
            onPress={() => router.push('/report/new?category=garbage')}
          />
        </>
      ) : (
        <AppText variant="small" color={colors.inkMuted} center>بنجيب المواعيد…</AppText>
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
