import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { InfoTiles, RequestThumb, StateMessage, TimelineCard, dayText, slotLabel, type InfoTile } from '@/components/requests';
import { AppText, Button, Card, Screen, ScreenHeader, StatusChip, confirmAction } from '@/components/ui';
import { canCancelPickup, pickupChipStatus, type RecyclingPickup } from '@/domain/citycycle';
import { getMaterial, hasUnpricedItems } from '@/domain/materials';
import { demoPricesLabel, materialLabel, pickupModeLabel, priceToBeSetLabel, useTr } from '@/i18n';
import { expectOwnChange } from '@/store/useNotifications';
import { useCityCycle, usePricesAreDemo } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr } from '@/utils/digits';
import { formatDateTime } from '@/utils/time';
import { formatEgp, formatKg } from '@/utils/money';
import { collectorFirstName, extraWeighedRows, pickupItemRows, pickupStatusText, pickupTitle } from './pickup';
import { buildPickupSteps } from './timeline';

/** Pickup detail for `/requests/RCY-…`: status, items with estimated and weighed kg, value, collector first name, timeline, cancel / confirm. */
export function PickupDetail({ id }: { id: string }) {
  const tr = useTr();
  const pickup = useCityCycle((s) => s.pickups.find((p) => p.id === id));
  const status = useCityCycle((s) => s.status);
  const loadPickup = useCityCycle((s) => s.loadPickup);
  const [fetchState, setFetchState] = useState<'idle' | 'missing' | 'error'>('idle');
  const [fetchTry, setFetchTry] = useState(0);

  // Not in the list yet (deep link, notification tap): fetch it by id once the lists settled.
  const settled = status === 'ready' || status === 'error';
  useEffect(() => {
    if (pickup || !settled) return;
    let cancelled = false;
    loadPickup(id)
      .then((found) => {
        if (!cancelled) setFetchState(found ? 'idle' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setFetchState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, settled, id, fetchTry, loadPickup]);

  if (!pickup) {
    return (
      <Screen header={<ScreenHeader title={tr('متابعة طلب التدوير', 'Track your recycling request')} />}>
        {fetchState === 'missing' ? (
          <StateMessage icon="search" title={tr('مش لاقيين الطلب ده', "We couldn't find this request")} body={tr('ممكن يكون الرابط مش صح. تقدر ترجع لقايمة طلباتك.', 'The link may be wrong. You can go back to your requests.')} actionLabel={tr('طلباتي', 'My requests')} onAction={() => router.replace('/requests')} />
        ) : fetchState === 'error' ? (
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الطلب', "We couldn't load this request")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => { setFetchState('idle'); setFetchTry((n) => n + 1); }} />
        ) : (
          <StateMessage loading title={tr('بنجيب التفاصيل…', 'Loading the details…')} />
        )}
      </Screen>
    );
  }
  return <Loaded pickup={pickup} />;
}

function Loaded({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  const demo = usePricesAreDemo();
  const prices = useCityCycle((s) => s.prices);
  const cancelPickup = useCityCycle((s) => s.cancelPickup);
  const confirmPickup = useCityCycle((s) => s.confirmPickup);
  const simulate = useCityCycle((s) => s.simulatePickupProgress);
  const [busy, setBusy] = useState<null | 'cancel' | 'confirm' | 'simulate'>(null);
  const [error, setError] = useState<string | null>(null);

  const steps = useMemo(
    () => buildPickupSteps(pickup),
    // The future-step labels are written when the steps are built: rebuild on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickup, tr],
  );
  const rows = [...pickupItemRows(pickup), ...extraWeighedRows(pickup)];
  const first = collectorFirstName(pickup.collectorName);
  const finished = pickup.status === 'completed';
  const showEstimate = pickup.estimatedValueEgp !== undefined;
  // Some material has no price yet: the estimate is only a lower bound.
  const partialEstimate = showEstimate && hasUnpricedItems(pickup.items, prices);
  const showFinal = pickup.totalValueEgp !== undefined && (pickup.status === 'weighed' || finished);

  const run = async (kind: 'cancel' | 'confirm' | 'simulate', fn: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(null);
    }
  };

  const doCancel = () =>
    confirmAction(
      tr('تلغي الطلب؟', 'Cancel this request?'),
      tr('مفيش جامع قبله لسه، وتقدر تطلب تاني في أي وقت.', 'No collector has accepted it yet, and you can ask again any time.'),
      tr('الغي الطلب', 'Cancel request'),
      () => {
        // The person caused this change: no notification about their own tap.
        const release = expectOwnChange([pickup.id], 'cancelled');
        void run('cancel', () => cancelPickup(pickup.id)).finally(release);
      },
    );

  const tiles: InfoTile[] = [
    { label: tr('الميعاد', 'Scheduled'), value: `${dayText(pickup.day)} · ${slotLabel(pickup.slot)}` },
    { label: tr('طريقة التسليم', 'Handover'), value: pickupModeLabel(pickup.mode) },
  ];
  const place = [pickup.location.address, pickup.location.landmark].filter(Boolean).join(tr('، ', ', '));

  return (
    <Screen header={<ScreenHeader title={tr('متابعة طلب التدوير', 'Track your recycling request')} />} gap={14} contentStyle={styles.content}>
      <Card rounded="lg" padding={16} style={styles.summary} testID="pickup-summary">
        <View style={styles.summaryTop}>
          <RequestThumb size={72} uri={pickup.photoUris[0]} icon="recycle" tone="recycle" />
          <View style={styles.summaryText}>
            <AppText style={styles.title}>{pickupTitle(pickup.items)}</AppText>
            <AppText variant="caption" color={colors.inkMuted}>{isolateLtr(`#${pickup.id}`)} · {tr('اتطلب', 'Requested')} {formatDateTime(pickup.createdAt)}</AppText>
            <View style={styles.chip}>
              <StatusChip status={pickupChipStatus(pickup.status)} label={pickupStatusText(pickup)} />
            </View>
          </View>
        </View>
        <InfoTiles tiles={tiles} />
        {place ? (
          <View style={styles.place}>
            <Icon name="pin" size={18} color={colors.red} />
            <AppText variant="small" style={{ flex: 1 }}>{place}</AppText>
          </View>
        ) : null}
        {first ? (
          <View style={styles.place} accessible accessibilityLabel={`${tr('الجامع', 'Collector')}: ${first}`}>
            <Icon name="truck" size={18} color={colors.red} />
            <AppText variant="small" style={{ flex: 1 }}>{tr('الجامع', 'Collector')}: <AppText variant="smallStrong">{first}</AppText></AppText>
          </View>
        ) : null}
      </Card>

      <Card rounded="lg" padding={16} style={{ gap: 10 }} testID="pickup-items">
        <AppText style={styles.heading} accessibilityRole="header">{tr('الخامات', 'Materials')}</AppText>
        {rows.map((r) => (
          <View key={r.materialId} style={styles.itemRow} testID={`item-${r.materialId}`} accessible accessibilityLabel={`${materialLabel(r.materialId)}. ${r.estimatedKg > 0 ? `${tr('تقديري', 'Estimated')} ${formatKg(r.estimatedKg)}. ` : ''}${r.weighedKg !== undefined ? `${tr('الوزن الفعلي', 'Weighed amount')} ${formatKg(r.weighedKg)}` : ''}`}>
            <Icon name={getMaterial(r.materialId).icon} size={22} color={colors.red} />
            <AppText variant="smallStrong" style={{ flex: 1 }}>{materialLabel(r.materialId)}</AppText>
            <View style={styles.kgCol}>
              {r.estimatedKg > 0 ? <AppText variant="caption" color={colors.inkMuted}>{tr('تقديري', 'Estimated')} {formatKg(r.estimatedKg)}</AppText> : null}
              {r.weighedKg !== undefined ? <AppText variant="smallStrong" color={colors.statusResolved}>{tr('الوزن الفعلي', 'Weighed amount')} {formatKg(r.weighedKg)}</AppText> : null}
            </View>
          </View>
        ))}
        <View style={styles.totals}>
          <View style={styles.totalLine}>
            <AppText variant="small" color={colors.inkMuted} style={{ flex: 1 }}>{tr('القيمة التقديرية', 'Estimated value')}</AppText>
            <AppText variant="smallStrong" testID="estimated-value">
              {!showEstimate ? priceToBeSetLabel() : partialEstimate ? tr(`من ${formatEgp(pickup.estimatedValueEgp as number)}`, `From ${formatEgp(pickup.estimatedValueEgp as number)}`) : formatEgp(pickup.estimatedValueEgp as number)}
            </AppText>
          </View>
          {partialEstimate ? <AppText variant="caption" color={colors.inkMuted}>{tr('وباقي الخامات السعر هيتحدد', 'Price to be set for the other materials')}</AppText> : null}
          {showFinal ? (
            <View style={styles.totalLine}>
              <AppText variant="small" style={{ flex: 1 }}>{finished && pickup.mode === 'paid' ? tr('اتدفعلك', 'Paid to you') : tr('قيمة الوزن الفعلي', 'Value of the weighed amount')}</AppText>
              <AppText style={styles.finalValue} testID="final-value">{formatEgp(finished && pickup.mode === 'paid' ? (pickup.paidToHouseholdEgp ?? pickup.totalValueEgp ?? 0) : (pickup.totalValueEgp as number))}</AppText>
            </View>
          ) : null}
          {demo && (showEstimate || showFinal) ? <AppText variant="caption" color={colors.goldDeep}>{demoPricesLabel()}</AppText> : null}
        </View>
        {pickup.note ? <AppText variant="small" color={colors.inkMuted}>{tr('ملحوظتك', 'Your note')}: {pickup.note}</AppText> : null}
      </Card>

      <TimelineCard title={tr('مراحل الطلب', 'Request progress')} steps={steps} />

      {error ? <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{error}</AppText> : null}

      {finished && !pickup.confirmedAt ? (
        <Card rounded="lg" padding={16} style={{ gap: 10 }}>
          <AppText variant="small">{tr('كل حاجة تمام مع الوزن والدفع؟', 'Is everything right with the weight and payment?')}</AppText>
          <Button testID="confirm-pickup" label={tr('أكّد إن الاستلام تم', 'Confirm the pickup')} icon="check" loading={busy === 'confirm'} onPress={() => void run('confirm', () => confirmPickup(pickup.id))} />
        </Card>
      ) : null}
      {finished && pickup.confirmedAt ? (
        <View style={styles.confirmed} accessible accessibilityLabel={tr('اتأكد الاستلام', 'Pickup confirmed')}>
          <Icon name="check" size={18} color={colors.statusResolved} strokeWidth={3} />
          <AppText variant="small" color={colors.statusResolved}>{tr('أكّدت الاستلام. شكرًا!', 'You confirmed the pickup. Thank you!')}</AppText>
        </View>
      ) : null}

      {canCancelPickup(pickup.status) ? (
        <Button testID="cancel-pickup" label={tr('الغي الطلب', 'Cancel request')} variant="secondary" loading={busy === 'cancel'} onPress={doCancel} />
      ) : null}

      {__DEV__ && (pickup.status === 'requested' || pickup.status === 'accepted' || pickup.status === 'weighed') ? (
        <Button testID="simulate-pickup" label={tr('محاكاة تحديث الحالة', 'Simulate a status update')} icon="refresh" variant="ghost" loading={busy === 'simulate'} onPress={() => void run('simulate', () => simulate(pickup.id))} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  summary: { gap: 12 },
  summaryTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  summaryText: { flex: 1, minWidth: 0, gap: 4 },
  chip: { alignSelf: 'flex-start' },
  title: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26, color: colors.ink },
  place: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kgCol: { alignItems: 'flex-end' },
  totals: { gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  totalLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  finalValue: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26, color: colors.statusResolved },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
});
