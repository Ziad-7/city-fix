import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { MaterialBadge, MaterialLines, PickupStatusChip, QueueBanner } from '@/components/citycycle';
import { StateMessage } from '@/components/requests';
import { dayText, slotLabel } from '@/components/requests/labels';
import { AppText, Button, Card, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import {
  MATERIAL_IDS,
  MAX_KG,
  MIN_KG,
  formatEgp,
  formatKg,
  materialLabel,
  parseKg,
  pickupModeLabel,
  weighingTotals,
  type MaterialId,
} from '@/domain/citycycle';
import { useTr } from '@/i18n';
import { useCollector, useCollectorQueue } from '@/store';
import { queuedFor } from '@/store/collectorQueue';
import { colors, fonts } from '@/theme/tokens';
import { formatDistance } from '@/utils/geo';

/** One job for a collector: the open request before accepting; after accepting, the exact pin, weighing and finishing. */
export default function CollectorJobScreen() {
  const tr = useTr();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useCollector((s) => s.jobs.find((j) => j.id === id) ?? null);
  const pickup = useCollector((s) => s.mine.find((p) => p.id === id) ?? null);
  const accept = useCollector((s) => s.accept);
  const weigh = useCollector((s) => s.weigh);
  const complete = useCollector((s) => s.complete);
  const queueItems = useCollectorQueue((s) => s.items);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [material, setMaterial] = useState<MaterialId | null>(null);
  const [kgText, setKgText] = useState('');
  const [paidText, setPaidText] = useState('');

  const run = async (key: string, fn: () => Promise<'done' | 'queued'>, after?: () => void) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const r = await fn();
      if (r === 'queued') setNotice(tr('اتحفظ على موبايلك وهيتبعت أول ما النت يرجع.', 'Saved on your phone. It will be sent when the internet is back.'));
      after?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(null);
    }
  };

  const header = <ScreenHeader title={id ? `#${id}` : tr('طلب', 'Request')} />;

  if (!pickup && !job) {
    return (
      <Screen header={header}>
        <StateMessage icon="search" title={tr('الطلب مش موجود', 'Request not found')} body={tr('يمكن حد تاني قبله. ارجع للقائمة وحدّثها.', 'Someone else may have taken it. Go back and refresh the list.')} actionLabel={tr('رجوع', 'Back')} onAction={() => router.back()} />
      </Screen>
    );
  }

  // ---- Not accepted yet ----
  if (!pickup && job) {
    return (
      <Screen header={header} gap={14} contentStyle={styles.content}>
        <QueueBanner />
        <Card padding={14} style={styles.gap} testID="job-info">
          <MaterialLines items={job.items} />
          <Row icon="map" text={`${job.location.address}${job.location.landmark ? ` · ${job.location.landmark}` : ''}`} />
          {job.distanceM !== undefined ? <Row icon="locate" text={formatDistance(job.distanceM)} /> : null}
          <Row icon="clock" text={`${dayText(job.day)} · ${slotLabel(job.slot)}`} />
          <Row icon="coins" text={pickupModeLabel(job.mode)} />
          {job.note ? <Row icon="info" text={job.note} /> : null}
        </Card>
        <AppText variant="caption" color={colors.inkMuted}>{tr('الموقع بالظبط بيظهر بعد ما تقبل.', 'The exact location appears once you accept.')}</AppText>
        {error ? <AppText variant="caption" color={colors.urgent} accessibilityRole="alert">{error}</AppText> : null}
        {notice ? <AppText variant="caption" color={colors.goldDeep}>{notice}</AppText> : null}
        <Button label={tr('اقبل الطلب', 'Accept this request')} loading={busy === 'accept'} onPress={() => run('accept', () => accept(job))} testID="job-accept" />
      </Screen>
    );
  }

  const p = pickup!;
  const active = (p.status === 'accepted' || p.status === 'weighed') && !p.collectorFinishedAt;
  const acceptQueued = queuedFor(queueItems, p.id).some((q) => q.action.kind === 'accept');
  const totals = weighingTotals(p.weighings);
  const kg = parseKg(kgText);
  const kgValid = Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
  const paid = paidText.trim() === '' ? undefined : parseKg(paidText);
  const openMaps = () => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`).catch(() => undefined);

  const addWeighing = () => {
    if (!material || !kgValid) return;
    void run('weigh', () => weigh(p.id, { materialId: material, kg, source: 'manual' }), () => {
      setKgText('');
    });
  };

  return (
    <Screen header={header} gap={14} contentStyle={styles.content} avoidKeyboard>
      <QueueBanner />
      <View style={styles.row}>
        <PickupStatusChip status={p.status} />
        <AppText variant="caption" color={colors.inkMuted}>{pickupModeLabel(p.mode)}</AppText>
      </View>

      <Card padding={14} style={styles.gap} testID="job-accepted-info">
        <MaterialLines items={p.items} />
        <Row icon="map" text={`${p.location.address}${p.location.landmark ? ` · ${p.location.landmark}` : ''}`} />
        <Row icon="clock" text={`${dayText(p.day)} · ${slotLabel(p.slot)}`} />
        {p.note ? <Row icon="info" text={p.note} /> : null}
        {acceptQueued ? (
          <AppText variant="caption" color={colors.goldDeep}>{tr('الموقع بالظبط هيظهر أول ما الطلب يتبعت.', 'The exact location appears once your acceptance is sent.')}</AppText>
        ) : (
          <Button label={tr('افتح في الخرائط', 'Open in Maps')} icon="locate" variant="secondary" size="sm" onPress={openMaps} testID="job-open-maps" />
        )}
      </Card>

      {active ? (
        <Card padding={14} style={styles.gap}>
          <AppText style={styles.heading} accessibilityRole="header">{tr('وزّن الخامات', 'Weigh the materials')}</AppText>
          <View style={styles.wrap}>
            {MATERIAL_IDS.map((m) => (
              <ChoiceChip key={m} label={materialLabel(m)} selected={material === m} onPress={() => setMaterial(m)} testID={`weigh-material-${m}`} />
            ))}
          </View>
          <TextField label={tr('الوزن بالكيلو', 'Weight in kg')} value={kgText} onChangeText={setKgText} keyboardType="decimal-pad" placeholder="2.5" testID="weigh-kg" error={kgText !== '' && !kgValid ? tr(`من ${MIN_KG} لـ ${MAX_KG} كجم`, `Between ${MIN_KG} and ${MAX_KG} kg`) : undefined} />
          <Button label={tr('سجّل الوزن', 'Add weighing')} onPress={addWeighing} disabled={!material || !kgValid} loading={busy === 'weigh'} testID="weigh-add" />
          <View style={styles.row} testID="ble-scale-row">
            <Icon name="scale" size={18} color={colors.inkMuted} />
            <AppText variant="caption" color={colors.inkMuted} style={styles.flex}>{tr('الربط بميزان بلوتوث قريبًا. دلوقتي اكتب الوزن بإيدك.', 'Bluetooth scale support is coming soon. For now, type the weight.')}</AppText>
          </View>
        </Card>
      ) : null}

      {p.weighings.length > 0 ? (
        <Card padding={14} style={styles.gap} testID="weighings">
          <AppText style={styles.heading} accessibilityRole="header">{tr('الأوزان المسجّلة', 'Recorded weights')}</AppText>
          {p.weighings.map((w) => (
            <View key={w.clientId} style={styles.row}>
              <MaterialBadge id={w.materialId} size={28} />
              <AppText variant="small" style={styles.flex}>{materialLabel(w.materialId)}</AppText>
              <AppText variant="smallStrong">{formatKg(w.kg)}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{w.valueEgp !== null ? formatEgp(w.valueEgp) : tr('السعر هيتحدد', 'Price to be set')}</AppText>
            </View>
          ))}
          <AppText variant="smallStrong">{tr('الإجمالي', 'Total')}: {formatKg(totals.totalKg)}{!totals.hasUnpriced ? ` · ${formatEgp(totals.totalValueEgp)}` : ''}</AppText>
        </Card>
      ) : null}

      {active && p.weighings.length > 0 ? (
        <Card padding={14} style={styles.gap}>
          <AppText style={styles.heading} accessibilityRole="header">{tr('خلّصت؟', 'Finished?')}</AppText>
          {p.mode === 'paid' ? (
            <TextField label={tr('المبلغ اللي دفعته لصاحب الطلب (جنيه)', 'Amount you paid the household (EGP)')} value={paidText} onChangeText={setPaidText} keyboardType="decimal-pad" testID="complete-paid" error={paid !== undefined && !Number.isFinite(paid) ? tr('اكتب رقم', 'Enter a number') : undefined} />
          ) : null}
          <Button label={tr('خلّصت الطلب', 'Finish the request')} loading={busy === 'complete'} disabled={paid !== undefined && !Number.isFinite(paid)} onPress={() => run('complete', () => complete(p.id, paid))} testID="job-complete" />
          <AppText variant="caption" color={colors.inkMuted}>{tr('صاحب الطلب هيأكّد الأوزان بعد كده.', 'The household then confirms the weights.')}</AppText>
        </Card>
      ) : null}

      {error ? <AppText variant="caption" color={colors.urgent} accessibilityRole="alert">{error}</AppText> : null}
      {notice ? <AppText variant="caption" color={colors.goldDeep} accessibilityLiveRegion="polite">{notice}</AppText> : null}
    </Screen>
  );
}

function Row({ icon, text }: { icon: 'map' | 'locate' | 'clock' | 'coins' | 'info'; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={colors.inkMuted} />
      <AppText variant="small" style={styles.flex}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  gap: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, color: colors.ink },
});
