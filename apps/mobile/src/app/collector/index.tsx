import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { JobCard, MaterialGrid, PickupCard, QueueBanner } from '@/components/citycycle';
import { IncidentMap } from '@/components/map';
import { StateMessage } from '@/components/requests';
import { AppText, Button, Chip, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import { COLLECTOR_VEHICLES, DEFAULT_JOB_RADIUS_M, MATERIAL_IDS, collectorStatusLabel, type MaterialId } from '@/domain/citycycle';
import { findDistrict } from '@/domain/locations';
import { useTr } from '@/i18n';
import { API_MODE } from '@/services';
import { useCollector, useSession } from '@/store';
import { colors } from '@/theme/tokens';

/** Collector mode: apply, wait for verification, then find and work jobs. */
export default function CollectorHomeScreen() {
  const tr = useTr();
  const meStatus = useCollector((s) => s.meStatus);
  const collector = useCollector((s) => s.collector);
  const loadMe = useCollector((s) => s.loadMe);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  let body: React.ReactNode;
  if (meStatus === 'idle' || (meStatus === 'loading' && !collector)) body = <StateMessage loading title={tr('بنجيب بياناتك…', 'Loading…')} />;
  else if (meStatus === 'error' && !collector) body = <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل بياناتك', "We couldn't load your details")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void loadMe()} />;
  else if (!collector) body = <ApplyForm />;
  else if (collector.status === 'pending') body = <Pending />;
  else if (collector.status === 'suspended') body = <StateMessage icon="alert-triangle" title={tr('حسابك موقوف', 'Your account is suspended')} body={tr('كلّم مكتب الحي لو محتاج توضيح.', 'Contact the district office if you need to know why.')} />;
  else body = <Jobs />;

  return (
    <Screen header={<ScreenHeader title={tr('وضع الجامع', 'Collector mode')} />} gap={14} contentStyle={styles.content}>
      {body}
    </Screen>
  );
}

function ApplyForm() {
  const tr = useTr();
  const name0 = useSession((s) => s.name);
  const district = useSession((s) => s.district);
  const apply = useCollector((s) => s.apply);
  const [name, setName] = useState(name0 ?? '');
  const [materials, setMaterials] = useState<Set<MaterialId>>(new Set());
  const [vehicle, setVehicle] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (id: MaterialId) =>
    setMaterials((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const submit = async () => {
    if (name.trim().length < 2) return setError(tr('اكتب اسمك', 'Enter your name'));
    if (materials.size === 0) return setError(tr('اختار خامة واحدة على الأقل', 'Choose at least one material'));
    setError(null);
    setBusy(true);
    try {
      await apply({ name: name.trim(), district, materials: MATERIAL_IDS.filter((m) => materials.has(m)), vehicle });
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
      setBusy(false);
    }
  };
  return (
    <>
      <AppText variant="small" color={colors.inkMuted}>
        {tr('اشتغل جامع تدوير في حيّك. بعد مراجعة طلبك هتشوف الطلبات القريبة وتكسب من الوزن.', 'Work as a recycling collector in your district. Once your application is reviewed you can see nearby requests and earn from what you weigh.')}
      </AppText>
      <TextField label={tr('الاسم', 'Name')} value={name} onChangeText={setName} maxLength={40} testID="collector-name" />
      <AppText variant="smallStrong">{tr('بتجمع إيه؟', 'What do you collect?')}</AppText>
      <MaterialGrid materials={MATERIAL_IDS} selected={materials} prices={[]} onToggle={toggle} />
      <AppText variant="smallStrong">{tr('وسيلة النقل (اختياري)', 'Vehicle (optional)')}</AppText>
      <View style={styles.wrap}>
        {COLLECTOR_VEHICLES.map((v) => (
          <ChoiceChip key={v.id} label={tr(v.ar, v.en)} radio selected={vehicle === v.id} onPress={() => setVehicle(vehicle === v.id ? undefined : v.id)} testID={`vehicle-${v.id}`} />
        ))}
      </View>
      {error ? <AppText variant="caption" color={colors.urgent} accessibilityRole="alert">{error}</AppText> : null}
      <Button label={tr('قدّم الطلب', 'Apply')} onPress={submit} loading={busy} testID="collector-apply" />
    </>
  );
}

function Pending() {
  const tr = useTr();
  const simulateVerify = useCollector((s) => s.simulateVerify);
  const loadMe = useCollector((s) => s.loadMe);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <StateMessage icon="clock" title={collectorStatusLabel('pending')} body={tr('مكتب الحي بيراجع طلبك. هتقدر تشوف الطلبات أول ما يتفعّل.', 'The district office is reviewing your application. You can see requests as soon as it is approved.')} actionLabel={tr('حدّث', 'Refresh')} onAction={() => void loadMe()} />
      {API_MODE === 'mock' ? (
        <Button
          label={tr('(تجربة) اعتبرني موثّق', '(Demo) Mark me as verified')}
          variant="ghost"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await simulateVerify();
            } finally {
              setBusy(false);
            }
          }}
          testID="collector-verify"
        />
      ) : null}
    </>
  );
}

