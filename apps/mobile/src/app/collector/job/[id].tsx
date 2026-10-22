import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  DemoTag,
  EGP_PAD,
  ItemsRow,
  KG_PAD,
  MaterialPill,
  ModeChip,
  NumberPad,
  SIM_SCALE_ID,
  WaitingBanner,
  flushCollectorQueue,
  mergeWeighings,
  navigationUrl,
  netEarningsEgp,
  parseAmount,
  paymentInput,
  paymentPrefill,
  pendingCompleteOf,
  pendingWeighingsOf,
  simulatedScaleKg,
  submitComplete,
  submitWeighing,
  useAcceptJob,
  useCollectorQueue,
  useActorId,
  useDemoPrices,
  useModeText,
  usePriceList,
  weighingTotals,
  whenLabel,
} from '@/components/collector';
import { Icon } from '@/components/Icon';
import { AppText, Button, Card, InlineNotice, Screen, ScreenHeader } from '@/components/ui';
import type { MaterialId, RecyclingPickup, WeighingSource } from '@/domain/citycycle';
import { MATERIAL_IDS, priceOf, roundEgp } from '@/domain/materials';
import { materialLabel, priceToBeSetLabel, useTr, weighingSourceLabel } from '@/i18n';
import { API_MODE } from '@/services';
import { useCollector } from '@/store/useCollector';
import { colors, radius } from '@/theme/tokens';
import { formatEgp, formatEgpPerKg, formatKg } from '@/utils/money';
import { localDigits } from '@/utils/digits';

type Stage = 'route' | 'weigh' | 'pay';

/**
 * One job from accept to done: (1) the way there ("on my way" + open the maps app), (2) weigh each material,
 * (3) confirm the cash paid to the household, then the done screen. Weighing and finishing work offline: they are
 * saved on the phone and sent when the internet returns ("مستني النت").
 */
export default function CollectorJobScreen() {
  const tr = useTr();
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useCollector((s) => s.status);
  const mine = useCollector((s) => s.myJobs.find((p) => p.id === id) ?? null);
  const open = useCollector((s) => s.jobs.find((j) => j.id === id) ?? null);
  const [loaded, setLoaded] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (mine || open || asked.current) return;
    asked.current = true;
    void useCollector.getState().refresh().finally(() => setLoaded(true));
  }, [mine, open]);

  const header = <ScreenHeader title={tr('تفاصيل الشغل', 'Job details')} action={<ModeChip />} onBack={() => (router.canGoBack() ? router.back() : router.replace('/collector'))} />;

  if (mine) return <JobFlow job={mine} header={header} />;
  if (open) return <OpenJobPreview jobId={open.id} header={header} />;
  return (
    <Screen header={header} edges={['top', 'bottom']} contentStyle={styles.center}>
      <AppText color={colors.inkMuted} center accessibilityLiveRegion="polite">
        {loaded || status === 'error' ? tr('مش لاقيين الشغل ده. يمكن حد تاني أخده.', "We couldn't find this job. Someone else may have taken it.") : tr('بنحمّل...', 'Loading...')}
      </AppText>
      {loaded ? <Button label={tr('ارجع للشغل', 'Back to jobs')} variant="secondary" onPress={() => router.dismissTo('/collector')} /> : null}
    </Screen>
  );
}

/** A job opened by link before it was accepted: the card with the accept button (approximate pin only). */
function OpenJobPreview({ jobId, header }: { jobId: string; header: React.ReactNode }) {
  const tr = useTr();
  const job = useCollector((s) => s.jobs.find((j) => j.id === jobId));
  const { accept, acceptingId, notice } = useAcceptJob();
  const modeText = useModeText();
  if (!job) return null;
  return (
    <Screen header={header} gap={14} contentStyle={styles.content}>
      {notice ? <InlineNotice text={notice} /> : null}
      <Card rounded="lg" padding={16} style={styles.gap}>
        <ItemsRow items={job.items} />
        <AppText variant="small">{tr('تقريبًا', 'About')} {formatKg(job.estimatedKg)}{tr('، ', ', ')}{whenLabel(job)}</AppText>
        <AppText variant="small" color={colors.inkMuted}>{modeText(job.mode)}</AppText>
        <AppText variant="caption" color={colors.goldDeep}>{tr('العنوان بالظبط بيظهر بعد ما تقبل.', 'The exact address shows after you accept.')}</AppText>
      </Card>
      <Button label={tr('اقبل الشغل', 'Accept job')} icon="check" loading={acceptingId === job.id} onPress={() => void accept(job.id)} style={styles.big} testID="accept-job" />
    </Screen>
  );
}

