import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { InfoTiles, RequestThumb, StateMessage, TimelineCard } from '@/components/requests';
import { dayText, slotLabel } from '@/components/requests/labels';
import { AppText, Button, Card, Screen, ScreenHeader, confirmAction } from '@/components/ui';
import {
  awaitingConfirmation,
  canCancelPickup,
  estimateValue,
  formatEgp,
  formatKg,
  formatPrice,
  materialLabel,
  pickupModeLabel,
  sumKg,
  type RecyclingPickup,
} from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { buildPickupSteps, collectorDisplayName, materialsSummary } from '@/logic/citycycle';
import { useRecycling } from '@/store';
import { colors, fonts } from '@/theme/tokens';
import { isolateLtr, localDigits } from '@/utils/digits';
import { formatDateTime } from '@/utils/time';
import { DemoPricesNote } from './DemoPricesNote';
import { MaterialLines } from './MaterialParts';
import { PickupStatusChip } from './PickupStatusChip';

/** متابعة طلب التدوير: summary, materials, collector, the weighing to confirm, timeline. */
export function PickupDetail({ id }: { id: string }) {
  const tr = useTr();
  const pickup = useRecycling((s) => s.pickups.find((p) => p.id === id) ?? null);
  const listStatus = useRecycling((s) => s.status);
  const prices = useRecycling((s) => s.prices);
  const loadPrices = useRecycling((s) => s.loadPrices);
  const loadPickup = useRecycling((s) => s.loadPickup);
  const cancelPickup = useRecycling((s) => s.cancelPickup);
  const confirmPickup = useRecycling((s) => s.confirmPickup);

  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'missing' | 'error'>('idle');
  const [fetchTry, setFetchTry] = useState(0);
  const [busy, setBusy] = useState<'cancel' | 'confirm' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const listSettled = listStatus === 'ready' || listStatus === 'error';
  useEffect(() => {
    if (pickup || !listSettled) return;
    let cancelled = false;
    loadPickup(id)
      .then((found) => !cancelled && setFetchState(found ? 'idle' : 'missing'))
      .catch(() => !cancelled && setFetchState('error'));
    return () => {
      cancelled = true;
    };
  }, [pickup, listSettled, id, fetchTry, loadPickup]);

  const steps = useMemo(() => (pickup ? buildPickupSteps(pickup) : []),
    // The future-step labels are written when the steps are built: rebuild on a language switch (`tr` changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickup, tr]);

  const header = <ScreenHeader title={tr('متابعة طلب التدوير', 'Track your recycling pickup')} />;

  if (!pickup) {
    const failed = fetchState === 'error';
    const missing = fetchState === 'missing';
    return (
      <Screen header={header}>
        {missing ? (
          <StateMessage icon="search" title={tr('مش لاقيين الطلب ده', "We couldn't find this pickup")} body={tr('ممكن يكون اتمسح أو الرابط مش صح.', 'It may have been deleted, or the link is wrong.')} actionLabel={tr('طلباتي', 'My requests')} onAction={() => router.replace('/requests')} />
        ) : failed ? (
          <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل الطلب', "We couldn't load this pickup")} body={tr('اتأكد من النت وجرّب تاني', 'Check your connection and try again')} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => { setFetchState('loading'); setFetchTry((n) => n + 1); }} />
        ) : (
          <StateMessage loading title={tr('بنجيب التفاصيل…', 'Loading the details…')} />
        )}
      </Screen>
    );
  }

  return (
    <Screen header={header} gap={14} contentStyle={styles.content}>
      <Summary pickup={pickup} />
      <Estimate pickup={pickup} prices={prices} />
      <CollectorCard pickup={pickup} />
      {pickup.weighings.length > 0 ? <WeighingCard pickup={pickup} /> : null}

      {awaitingConfirmation(pickup) ? (
        <Card background={colors.goldSoft} rounded="lg" padding={16} style={styles.confirm} testID="pickup-confirm-card">
          <AppText variant="bodyStrong" color={colors.goldDeep}>{tr('الأرقام دي صح؟', 'Are these numbers right?')}</AppText>
          <AppText variant="small" color={colors.goldDeep}>
            {tr('راجع الوزن اللي الجامع سجّله. لما تأكّده بيتحسب في تأثيرك.', 'Check the weight the collector recorded. Once you confirm, it counts toward your impact.')}
          </AppText>
          <Button
            label={tr('أكّد الوزن', 'Confirm the weight')}
            icon="check"
            loading={busy === 'confirm'}
            onPress={async () => {
              setBusy('confirm');
              setActionError(null);
              try {
                await confirmPickup(pickup.id);
              } catch (e) {
                setActionError(e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
              } finally {
                setBusy(null);
              }
            }}
            testID="pickup-confirm"
          />
        </Card>
      ) : null}

      <TimelineCard title={tr('مراحل الطلب', 'Request progress')} steps={steps} />

      {actionError ? <AppText variant="caption" color={colors.urgent} center accessibilityLiveRegion="polite">{actionError}</AppText> : null}

      {canCancelPickup(pickup) ? (
        <Button
          label={tr('إلغاء الطلب', 'Cancel this pickup')}
          variant="secondary"
          loading={busy === 'cancel'}
          onPress={() =>
            confirmAction(tr('إلغاء الطلب', 'Cancel this pickup'), tr('الطلب هيتلغي ومحدش هيجي ياخد الخامات.', 'The pickup will be cancelled and nobody will come for the materials.'), tr('إلغاء الطلب', 'Cancel this pickup'), async () => {
              setBusy('cancel');
              setActionError(null);
              try {
                await cancelPickup(pickup.id);
              } catch (e) {
                setActionError(e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
              } finally {
                setBusy(null);
              }
            })
          }
          testID="pickup-cancel"
        />
      ) : null}
    </Screen>
  );
}

function Summary({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  const title = `${tr('جمع تدوير', 'Recycling pickup')} · ${materialsSummary(pickup.items, (n) => tr(`+${localDigits(n)}`, `+${n}`))}`;
  return (
    <Card rounded="lg" padding={16} style={styles.summary}>
      <View style={styles.summaryTop}>
        <RequestThumb size={72} icon="recycle" tone="service" />
        <View style={styles.summaryText}>
          <AppText style={styles.title}>{title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{`${isolateLtr(`#${pickup.id}`)} · ${tr('اتطلب', 'Requested')} ${formatDateTime(pickup.createdAt)}`}</AppText>
          <View style={styles.chip}><PickupStatusChip status={pickup.status} /></View>
        </View>
      </View>
      <InfoTiles
        tiles={[
          { label: tr('الميعاد', 'Scheduled'), value: `${dayText(pickup.day)} · ${slotLabel(pickup.slot)}` },
          { label: tr('الطريقة', 'How'), value: pickupModeLabel(pickup.mode) },
        ]}
      />
      <View style={styles.place}>
        <Icon name="pin" size={16} color={colors.inkMuted} />
        <AppText variant="small" color={colors.inkMuted} style={styles.flex}>
          {pickup.location.address}{pickup.location.landmark ? ` · ${pickup.location.landmark}` : ''}
        </AppText>
      </View>
    </Card>
  );
}

function Estimate({ pickup, prices }: { pickup: RecyclingPickup; prices: ReturnType<typeof useRecycling.getState>['prices'] }) {
  const tr = useTr();
  const est = pickup.estimatedValueEgp ?? estimateValue(pickup.items, prices).valueEgp;
  return (
    <Card rounded="lg" padding={16} style={styles.section}>
      <AppText style={styles.heading} accessibilityRole="header">{tr('الخامات', 'Materials')}</AppText>
      <MaterialLines items={pickup.items} prices={prices} />
      <View style={styles.sumRow}>
        <AppText variant="small" color={colors.inkMuted}>{tr('الوزن التقريبي', 'Estimated weight')}</AppText>
        <AppText variant="smallStrong">{formatKg(sumKg(pickup.items))}</AppText>
      </View>
      {pickup.mode === 'paid' ? (
        <View style={styles.sumRow}>
          <AppText variant="small" color={colors.inkMuted}>{tr('القيمة التقريبية', 'Estimated value')}</AppText>
          <AppText variant="smallStrong" testID="pickup-estimate">{est !== undefined ? formatEgp(est) : formatPrice(null)}</AppText>
        </View>
      ) : null}
      <DemoPricesNote />
    </Card>
  );
}

function CollectorCard({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  const name = collectorDisplayName(pickup);
  if (!name) return null;
  return (
    <Card rounded="lg" padding={16} style={styles.collector}>
      <View style={styles.badge}><Icon name="truck" size={22} color={colors.red} /></View>
      <View style={styles.flex}>
        <AppText variant="smallStrong">{tr(`الجامع: ${name}`, `Collector: ${name}`)}</AppText>
        <View style={styles.verified}>
          <Icon name="shield-check" size={14} color={colors.statusResolved} />
          <AppText variant="caption" color={colors.statusResolved}>{tr('جامع موثّق من الحي', 'Verified by the district')}</AppText>
        </View>
      </View>
    </Card>
  );
}

function WeighingCard({ pickup }: { pickup: RecyclingPickup }) {
  const tr = useTr();
  return (
    <Card rounded="lg" padding={16} style={styles.section} testID="pickup-weighings">
      <AppText style={styles.heading} accessibilityRole="header">{tr('الوزن الفعلي', 'Actual weight')}</AppText>
      {pickup.weighings.map((w) => (
        <View key={w.id} style={styles.sumRow}>
          <AppText variant="small" style={styles.flex}>{materialLabel(w.materialId)}</AppText>
          <AppText variant="smallStrong">{formatKg(w.kg)}{w.valueEgp !== null ? ` · ${formatEgp(w.valueEgp)}` : ` · ${formatPrice(null)}`}</AppText>
        </View>
      ))}
      <View style={[styles.sumRow, styles.total]}>
        <AppText variant="bodyStrong">{tr('الإجمالي', 'Total')}</AppText>
        <AppText variant="bodyStrong">
          {formatKg(pickup.totalKg ?? 0)}{pickup.mode === 'paid' && pickup.totalValueEgp !== undefined ? ` · ${formatEgp(pickup.totalValueEgp)}` : ''}
        </AppText>
      </View>
      {pickup.mode === 'paid' && pickup.paidToHouseholdEgp !== undefined ? (
        <AppText variant="small" color={colors.inkMuted}>
          {tr(`الجامع سجّل إنه دفع لك ${formatEgp(pickup.paidToHouseholdEgp)} كاش.`, `The collector recorded paying you ${formatEgp(pickup.paidToHouseholdEgp)} in cash.`)}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  flex: { flex: 1, minWidth: 0 },
  summary: { gap: 12 },
  summaryTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  summaryText: { flex: 1, minWidth: 0, gap: 4 },
  chip: { alignSelf: 'flex-start' },
  title: { fontFamily: fonts.display700, fontSize: 18, lineHeight: 26, color: colors.ink },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  section: { gap: 10 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  total: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  confirm: { gap: 10 },
  collector: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
