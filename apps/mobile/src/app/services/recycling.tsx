import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { DemoPricesNote, KgStepper, MaterialBadge, MaterialGrid } from '@/components/citycycle';
import { useReportLocation } from '@/components/report/location';
import { pickFromGallery, takePhoto } from '@/components/report/photo';
import { LocationCard } from '@/components/report/ReportParts';
import { VoiceNote, type VoiceStatus } from '@/components/report/VoiceNote';
import { appendTranscript } from '@/components/report/voice';
import { DayTile, FormSection, gridStyles } from '@/components/services';
import { AppText, Button, Card, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import {
  DEFAULT_KG,
  MATERIAL_IDS,
  PICKUP_MODES,
  WASTE_SIZE_KG,
  estimateValue,
  formatEgp,
  materialLabel,
  validatePickupInput,
  type MaterialId,
  type PickupFormErrors,
  type PickupMode,
  type WasteClassification,
} from '@/domain/citycycle';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import { SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { slotLabel, useTr } from '@/i18n';
import { services } from '@/services';
import { PHOTO_CONTENT_TYPE, compressImage } from '@/services/media';
import { uploadAndTranscribeVoiceNote, useRecycling, useSession } from '@/store';
import { colors, radius } from '@/theme/tokens';
import { localDigits } from '@/utils/digits';

/** CityCycle: ask for a recyclables pickup (materials + weights, photo, place, day, free or paid). */
export default function RecyclingPickupScreen() {
  const tr = useTr();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const dataSaver = useSession((s) => s.prefs.dataSaver);
  const prices = useRecycling((s) => s.prices);
  const loadPrices = useRecycling((s) => s.loadPrices);
  const createPickup = useRecycling((s) => s.createPickup);

  const fallbackCenter = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);
  const { place, state: locState, locate, setAddress, setLandmark, moveTo } = useReportLocation(fallbackCenter);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [kgById, setKgById] = useState<Partial<Record<MaterialId, number>>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoProblem, setPhotoProblem] = useState(false);
  const [suggestion, setSuggestion] = useState<{ state: 'loading' } | { state: 'ready'; value: WasteClassification } | { state: 'none' }>({ state: 'none' });
  const [mode, setMode] = useState<PickupMode>('paid');
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [note, setNote] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('none');
  const [errors, setErrors] = useState<PickupFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ local: string; path: string } | null>(null);
  const photoTicket = useRef(0);
  const voiceTicket = useRef(0);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  const selected = useMemo(() => new Set(Object.keys(kgById) as MaterialId[]), [kgById]);
  const items = useMemo(() => MATERIAL_IDS.filter((id) => kgById[id] !== undefined).map((id) => ({ materialId: id, estimatedKg: kgById[id] as number })), [kgById]);
  const estimate = useMemo(() => estimateValue(items, prices), [items, prices]);

  const toggle = (id: MaterialId) => {
    setErrors((e) => ({ ...e, items: undefined, kg: undefined }));
    setKgById((cur) => {
      const next = { ...cur };
      if (next[id] !== undefined) delete next[id];
      else next[id] = DEFAULT_KG;
      return next;
    });
  };

  /** Upload once (a retry after a failed request reuses the path). Returns the path to send. */
  const uploadPhoto = useCallback(async (local: string): Promise<string> => {
    if (uploaded.current?.local === local) return uploaded.current.path;
    const path = await services.uploads.upload(await compressImage(local), 'report_photo', PHOTO_CONTENT_TYPE);
    uploaded.current = { local, path };
    return path;
  }, []);

  const quality = dataSaver ? 0.5 : 0.8;
  const addPhoto = async (source: 'camera' | 'gallery') => {
    const res = await (source === 'camera' ? takePhoto(quality) : pickFromGallery(quality));
    if (res.kind === 'photo') {
      setPhoto(res.uri);
      setPhotoProblem(false);
      // The AI check is a suggestion only: any failure just means no suggestion.
      const ticket = ++photoTicket.current;
      setSuggestion({ state: 'loading' });
      try {
        const path = await uploadPhoto(res.uri);
        const value = await services.waste.classify(path);
        if (ticket === photoTicket.current) setSuggestion(value.materials.length > 0 ? { state: 'ready', value } : { state: 'none' });
      } catch {
        if (ticket === photoTicket.current) setSuggestion({ state: 'none' });
      }
    } else if (res.kind === 'denied' || res.kind === 'failed') {
      setPhotoProblem(true);
    }
  };
  const removePhoto = () => {
    photoTicket.current += 1;
    setPhoto(null);
    setSuggestion({ state: 'none' });
  };

  const acceptSuggestion = (id: MaterialId, value: WasteClassification) => {
    setErrors((e) => ({ ...e, items: undefined, kg: undefined }));
    const mid = value.estimatedKgRange ? (value.estimatedKgRange[0] + value.estimatedKgRange[1]) / 2 : WASTE_SIZE_KG[value.size];
    setKgById((cur) => (cur[id] !== undefined ? cur : { ...cur, [id]: Math.max(0.5, Math.round(mid * 2) / 2) }));
  };

  const onVoiceRecorded = useCallback(async (localUri: string) => {
    const ticket = ++voiceTicket.current;
    setVoiceStatus('transcribing');
    const { text } = await uploadAndTranscribeVoiceNote(localUri);
    if (ticket !== voiceTicket.current) return;
    if (text) {
      setNote((cur) => appendTranscript(cur, text));
      setVoiceStatus('done');
    } else {
      setVoiceStatus('failed');
    }
  }, []);
  const onVoiceRemoved = useCallback(() => {
    voiceTicket.current += 1;
    setVoiceStatus('none');
  }, []);

  const submit = async () => {
    if (busy) return;
    const location = { ...place, address: place.address.trim(), landmark: place.landmark?.trim() || undefined };
    const errs = validatePickupInput({ items, location, day });
    setErrors(errs);
    setSubmitError(null);
    if (Object.keys(errs).length > 0) return;
    setBusy(true);
    try {
      const photoUris = photo ? [await uploadPhoto(photo)] : [];
      const p = await createPickup({ items, photoUris, location, day, slot, mode, note: note.trim() || undefined });
      router.replace(`/requests/${p.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tr('معرفناش نبعت الطلب، جرّب تاني', "We couldn't send your request. Please try again."));
      setBusy(false);
    }
  };

  return (
    <Screen
      avoidKeyboard
      header={<ScreenHeader title={tr('جمع تدوير من بيتك', 'Recycling pickup')} />}
      gap={20}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {submitError ? <AppText variant="caption" color={colors.urgent} center accessibilityLiveRegion="polite">{submitError}</AppText> : null}
          <Button label={tr('ابعت الطلب', 'Send the request')} onPress={submit} loading={busy} testID="recycling-submit" />
        </View>
      }
    >
      <AppText variant="small" color={colors.inkMuted}>
        {tr('جامع موثّق من الحي بيعدّي ياخد الخامات من عندك ويوزنها قدامك.', 'A collector verified by the district comes to your door and weighs the materials in front of you.')}
      </AppText>

      <FormSection title={tr('عندك إيه؟', 'What do you have?')} error={errors.items ?? errors.kg}>
        <MaterialGrid materials={MATERIAL_IDS} selected={selected} prices={prices} onToggle={toggle} />
        <DemoPricesNote />
        <Button label={tr('دليل الفرز بالصور', 'Sorting guide with pictures')} icon="info" variant="ghost" size="sm" onPress={() => router.push('/recycling-guide')} testID="open-guide" />
      </FormSection>

      {items.length > 0 ? (
        <FormSection title={tr('الوزن التقريبي', 'Rough weight')} hint={tr('تقدير بس. الجامع بيوزن بالميزان.', 'Just an estimate. The collector weighs it on a scale.')}>
          <Card padding={12} style={styles.weights}>
            {items.map((it) => (
              <View key={it.materialId} style={styles.weightRow} testID={`weight-${it.materialId}`}>
                <MaterialBadge id={it.materialId} size={34} />
                <AppText variant="smallStrong" style={styles.flex} numberOfLines={1}>{materialLabel(it.materialId)}</AppText>
                <KgStepper value={it.estimatedKg} onChange={(kg) => setKgById((cur) => ({ ...cur, [it.materialId]: kg }))} testID={`kg-${it.materialId}`} />
              </View>
            ))}
          </Card>
        </FormSection>
      ) : null}

      <FormSection title={tr('صورة (اختياري)', 'Photo (optional)')} hint={tr('بنقترح الخامة من الصورة وإنت اللي بتأكّد.', 'We suggest the material from the photo, and you confirm.')}>
        {photo ? (
          <View style={styles.photoBox}>
            <Image source={{ uri: photo }} accessibilityLabel={tr('صورة الخامات', 'Photo of the materials')} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <Pressable accessibilityRole="button" accessibilityLabel={tr('امسح الصورة', 'Remove photo')} onPress={removePhoto} hitSlop={10} style={styles.remove}>
              <Icon name="x" size={16} color={colors.onRed} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : (
          <View style={gridStyles.wrap}>
            <View style={gridStyles.half}>
              <Button label={tr('صوّر', 'Take a photo')} icon="camera" variant="secondary" onPress={() => void addPhoto('camera')} testID="recycling-photo-camera" />
            </View>
            <View style={gridStyles.half}>
              <Button label={tr('من المعرض', 'From gallery')} icon="image" variant="secondary" onPress={() => void addPhoto('gallery')} testID="recycling-photo-gallery" />
            </View>
          </View>
        )}
        {photoProblem ? (
          <AppText variant="caption" color={colors.goldDeep} accessibilityRole="alert">
            {tr('مقدرناش نفتح الكاميرا. اختار صورة من المعرض أو كمّل من غير صورة.', 'We couldn’t open the camera. Pick a photo from your gallery, or continue without one.')}
          </AppText>
        ) : null}
        {suggestion.state === 'loading' ? <AppText variant="caption" color={colors.inkMuted} testID="waste-loading">{tr('بنبص على الصورة…', 'Looking at the photo…')}</AppText> : null}
        {suggestion.state === 'ready' ? (
          <Card background={colors.redSoft} padding={12} style={styles.suggest} testID="waste-suggestion">
            <View style={styles.suggestHead}>
              <Icon name="sparkles" size={16} color={colors.red} />
              <AppText variant="smallStrong" color={colors.red}>{tr('اقتراح من الصورة', 'Suggested from the photo')}</AppText>
            </View>
            <View style={styles.suggestChips}>
              {suggestion.value.materials.map((m) => (
                <ChoiceChip
                  key={m.materialId}
                  label={`${materialLabel(m.materialId)} · ${localDigits(Math.round(m.confidence * 100))}٪`}
                  selected={selected.has(m.materialId)}
                  check
                  onPress={() => acceptSuggestion(m.materialId, suggestion.value)}
                  testID={`suggest-${m.materialId}`}
                />
              ))}
            </View>
            <AppText variant="caption" color={colors.inkMuted}>{tr('ده اقتراح بس: اختار اللي صح وغيّر الوزن.', 'This is only a suggestion: choose what is right and adjust the weight.')}</AppText>
          </Card>
        ) : null}
      </FormSection>

      <FormSection title={tr('بتدّيها ولا بتبيعها؟', 'Give it away or sell it?')}>
        <View style={gridStyles.wrap} accessibilityRole="radiogroup">
          {PICKUP_MODES.map((m) => (
            <View key={m.id} style={gridStyles.half}>
              <ChoiceChip label={tr(m.ar, m.en)} sublabel={tr(m.subAr, m.subEn)} radio selected={mode === m.id} onPress={() => setMode(m.id)} testID={`mode-${m.id}`} />
            </View>
          ))}
        </View>
        {mode === 'paid' && items.length > 0 ? (
          <Card background={colors.goldSoft} padding={12} style={styles.value} testID="recycling-estimate">
            <Icon name="coins" size={20} color={colors.goldDeep} />
            <View style={styles.flex}>
              {estimate.valueEgp !== undefined ? (
                <AppText variant="smallStrong" color={colors.goldDeep}>{tr('تقريبًا', 'About')} {formatEgp(estimate.valueEgp)}</AppText>
              ) : (
                <AppText variant="smallStrong" color={colors.goldDeep}>{tr('السعر هيتحدد', 'Price to be set')}</AppText>
              )}
              <AppText variant="caption" color={colors.goldDeep}>
                {estimate.unpriced.length > 0 && estimate.valueEgp !== undefined
                  ? tr(`من غير ${estimate.unpriced.map(materialLabel).join('، ')} (لسه من غير سعر). الوزن الفعلي هو اللي بيحدد.`, `Not counting ${estimate.unpriced.map(materialLabel).join(', ')} (no price yet). The actual weight decides.`)
                  : tr('الوزن الفعلي هو اللي بيحدد المبلغ.', 'The actual weight decides the amount.')}
              </AppText>
            </View>
          </Card>
        ) : null}
      </FormSection>

      <FormSection title={tr('المكان', 'Location')}>
        <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onRetry={locate} onMove={moveTo} />
        <TextField label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={place.landmark ?? ''} onChangeText={setLandmark} placeholder={tr('مثلًا: جنب الصيدلية، الدور التالت', 'e.g. Next to the pharmacy, third floor')} testID="landmark-input" />
      </FormSection>

      <FormSection title={tr('اختار الميعاد', 'Pick a time')} hint={tr('من الأحد للخميس', 'Sunday to Thursday')} error={errors.day}>
        <View style={gridStyles.wrap}>
          {days.map((d) => (
            <DayTile key={d} day={d} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </View>
        <View style={gridStyles.wrap}>
          {SLOTS.map((s) => (
            <View key={s.id} style={gridStyles.half}>
              <ChoiceChip label={slotLabel(s)} selected={slot === s.id} onPress={() => setSlot(s.id)} testID={`slot-${s.id}`} />
            </View>
          ))}
        </View>
      </FormSection>

      <FormSection title={tr('ملاحظة (اختياري)', 'Note (optional)')}>
        <VoiceNote status={voiceStatus} onRecorded={onVoiceRecorded} onRemoved={onVoiceRemoved} />
        <TextField value={note} onChangeText={setNote} multiline rows={3} placeholder={tr('مثلًا: الخامات في الجراج، رن الجرس', 'e.g. The materials are in the garage, ring the bell')} testID="recycling-note" />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 24 },
  flex: { flex: 1, minWidth: 0 },
  weights: { gap: 10 },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoBox: { height: 150, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.statusReceivedBg },
  remove: { position: 'absolute', top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(22,22,22,0.72)', alignItems: 'center', justifyContent: 'center' },
  suggest: { gap: 8 },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