function JobFlow({ job, header }: { job: RecyclingPickup; header: React.ReactNode }) {
  const tr = useTr();
  const userId = useActorId();
  const queue = useCollectorQueue((s) => s.items);
  const prices = usePriceList();
  const demo = useDemoPrices();
  const modeText = useModeText();

  const pendingW = useMemo(() => pendingWeighingsOf(queue, userId, job.id), [queue, userId, job.id]);
  const pendingComplete = pendingCompleteOf(queue, userId, job.id);
  const weighings = useMemo(() => mergeWeighings(job.weighings, pendingW, prices, job.id), [job.weighings, pendingW, prices, job.id]);
  const totals = useMemo(() => weighingTotals(weighings), [weighings]);

  const [stageOverride, setStage] = useState<Stage | null>(null);
  const derived: Stage = weighings.length > 0 ? 'weigh' : 'route';
  const stage: Stage = stageOverride ?? derived;
  const done = job.status === 'completed' || !!pendingComplete;

  if (done) return <DoneView job={job} totalKg={totals.totalKg} totalValue={totals.valueEgp} waiting={!!pendingComplete} header={header} />;

  return (
    <Screen header={header} gap={14} contentStyle={styles.content} testID={`job-flow-${stage}`}>
      <WaitingBanner />
      <Steps stage={stage} />
      <Card rounded="lg" padding={14} style={styles.gap}>
        <AppText variant="bodyStrong">{job.location.address}</AppText>
        {job.location.landmark ? <AppText variant="small" color={colors.inkMuted}>{job.location.landmark}</AppText> : null}
        <ItemsRow items={job.items} />
        <AppText variant="small">{whenLabel(job)}{tr('، ', ', ')}{modeText(job.mode)}</AppText>
        {job.note ? <AppText variant="small" color={colors.inkMuted}>{tr('ملاحظة', 'Note')}: {job.note}</AppText> : null}
      </Card>

      {stage === 'route' ? <RouteStage job={job} onArrive={() => setStage('weigh')} /> : null}
      {stage === 'weigh' ? (
        <WeighStage job={job} weighings={weighings} totals={totals} demo={demo} onBack={() => setStage('route')} onNext={() => setStage('pay')} />
      ) : null}
      {stage === 'pay' ? <PayStage job={job} totals={totals} demo={demo} onBack={() => setStage('weigh')} /> : null}
    </Screen>
  );
}

function Steps({ stage }: { stage: Stage }) {
  const tr = useTr();
  const order: Stage[] = ['route', 'weigh', 'pay'];
  const labels: Record<Stage, string> = { route: tr('الطريق', 'Go'), weigh: tr('الوزن', 'Weigh'), pay: tr('الدفع', 'Pay') };
  return (
    <View style={styles.steps} accessibilityRole="progressbar" accessibilityLabel={tr(`خطوة ${localDigits(order.indexOf(stage) + 1)} من ${localDigits(3)}`, `Step ${order.indexOf(stage) + 1} of 3`)}>
      {order.map((s, i) => {
        const on = s === stage;
        const past = i < order.indexOf(stage);
        return (
          <View key={s} style={[styles.step, on ? styles.stepOn : past ? styles.stepPast : null]}>
            <AppText variant="smallStrong" color={on ? colors.ink : colors.inkMuted}>{`${localDigits(i + 1)}. ${labels[s]}`}</AppText>
          </View>
        );
      })}
    </View>
  );
}

// ---- 1. The way there ----

function RouteStage({ job, onArrive }: { job: RecyclingPickup; onArrive: () => void }) {
  const tr = useTr();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = !!job.startedAt;

  const openMaps = () => {
    const url = navigationUrl(Platform.OS, job.location.lat, job.location.lng, job.location.address);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
      return;
    }
    Linking.openURL(url).catch(() => setErr(tr('مقدرناش نفتح الخرايط. افتحها بإيدك وابحث عن العنوان.', "We couldn't open the maps app. Open it yourself and search for the address.")));
  };

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (!started) await useCollector.getState().start(job.id);
      openMaps();
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      {err ? <InlineNotice text={err} /> : null}
      <Button
        label={started ? tr('افتح الخرايط تاني', 'Open maps again') : tr('أنا في الطريق', 'On my way')}
        icon="navigation"
        loading={busy}
        onPress={() => void start()}
        style={styles.big}
        testID="on-my-way"
      />
      {started ? <AppText variant="caption" color={colors.statusResolved} accessibilityLiveRegion="polite">{tr('الأسرة شافت إنك في الطريق.', 'The household can see that you are on the way.')}</AppText> : null}
      <Button label={tr('وصلت، ابدأ الوزن', "I'm here, start weighing")} variant="gold" icon="scale" onPress={onArrive} style={styles.big} testID="start-weighing" />
    </View>
  );
}

