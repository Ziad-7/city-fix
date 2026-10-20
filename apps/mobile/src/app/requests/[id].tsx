import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import {
  InfoTiles,
  PriorityStrip,
  RequestThumb,
  ServiceDetailsCard,
  StateMessage,
  TimelineCard,
  buildTimelineSteps,
  followersLine,
  type InfoTile,
} from '@/components/requests';
import { dayLabel } from '@/components/services';
import { AppText, Button, Card, Screen, ScreenHeader, StatusChip, ToggleRow } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { SERVICES } from '@/domain/services-catalog';
import { isOpenStatus } from '@/domain/types';
import { priorityReason } from '@/logic/priority';
import { useReports, useRequestItem, useServiceRequests, useSession } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, maskPhone } from '@/utils/digits';
import { formatDateAr, formatDateTimeAr } from '@/utils/time';

/** متابعة البلاغ / الطلب: summary, timeline, updates preferences, share. */
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useRequestItem(id);
  const reportsStatus = useReports((s) => s.status);
  const servicesStatus = useServiceRequests((s) => s.status);
  const simulateReport = useReports((s) => s.simulateProgress);
  const simulateService = useServiceRequests((s) => s.simulateProgress);
  const phone = useSession((s) => s.phone);
  const district = useSession((s) => s.district);
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);
  const setPrefs = useSession((s) => s.setPrefs);
  const [simulating, setSimulating] = useState(false);

  const steps = useMemo(() => {
    if (!item) return [];
    if (item.kind === 'report') return buildTimelineSteps(item.incident?.timeline ?? [], 'report', item.status);
    return buildTimelineSteps(item.request.timeline, 'service', item.status);
  }, [item]);

  const loading = !item && (reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'idle' || servicesStatus === 'loading');

  if (!item) {
    return (
      <Screen header={<ScreenHeader title="متابعة الطلب" />}>
        {loading ? (
          <StateMessage loading title="بنجيب التفاصيل…" />
        ) : (
          <StateMessage
            icon="search"
            title="مش لاقيين الطلب ده"
            body="ممكن يكون اتمسح أو الرابط مش صح. تقدر ترجع لقايمة طلباتك."
            actionLabel="طلباتي"
            onAction={() => router.replace('/requests')}
          />
        )}
      </Screen>
    );
  }

  const isReport = item.kind === 'report';
  const incident = isReport ? item.incident : null;
  const category = isReport ? getCategory(item.categoryId) : null;
  const catalog = isReport ? null : SERVICES.find((s) => s.serviceType === item.request.serviceType);
  const followers = incident?.followers ?? 0;
  const headerTitle = isReport ? 'متابعة البلاغ' : 'متابعة الطلب';

  const share = async () => {
    const message = isReport
      ? `بلّغت عن "${item.title}" على تطبيق FixTheCity، رقم البلاغ ${isolateLtr(`#${item.id}`)}. تابعوا معايا لحد ما يتصلّح.`
      : `حجزت خدمة "${item.title}" على تطبيق FixTheCity، رقم الطلب ${isolateLtr(`#${item.id}`)}.`;
    try {
      await Share.share({ message });
    } catch {
      // Sharing is cancelled or unavailable (web preview): nothing to do.
    }
  };

  const simulate = async () => {
    setSimulating(true);
    try {
      if (item.kind === 'report') {
        if (item.incident) await simulateReport(item.incident.id);
      } else {
        await simulateService(item.id);
      }
    } finally {
      setSimulating(false);
    }
  };

  const tiles: InfoTile[] = isReport
    ? [
        { label: 'الجهة المسؤولة', value: `${incident?.department ?? category?.department ?? ''} · حي ${district}` },
        isOpenStatus(item.status)
          ? { label: 'متوقع يخلص', value: incident?.eta ? incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '') : 'هنبلّغك أول ما يتحدد' }
          : { label: 'اتصلّح', value: formatDateAr(incident?.updatedAt ?? item.createdAt) },
      ]
    : [
        { label: 'الجهة المسؤولة', value: `خدمات الحي · حي ${district}` },
        { label: 'الميعاد', value: dayLabel(item.request.details.day) },
      ];

  return (
    <Screen
      header={
        <ScreenHeader
          title={headerTitle}
          action={
            <Pressable accessibilityRole="button" accessibilityLabel="مشاركة" onPress={share} style={styles.iconBtn} hitSlop={6}>
              <Icon name="share" size={22} />
            </Pressable>
          }
        />
      }
      gap={14}
      contentStyle={styles.content}
    >
      <Card rounded="lg" padding={16} style={styles.summary}>
        <View style={styles.summaryTop}>
          <RequestThumb
            size={72}
            uri={isReport ? item.report.photoUris[0] : undefined}
            icon={isReport ? getCategory(item.categoryId).icon : (catalog?.icon ?? 'clipboard')}
            tone={isReport ? 'report' : 'service'}
          />
          <View style={styles.summaryText}>
            <AppText style={styles.title}>{item.title}</AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {isolateLtr(`#${item.id}`)} · {isReport ? 'اتبلّغ' : 'اتحجز'} {formatDateTimeAr(item.createdAt)}
            </AppText>
            <StatusChip status={item.status} />
          </View>
        </View>
        <InfoTiles tiles={tiles} />
        {incident ? (
          <PriorityStrip score={incident.priority.score} reason={priorityReason(incident.priority, incident.linkedReportIds.length, incident.sensitivePlace)} />
        ) : null}
      </Card>

      {item.kind === 'service' ? <ServiceDetailsCard request={item.request} /> : null}

      <TimelineCard title={isReport ? 'مراحل البلاغ' : 'مراحل الطلب'} steps={steps} />

      <Card rounded="lg" padding={16} style={styles.updates}>
        <ToggleRow
          bare
          icon="whatsapp"
          title="ابعتلي التحديثات على واتساب"
          subtitle={`على رقم ${phone ? isolateLtr(maskPhone(phone)) : 'موبايلك'} — ولو مفيش نت هتوصلك SMS`}
          value={whatsapp}
          onValueChange={(v) => setPrefs({ whatsappUpdates: v })}
          testID="toggle-whatsapp"
        />
        {isReport ? <Button label="ابعت البلاغ لجروب العمارة" icon="share" variant="secondary" onPress={share} /> : null}
      </Card>

      {isReport && incident ? (
        <View style={styles.followers} accessible accessibilityLabel={followersLine(followers)}>
          <Icon name="users" size={18} color={colors.inkMuted} />
          <AppText variant="small" color={colors.inkMuted}>{followersLine(followers)}</AppText>
        </View>
      ) : null}

      {__DEV__ ? (
        <Button
          label="محاكاة تحديث الحالة"
          icon="refresh"
          variant="ghost"
          loading={simulating}
          disabled={!isOpenStatus(item.status)}
          onPress={simulate}
          testID="simulate-progress"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summary: { gap: 12 },
  summaryTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  summaryText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26, color: colors.ink },
  updates: { gap: 12, paddingVertical: 14 },
  followers: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
});