function Jobs() {
  const tr = useTr();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const jobs = useCollector((s) => s.jobs);
  const jobsStatus = useCollector((s) => s.jobsStatus);
  const jobsError = useCollector((s) => s.jobsError);
  const mine = useCollector((s) => s.mine);
  const refreshJobs = useCollector((s) => s.refreshJobs);
  const refreshMine = useCollector((s) => s.refreshMine);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [refreshing, setRefreshing] = useState(false);
  const center = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: 30.056, lng: 31.33 };
  }, [governorate, district]);

  const load = useCallback(async () => {
    await Promise.all([refreshJobs(center, DEFAULT_JOB_RADIUS_M), refreshMine()]);
  }, [refreshJobs, refreshMine, center]);
  useEffect(() => {
    void load();
  }, [load]);

  const active = mine.filter((p) => p.status === 'accepted' || p.status === 'weighed');
  const markers = useMemo(() => jobs.map((j) => ({ id: j.id, lat: j.location.lat, lng: j.location.lng, color: colors.red, icon: 'recycle' as const, label: j.location.address })), [jobs]);

  return (
    <View style={styles.gap} testID="collector-jobs">
      <QueueBanner />
      <Button label={tr('أرباحي', 'My earnings')} variant="secondary" icon="coins" onPress={() => router.push('/collector/earnings')} testID="open-earnings" />
      <View style={styles.wrap} accessibilityRole="tablist">
        <Chip label={tr('طلبات قريبة', 'Nearby requests')} selected={tab === 'open'} onPress={() => setTab('open')} testID="tab-open" />
        <Chip label={`${tr('شغلي', 'My jobs')}${active.length ? ` (${active.length})` : ''}`} selected={tab === 'mine'} onPress={() => setTab('mine')} testID="tab-mine" />
      </View>
      {tab === 'open' ? (
        <>
          {markers.length > 0 ? <IncidentMap pins={[]} markers={markers} center={center} onSelectMarker={(id) => router.push(`/collector/job/${id}`)} style={styles.map} /> : null}
          {jobsStatus === 'loading' && jobs.length === 0 ? <StateMessage loading title={tr('بندوّر على طلبات…', 'Looking for requests…')} /> : null}
          {jobsStatus === 'error' && jobs.length === 0 ? <StateMessage tone="error" icon="wifi" title={jobsError ?? tr('مقدرناش نحمّل الطلبات', "We couldn't load requests")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void load()} /> : null}
          {jobsStatus === 'ready' && jobs.length === 0 ? <StateMessage icon="check" title={tr('مفيش طلبات قريبة دلوقتي', 'No requests nearby right now')} body={tr('اسحب لتحت وجرّب تاني بعد شوية.', 'Try again in a little while.')} actionLabel={tr('حدّث', 'Refresh')} onAction={() => void load()} /> : null}
          {jobs.map((j) => <JobCard key={j.id} job={j} onPress={() => router.push(`/collector/job/${j.id}`)} />)}
        </>
      ) : mine.length === 0 ? (
        <StateMessage icon="clipboard" title={tr('لسه مقبلتش طلبات', 'You have not accepted any requests')} />
      ) : (
        mine.map((p) => <PickupCard key={p.id} pickup={p} />)
      )}
      <Button label={tr('حدّث القائمة', 'Refresh list')} variant="ghost" size="sm" loading={refreshing} onPress={async () => { setRefreshing(true); try { await load(); } finally { setRefreshing(false); } }} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 32 },
  gap: { gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  map: { height: 220, borderRadius: 12, overflow: 'hidden' },
});
