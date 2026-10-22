import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { EmergencyRow } from '@/components';
import { Icon } from '@/components/Icon';
import { BinStateChip, FillGauge, tempText, voltText } from '@/components/bins';
import { pickFromGallery, takePhoto } from '@/components/report/photo';
import { InfoTiles, StateMessage } from '@/components/requests';
import { AppText, Button, Card, InlineNotice, Screen, ScreenHeader, TextField } from '@/components/ui';
import { binTitle, cooldownHours, fillPercent, reportCooldownMs } from '@/domain/bin-map';
import { BIN_THRESHOLDS, binDisplayState, isBinAlert } from '@/domain/bins';
import { binKindLabel, useTr } from '@/i18n';
import { useBinReports } from '@/store/useBinReports';
import { useCityCycle } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';
import { relativeTime } from '@/utils/time';

/** Smart-bin detail: fill gauge, state, temperature, battery, last reading, and the "bin is full" report. */
export default function BinDetailScreen() {
  const tr = useTr();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bins = useCityCycle((s) => s.bins);
  const status = useCityCycle((s) => s.status);
  const refreshBins = useCityCycle((s) => s.refreshBins);
  const reportFullBin = useCityCycle((s) => s.reportFullBin);
  const lastReportedAt = useBinReports((s) => (id ? s.lastReportedAt[id] : undefined));
  const markReported = useBinReports((s) => s.markReported);

  const bin = useMemo(() => bins.find((b) => b.id === id), [bins, id]);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoProblem, setPhotoProblem] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Deep link or cold start: load the bins once if this one isn't in the store yet.
  useEffect(() => {
    if (bin) return;
    let live = true;
    void refreshBins().finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, [bin, refreshBins]);

  if (!bin) {
    const loading = !loaded || status === 'loading';
    return (
      <Screen header={<ScreenHeader title={tr('الصندوق الذكي', 'Smart bin')} />}>
        {loading ? (
          <StateMessage loading title={tr('بنحمّل الصندوق…', 'Loading the bin…')} />
        ) : (
          <StateMessage icon="trash" title={tr('الصندوق مش موجود', "We couldn't find that bin")} actionLabel={tr('ارجع للخريطة', 'Back to the map')} onAction={() => router.replace('/map')} />
        )}
      </Screen>
    );
  }

  const state = binDisplayState(bin);
  const pct = fillPercent(bin);
  const cooldown = reportCooldownMs(lastReportedAt);
  const alreadyReported = cooldown > 0 || done;
  const showReport = !isBinAlert(state);

  const addPhoto = async (fromGallery: boolean) => {
    setPhotoProblem(false);
    const res = await (fromGallery ? pickFromGallery(0.7) : takePhoto(0.7));
    if (res.kind === 'photo') setPhoto(res.uri);
    else if (res.kind === 'denied' || res.kind === 'failed') setPhotoProblem(true);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportFullBin(bin.id, { note: note.trim() || undefined, photoUri: photo ?? undefined });
      markReported(bin.id);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again'));
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { label: tr('الحرارة', 'Temperature'), value: bin.tempC !== undefined ? tempText(bin.tempC) : tr('مفيش قراءة', 'No reading') },
    {
      label: tr('البطارية', 'Battery'),
      value: bin.batteryV !== undefined ? `${voltText(bin.batteryV)}${bin.batteryV < BIN_THRESHOLDS.lowBatteryV ? tr(' · ضعيفة', ' · low') : ''}` : tr('مفيش قراءة', 'No reading'),
    },
    { label: tr('آخر قراءة', 'Last reading'), value: bin.lastSeenAt ? relativeTime(bin.lastSeenAt) : tr('لسه مبعتش', 'Not yet') },
    { label: tr('النوع', 'Type'), value: binKindLabel(bin.kind) },
  ];

  return (
    <Screen header={<ScreenHeader title={binTitle(bin)} />} gap={14} avoidKeyboard testID="bin-detail">
      {state === 'hot' ? (
        <View style={styles.heat} accessibilityRole="alert" testID="bin-heat-warning">
          <View style={styles.heatTitle}>
            <Icon name="flame" size={22} color={colors.urgentDeep} strokeWidth={2} />
            <AppText style={styles.heatText} color={colors.urgentDeep}>{tr('الصندوق سخن جدًا', 'This bin is very hot')}</AppText>
          </View>
          <AppText variant="small" color={colors.urgentDeep}>
            {tr('ابعد عنه ومتلمسوش. لو شايف دخان أو نار، اتصل بالمطافي فورًا.', 'Keep away and don’t touch it. If you see smoke or flames, call the fire service now.')}
          </AppText>
          <EmergencyRow numbers={['180']} />
        </View>
      ) : null}

      <Card padding={16} style={styles.gauge}>
        <View style={styles.gaugeTop}>
          <BinStateChip state={state} />
          <AppText variant="caption" color={colors.inkMuted}>{bin.id}</AppText>
        </View>
        <FillGauge pct={pct} state={state} big />
      </Card>

      <InfoTiles tiles={tiles.slice(0, 2)} />
      <InfoTiles tiles={tiles.slice(2)} />

      <Card padding={14} style={styles.place}>
        <Icon name="pin" size={20} color={colors.red} />
        <View style={styles.placeText}>
          <AppText variant="smallStrong">{bin.location.address}</AppText>
          {bin.location.landmark ? <AppText variant="caption" color={colors.inkMuted}>{bin.location.landmark}</AppText> : null}
        </View>
      </Card>

      {state === 'offline' ? (
        <InlineNotice text={tr('الصندوق مش بيبعت قراءات من فترة، فالمستوى اللي قدامك ممكن يكون قديم.', 'This bin hasn’t sent a reading in a while, so the level you see may be out of date.')} />
      ) : null}

      {!showReport ? (
        <Card padding={14} background={colors.goldSoft} style={styles.row}>
          <Icon name="check" size={20} color={colors.goldDeep} />
          <AppText variant="small" color={colors.goldDeep} style={styles.flex1}>
            {tr('الصندوق نبّهنا بنفسه، وفريق النظافة هيعرف. مش لازم تبلّغ.', 'The bin alerted us by itself and the cleaning team will know. You don’t need to report it.')}
          </AppText>
        </Card>
      ) : alreadyReported ? (
        <View style={styles.reported} testID="bin-reported" accessibilityLiveRegion="polite">
          <View style={styles.row}>
            <Icon name="check" size={20} color={colors.statusResolved} strokeWidth={2.2} />
            <AppText style={styles.reportedTitle} color={colors.statusResolved}>
              {done ? tr('تسلم إيدك! بلّغنا عن الصندوق', 'Thank you! We reported the bin') : tr('إنت بلّغت عن الصندوق ده', 'You already reported this bin')}
            </AppText>
          </View>
          <AppText variant="small" color={colors.inkMuted}>
            {done
              ? tr('هتلاقي البلاغ في طلباتي. ينفع تبلّغ عن نفس الصندوق تاني بعد ٢٤ ساعة.', 'You’ll find it in My requests. You can report the same bin again after 24 hours.')
              : tr(`ينفع تبلّغ تاني بعد حوالي ${localDigits(cooldownHours(cooldown))} ${cooldownHours(cooldown) === 1 ? 'ساعة' : 'ساعات'}.`, `You can report it again in about ${cooldownHours(cooldown)} ${cooldownHours(cooldown) === 1 ? 'hour' : 'hours'}.`)}
          </AppText>
          <Button label={tr('شوف طلباتي', 'See my requests')} icon="clipboard" variant="secondary" size="sm" fullWidth={false} onPress={() => router.navigate('/requests')} />
        </View>
      ) : (
        <View style={styles.form}>
          <AppText variant="label" accessibilityRole="header">{tr('الصندوق مليان؟', 'Is the bin full?')}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {tr('هنبعت بلاغ نظافة بمكان الصندوق. ينفع تبلّغ عن نفس الصندوق مرة كل ٢٤ ساعة.', 'We’ll send a cleaning report at the bin’s location. You can report the same bin once every 24 hours.')}
          </AppText>
          <TextField label={tr('ملاحظة (اختياري)', 'Note (optional)')} value={note} onChangeText={setNote} multiline rows={2} maxLength={200} placeholder={tr('مثلًا: الزبالة على الرصيف', 'For example: waste is piling up next to it')} testID="bin-note" />
          {photo ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photo }} style={styles.photo} accessibilityIgnoresInvertColors accessibilityLabel={tr('صورة الصندوق', 'Photo of the bin')} />
              <Button label={tr('شيل الصورة', 'Remove photo')} variant="ghost" size="sm" fullWidth={false} onPress={() => setPhoto(null)} />
            </View>
          ) : (
            <View style={styles.row}>
              <Button label={tr('صوّر', 'Take photo')} icon="camera" variant="secondary" size="sm" fullWidth={false} onPress={() => void addPhoto(false)} testID="bin-photo" />
              <Button label={tr('من المعرض', 'From gallery')} icon="image" variant="ghost" size="sm" fullWidth={false} onPress={() => void addPhoto(true)} />
            </View>
          )}
          {photoProblem ? <AppText variant="caption" color={colors.urgent}>{tr('مقدرناش نفتح الكاميرا. تقدر تبلّغ من غير صورة.', 'We couldn’t open the camera. You can report without a photo.')}</AppText> : null}
          {error ? <AppText variant="caption" color={colors.urgent} accessibilityLiveRegion="polite">{error}</AppText> : null}
          <Button label={tr('الصندوق مليان', 'Bin is full')} icon="trash" loading={busy} onPress={() => void send()} testID="bin-report-full" />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heat: { backgroundColor: colors.urgentSoft, borderRadius: radius.md, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.urgent },
  heatTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heatText: { fontFamily: fonts.display700, fontSize: 17, lineHeight: 26 },
  gauge: { gap: 12 },
  gaugeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeText: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  flex1: { flex: 1 },
  form: { gap: 10 },
  reported: { backgroundColor: colors.statusResolvedBg, borderRadius: radius.md, padding: 14, gap: 8 },
  reportedTitle: { fontFamily: fonts.sans600, fontSize: 15, lineHeight: 24 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
});
