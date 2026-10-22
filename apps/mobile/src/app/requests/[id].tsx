import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { PickupDetail } from '@/components/recycle/PickupDetail';
import {
  InfoTiles,
  PriorityStrip,
  ReopenCard,
  RequestThumb,
  ServiceDetailsCard,
  StateMessage,
  TimelineCard,
  buildTimelineSteps,
  dayText,
  followersLine,
  type InfoTile,
} from '@/components/requests';
import { AppText, Button, Card, Screen, ScreenHeader, StatusChips, ToggleRow } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { SERVICES } from '@/domain/services-catalog';
import { isOpenStatus } from '@/domain/types';
import { useTr } from '@/i18n';
import { departmentLabel, placeName } from '@/i18n/labels';
import { isCriticalIncident, priorityReason } from '@/logic/priority';
import { refreshAll, useReports, useRequestItem, useServiceRequests, useSession } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, maskPhone } from '@/utils/digits';
import { formatDate, formatDateTime } from '@/utils/time';

/** متابعة البلاغ / الطلب: summary, timeline, updates preferences, share. `RCY-…` ids are recycling pickups. */
export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return id?.startsWith('RCY-') ? <PickupDetail id={id} /> : <ReportOrServiceDetail />;
}

function ReportOrServiceDetail() {
  const tr = useTr();
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useRequestItem(id);
  // Pickups (RCY-…) have their own screen; this one only shows reports and service requests.
  const item = found && found.kind !== 'pickup' ? found : null;
  const reportsStatus = useReports((s) => s.status);
  const servicesStatus = useServiceRequests((s) => s.status);
  const simulateReport = useReports((s) => s.simulateProgress);
  const simulateService = useServiceRequests((s) => s.simulateProgress);
  const phone = useSession((s) => s.phone);
  const district = useSession((s) => s.district);
  const whatsapp = useSession((s) => s.prefs.whatsappUpdates);
  const setPrefs = useSession((s) => s.setPrefs);
  const [simulating, setSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  const steps = useMemo(() => {
    if (!item) return [];
    if (item.kind === 'report') return buildTimelineSteps(item.incident?.timeline ?? [], 'report', item.status);
    return buildTimelineSteps(item.request.timeline, 'service', item.status);
    // `tr` changes with the language: the future-step labels are written when the steps are built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, tr]);

  // Not in the cached lists (deep link, notification, list still loading): fetch it by id once the lists settled.
  const loadReport = useReports((s) => s.loadReport);
  const loadRequest = useServiceRequests((s) => s.loadRequest);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const [fetchTry, setFetchTry] = useState(0);
  const listsSettled = reportsStatus !== 'idle' && reportsStatus !== 'loading' && servicesStatus !== 'idle' && servicesStatus !== 'loading';
  const missing = !item && !!id;
  useEffect(() => {
    if (!missing || !listsSettled) return;
    let cancelled = false;
    (id.startsWith('SRV-') ? loadRequest(id) : loadReport(id))
      .then((found) => {
        if (!cancelled) setFetchState(found ? 'idle' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setFetchState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [missing, listsSettled, id, fetchTry, loadReport, loadRequest]);

  const failed = !item && fetchState === 'error';
  const loading = !item && fetchState !== 'missing' && fetchState !== 'error';

  if (!item) {
    return (
      <Screen header={<ScreenHeader title={tr('متابعة الطلب', 'Track your request')} />}>
        {loading ? (
          <StateMessage loading title={tr('بنجيب التفاصيل…', 'Loading the details…')} />
        ) : failed ? (
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الطلب', "We couldn't load this request")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => {
              setFetchState('loading');
              setFetchTry((n) => n + 1);
              void refreshAll();
            }} />
        ) : (
          <StateMessage
            icon="search"
            title={tr('مش لاقيين الطلب ده', "We couldn't find this request")}
            body={tr('ممكن يكون اتمسح أو الرابط مش صح. تقدر ترجع لقايمة طلباتك.', 'It may have been deleted, or the link is wrong. You can go back to your requests.')}
            actionLabel={tr('طلباتي', 'My requests')}
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
  const headerTitle = isReport ? tr('متابعة البلاغ', 'Track your report') : tr('متابعة الطلب', 'Track your request');

  const share = async () => {
    const message = isReport
      ? tr(
          `بلّغت عن "${item.title}" على سيتي فيكس، رقم البلاغ ${isolateLtr(`#${item.id}`)}. تابعوا معايا لحد ما يتصلّح.`,
          `I reported "${item.title}" on CityFix, report number ${isolateLtr(`#${item.id}`)}. Follow it with me until it's fixed.`,
        )
      : tr(
          `حجزت خدمة "${item.title}" على سيتي فيكس، رقم الطلب ${isolateLtr(`#${item.id}`)}.`,
          `I booked "${item.title}" on CityFix, request number ${isolateLtr(`#${item.id}`)}.`,
        );
    try {
      await Share.share({ message });
    } catch {
      // Sharing is cancelled or unavailable (web preview): nothing to do.
    }
  };

  const simulate = async () => {
    setSimulating(true);
    setSimulateError(false);
    try {
      if (item.kind === 'report') {
        if (item.incident) await simulateReport(item.incident.id);
      } else {
        await simulateService(item.id);
      }
    } catch {
      setSimulateError(true);
    } finally {
      setSimulating(false);
    }
  };

  const tiles: InfoTile[] = isReport
    ? [
        {
          label: tr('الجهة المسؤولة', 'Handled by'),
          value: `${departmentLabel(incident?.department ?? category?.department ?? '')} · ${tr(`حي ${district}`, placeName(district))}`,
        },
        isOpenStatus(item.status)
          ? {
              label: tr('متوقع يخلص', 'Expected to finish'),
              value: incident?.eta ? incident.eta.replace(/^متوقع\s+(نخلص\s+)?/, '') : tr('هنبلّغك أول ما يتحدد', "We'll tell you once it's set"),
            }
          : { label: tr('اتصلّح', 'Fixed on'), value: formatDate(incident?.updatedAt ?? item.createdAt) },
      ]
    : [
        { label: tr('الجهة المسؤولة', 'Handled by'), value: `${tr('خدمات الحي', 'District Services')} · ${tr(`حي ${district}`, placeName(district))}` },
        { label: tr('الميعاد', 'Scheduled'), value: dayText(item.request.details.day) },
      ];

  return (
    <Screen
      header={
        <ScreenHeader
          title={headerTitle}
          action={
            <Pressable accessibilityRole="button" accessibilityLabel={tr('مشاركة', 'Share')} onPress={share} style={styles.iconBtn} hitSlop={6}>
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
              {isolateLtr(`#${item.id}`)} · {isReport ? tr('اتبلّغ', 'Reported') : tr('اتحجز', 'Booked')} {formatDateTime(item.createdAt)}
            </AppText>
            <View style={styles.chips}>
              <StatusChips status={item.status} critical={!!incident && isCriticalIncident(incident)} />
            </View>
          </View>
        </View>
        <InfoTiles tiles={tiles} />
        {incident ? (
          <PriorityStrip score={incident.priority.score} reason={priorityReason(incident.priority, incident.linkedReportIds.length, incident.sensitivePlace)} />
        ) : null}
      </Card>

      {item.kind === 'service' ? <ServiceDetailsCard request={item.request} /> : null}

      {incident ? <ReopenCard key={incident.id} incidentId={incident.id} status={incident.status} /> : null}

      <TimelineCard title={isReport ? tr('مراحل البلاغ', 'Report progress') : tr('مراحل الطلب', 'Request progress')} steps={steps} />

      <Card rounded="lg" padding={16} style={styles.updates}>
        <ToggleRow
          bare
          icon="whatsapp"
          title={tr('ابعتلي التحديثات على واتساب', 'Send me updates on WhatsApp')}
          subtitle={tr(
            `على رقم ${phone ? isolateLtr(maskPhone(phone)) : 'موبايلك'} — ولو مفيش نت هتوصلك SMS`,
            `To ${phone ? isolateLtr(maskPhone(phone)) : 'your phone'}. No internet? We'll send an SMS instead.`,
          )}
          value={whatsapp}
          onValueChange={(v) => setPrefs({ whatsappUpdates: v })}
          testID="toggle-whatsapp"
        />
        {isReport ? <Button label={tr('ابعت البلاغ لجروب العمارة', 'Share with your building group')} icon="share" variant="secondary" onPress={share} /> : null}
      </Card>

      {isReport && incident ? (
        <View style={styles.followers} accessible accessibilityLabel={followersLine(followers)}>
          <Icon name="users" size={18} color={colors.inkMuted} />
          <AppText variant="small" color={colors.inkMuted}>{followersLine(followers)}</AppText>
        </View>
      ) : null}

      {simulateError ? <AppText variant="caption" color={colors.urgent} center>{tr('المحاكاة مش متاحة دلوقتي.', "Simulation isn't available right now.")}</AppText> : null}
      {__DEV__ ? (
        <Button
          label={tr('محاكاة تحديث الحالة', 'Simulate a status update')}
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
  chips: { alignSelf: 'flex-start' },
  title: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26, color: colors.ink },
  updates: { gap: 12, paddingVertical: 14 },
  followers: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
});