// ---- 2. Weigh ----

type Totals = ReturnType<typeof weighingTotals>;

function WeighStage({ job, weighings, totals, demo, onBack, onNext }: { job: RecyclingPickup; weighings: ReturnType<typeof mergeWeighings>; totals: Totals; demo: boolean; onBack: () => void; onNext: () => void }) {
  const tr = useTr();
  const prices = usePriceList();
  const requested = useMemo(() => job.items.map((i) => i.materialId), [job.items]);
  const order = useMemo(() => [...requested, ...MATERIAL_IDS.filter((m) => !requested.includes(m))], [requested]);
  const weighed = useMemo(() => new Set(weighings.map((w) => w.materialId)), [weighings]);
  const [material, setMaterial] = useState<MaterialId>(() => requested.find((m) => !weighed.has(m)) ?? requested[0]);
  const [draft, setDraft] = useState('');
  const [source, setSource] = useState<WeighingSource>('manual');
  const [reads, setReads] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const estimate = job.items.find((i) => i.materialId === material)?.estimatedKg ?? 0;
  const kg = parseAmount(draft);
  const price = priceOf(prices, material);

  const add = async () => {
    if (kg <= 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await submitWeighing(job.id, { materialId: material, kg, source, ...(source === 'scale_ble' ? { scaleId: SIM_SCALE_ID } : {}) });
      setDraft('');
      setSource('manual');
      const next = requested.find((m) => m !== material && !weighed.has(m));
      if (next) setMaterial(next);
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <AppText variant="h3" accessibilityRole="header">{tr('اختار الخامة ووزّنها', 'Pick a material and weigh it')}</AppText>
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {order.map((m) => (
          <Pressable
            key={m}
            testID={`mat-${m}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: m === material }}
            accessibilityLabel={`${materialLabel(m)}${weighed.has(m) ? `, ${tr('اتوزن', 'weighed')}` : ''}`}
            onPress={() => {
              setMaterial(m);
              setDraft('');
              setSource('manual');
            }}
          >
            <MaterialPill materialId={m} tone={m === material ? 'selected' : 'plain'} />
            {weighed.has(m) ? <View style={styles.tick}><Icon name="check" size={12} color={colors.onRed} strokeWidth={3} /></View> : null}
          </Pressable>
        ))}
      </View>
      <AppText variant="small" color={colors.inkMuted}>
        {estimate > 0 ? tr(`الأسرة قالت تقريبًا ${formatKg(estimate)}. `, `The household estimated about ${formatKg(estimate)}. `) : ''}
        {price === null ? priceToBeSetLabel() : price !== undefined ? formatEgpPerKg(price) : ''}
      </AppText>

      {API_MODE === 'mock' ? (
        <View style={styles.gap}>
          <Button
            label={tr('اقرا من ميزان المركز', 'Read from hub scale')}
            variant="secondary"
            icon="scale"
            onPress={() => {
              setDraft(String(simulatedScaleKg(estimate, reads)));
              setSource('scale_ble');
              setReads((n) => n + 1);
            }}
            testID="hub-scale"
          />
          <View style={styles.simBox}>
            <AppText variant="caption" color={colors.goldDeep} testID="sim-label">
              {source === 'scale_ble'
                ? tr('قراءة تجريبية (محاكاة) من ميزان المركز عبر بلوتوث. مش ميزان حقيقي.', 'Simulated reading from the hub scale over Bluetooth. Not a real scale.')
                : tr('محاكاة: في النسخة التجريبية الميزان بيدّي رقم تقريبي.', 'Simulated: in the demo the scale gives a made-up number.')}
            </AppText>
          </View>
        </View>
      ) : null}

      <NumberPad
        value={draft}
        onChange={(t) => {
          setDraft(t);
          setSource('manual');
        }}
        unit={tr('كجم', 'kg')}
        options={KG_PAD}
        step={0.5}
        label={tr('الوزن بالكيلو', 'Weight in kg')}
        testID="kg-pad"
      />

      {err ? <InlineNotice text={err} /> : null}
      <Button
        label={source === 'scale_ble' ? tr(`أضف الوزن (${weighingSourceLabel(source)})`, `Add weight (${weighingSourceLabel(source)})`) : tr('أضف الوزن', 'Add weight')}
        icon="plus"
        disabled={kg <= 0}
        loading={busy}
        onPress={() => void add()}
        style={styles.big}
        testID="add-weighing"
      />
      <AppText variant="caption" color={colors.inkMuted}>{tr('الوزن بعد ما تضيفه مبيتعدلش. راجع الرقم قبل ما تضغط.', "A weight can't be changed once added. Check the number before you tap.")}</AppText>

      <Card rounded="lg" padding={14} style={styles.gap} testID="weighing-list">
        <AppText variant="bodyStrong" accessibilityRole="header">{tr('اللي اتوزن', 'Weighed so far')}</AppText>
        {weighings.length === 0 ? <AppText variant="small" color={colors.inkMuted}>{tr('لسه مفيش وزن.', 'Nothing weighed yet.')}</AppText> : null}
        {weighings.map((w) => (
          <View key={w.clientId} style={styles.wRow} testID={`weighing-${w.materialId}`}>
            <View style={styles.flex}>
              <AppText variant="smallStrong">{materialLabel(w.materialId)}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>
                {w.pending ? tr('مستني النت', 'Waiting for internet') : weighingSourceLabel(w.source)}
              </AppText>
            </View>
            <View style={styles.end}>
              <AppText variant="smallStrong">{formatKg(w.kg)}</AppText>
              <AppText variant="caption" color={colors.inkMuted}>{w.valueEgp === null ? priceToBeSetLabel() : formatEgp(w.valueEgp)}</AppText>
            </View>
          </View>
        ))}
        <View style={styles.sep} />
        <View style={styles.wRow}>
          <AppText variant="bodyStrong" style={styles.flex}>{tr('الإجمالي', 'Total')}</AppText>
          <View style={styles.end}>
            <AppText variant="bodyStrong" testID="total-kg">{formatKg(totals.totalKg)}</AppText>
            <AppText variant="smallStrong" testID="total-value">{formatEgp(totals.valueEgp)}{totals.hasUnpriced ? '+' : ''}</AppText>
          </View>
        </View>
        {totals.hasUnpriced ? <AppText variant="caption" color={colors.goldDeep}>{tr('فيه خامة سعرها لسه هيتحدد، فالقيمة دي على الأقل.', 'A material has no price yet, so this value is a minimum.')}</AppText> : null}
        {demo ? <DemoTag /> : null}
      </Card>

      <Button label={tr('خلّصت الوزن', 'Done weighing')} variant="gold" icon="arrow-forward" iconPosition="end" disabled={weighings.length === 0} onPress={onNext} style={styles.big} testID="done-weighing" />
      <Button label={tr('رجوع', 'Back')} variant="ghost" onPress={onBack} />
    </View>
  );
}

// ---- 3. Pay and finish ----

function PayStage({ job, totals, demo, onBack }: { job: RecyclingPickup; totals: Totals; demo: boolean; onBack: () => void }) {
  const tr = useTr();
  const modeText = useModeText();
  const [text, setText] = useState(() => paymentPrefill(job.mode, totals.valueEgp));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const paid = roundEgp(parseAmount(text));

  const finish = async () => {
    setBusy(true);
    setErr(null);
    try {
      await submitComplete(job.id, paymentInput(text));
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <Card rounded="lg" padding={14} style={styles.gap}>
        <View style={styles.wRow}>
          <AppText variant="small" style={styles.flex}>{tr('اللي اتوزن', 'Weighed')}</AppText>
          <AppText variant="smallStrong">{formatKg(totals.totalKg)}</AppText>
        </View>
        <View style={styles.wRow}>
          <AppText variant="small" style={styles.flex}>{tr('القيمة بالأسعار', 'Value at the price list')}</AppText>
          <AppText variant="smallStrong">{formatEgp(totals.valueEgp)}</AppText>
        </View>
        {demo ? <DemoTag /> : null}
        <AppText variant="small" color={colors.inkMuted}>{modeText(job.mode)}</AppText>
      </Card>

      <AppText variant="h3" accessibilityRole="header">{job.mode === 'paid' ? tr('كام دفعت للأسرة؟', 'How much did you pay the household?') : tr('دفعت حاجة للأسرة؟', 'Did you pay the household anything?')}</AppText>
      <NumberPad value={text} onChange={setText} unit={tr('جنيه', 'EGP')} options={EGP_PAD} step={5} label={tr('المبلغ المدفوع بالجنيه', 'Amount paid in EGP')} testID="egp-pad" />
      <AppText variant="caption" color={colors.inkMuted}>
        {tr('ده تسجيل بس للكاش اللي دفعته بإيدك. التطبيق مش بيحوّل فلوس.', 'This only records the cash you handed over. The app does not move money.')}
      </AppText>
      {err ? <InlineNotice text={err} /> : null}
      <Button
        label={paid > 0 ? tr(`تأكيد ودفعت ${formatEgp(paid)}`, `Confirm, paid ${formatEgp(paid)}`) : tr('تأكيد وإنهاء الشغل', 'Confirm and finish')}
        icon="check"
        loading={busy}
        onPress={() => void finish()}
        style={styles.big}
        testID="confirm-complete"
      />
      <Button label={tr('رجوع للوزن', 'Back to weighing')} variant="ghost" onPress={onBack} />
    </View>
  );
}

// ---- Done ----

function DoneView({ job, totalKg, totalValue, waiting, header }: { job: RecyclingPickup; totalKg: number; totalValue: number; waiting: boolean; header: React.ReactNode }) {
  const tr = useTr();
  const queue = useCollectorQueue((s) => s.items);
  const userId = useActorId();
  const paid = waiting ? (pendingCompleteOf(queue, userId, job.id)?.input.paidToHouseholdEgp ?? 0) : (job.paidToHouseholdEgp ?? 0);
  const net = netEarningsEgp({ valueEgp: totalValue, paidToHouseholdsEgp: paid });
  return (
    <Screen header={header} gap={14} contentStyle={styles.content} testID="job-done">
      <View style={styles.doneHero}>
        <View style={[styles.doneIcon, waiting ? { backgroundColor: colors.goldSoft } : null]}>
          <Icon name={waiting ? 'wifi' : 'check'} size={40} color={waiting ? colors.goldDeep : colors.statusResolved} strokeWidth={3} />
        </View>
        <AppText variant="h2" center accessibilityRole="header">{waiting ? tr('مستني النت', 'Waiting for internet') : tr('الشغل خلص، تسلم إيدك', 'Job done. Thank you for your work')}</AppText>
        <AppText variant="small" color={colors.inkMuted} center accessibilityLiveRegion="polite">
          {waiting ? tr('الشغل محفوظ على موبايلك وهيتبعت لوحده لما النت يرجع.', 'The job is saved on your phone and will be sent when the internet is back.') : tr('اتسجّل الوزن والمبلغ.', 'The weight and the payment were recorded.')}
        </AppText>
      </View>
      <Card rounded="lg" padding={16} style={styles.gap}>
        <Line label={tr('الوزن', 'Weight')} value={formatKg(totalKg)} testID="done-kg" />
        <Line label={tr('قيمة الخامات', 'Value of materials')} value={formatEgp(totalValue)} />
        <Line label={tr('اتدفع للأسرة', 'Paid to the household')} value={formatEgp(paid)} testID="done-paid" />
        <View style={styles.sep} />
        <Line label={tr('الصافي', 'Net')} value={formatEgp(net)} strong />
      </Card>
      {waiting ? <Button label={tr('جرّب ابعت دلوقتي', 'Try sending now')} variant="gold" icon="refresh" onPress={() => void flushCollectorQueue()} style={styles.big} testID="retry-now" /> : null}
      <Button label={tr('ارجع للشغل', 'Back to jobs')} icon="truck" onPress={() => router.dismissTo('/collector')} style={styles.big} testID="back-to-jobs" />
      <Button label={tr('شوف الأرباح', 'See earnings')} variant="secondary" icon="banknote" onPress={() => router.dismissTo('/collector/earnings')} />
    </Screen>
  );
}

function Line({ label, value, strong, testID }: { label: string; value: string; strong?: boolean; testID?: string }) {
  return (
    <View style={styles.wRow}>
      <AppText variant={strong ? 'bodyStrong' : 'small'} style={styles.flex}>{label}</AppText>
      <AppText variant={strong ? 'bodyStrong' : 'smallStrong'} testID={testID}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, flexGrow: 1 },
  gap: { gap: 10 },
  flex: { flex: 1 },
  big: { minHeight: 60 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  end: { alignItems: 'flex-end' },
  wRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sep: { height: 1, backgroundColor: colors.line },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  stepOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  stepPast: { backgroundColor: colors.paper },
  tick: { position: 'absolute', top: -4, end: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.statusResolved, alignItems: 'center', justifyContent: 'center' },
  simBox: { backgroundColor: colors.goldSoft, borderRadius: radius.sm, padding: 8 },
  doneHero: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.statusResolvedBg, alignItems: 'center', justifyContent: 'center' },
});
