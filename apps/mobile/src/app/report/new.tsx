import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { EmergencyAlert } from '@/components/Hotlines';
import { AiSuggestion, CategoryPicker, CategoryRow, type TriageState } from '@/components/report/AiSuggestion';
import { useReportLocation } from '@/components/report/location';
import { PhotoSlots, type PhotoPair } from '@/components/report/PhotoSlots';
import { AlreadyReportedNote, DuplicatePanel, LocationCard, StepBar } from '@/components/report/ReportParts';
import { VoiceNote, type VoiceStatus } from '@/components/report/VoiceNote';
import { appendTranscript } from '@/components/report/voice';
import { validateReportForm, type ReportFormErrors } from '@/components/report/validation';
import { AppText, Button, Screen, ScreenHeader, TextField, ToggleRow } from '@/components/ui';
import { CATEGORIES } from '@/domain/categories';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { CategoryId, TriageSuggestion } from '@/domain/types';
import { tr as trNow, useLang, useTr } from '@/i18n';
import { pickDuplicateView } from '@/logic/duplicates';
import { detectEmergency } from '@/logic/triage-mock';
import { API_MODE, services } from '@/services';
import { prepareTriagePhoto } from '@/services/media';
import { uploadAndTranscribeVoiceNote, useReports, useSession } from '@/store';
import { colors } from '@/theme/tokens';

const isCategoryId = (v: string | undefined): v is CategoryId => !!v && CATEGORIES.some((c) => c.id === v);

export default function NewReportScreen() {
  const tr = useTr();
  const lang = useLang();
  const params = useLocalSearchParams<{ category?: string; voice?: string }>();
  const paramCategory = isCategoryId(params.category) ? params.category : null;

  const submitReport = useReports((s) => s.submitReport);
  const userId = useSession((s) => s.userId);
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const dataSaver = useSession((s) => s.prefs.dataSaver);

  const fallbackCenter = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);
  const { place, state: locState, locate, moveTo, setAddress, setLandmark } = useReportLocation(fallbackCenter);

  const [photos, setPhotos] = useState<PhotoPair>([null, null]);
  const [description, setDescription] = useState('');
  /** The recorded clip on the phone, and its storage path once uploaded. A report sends the path when there is one,
   *  else the local file (the submit pipeline / offline queue uploads it): a failed or unfinished upload never drops it. */
  const [voiceLocal, setVoiceLocal] = useState<string | null>(null);
  const [voicePath, setVoicePath] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('none');
  const voiceTicket = useRef(0);
  const [blurFaces, setBlurFaces] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
  const [photoAnalysisConsent, setPhotoAnalysisConsent] = useState(false);
  const triagePhotoCache = useRef(new Map<string, Promise<{ photoUri?: string; photoConsent: boolean }>>());
  const [manualCategory, setManualCategory] = useState<CategoryId | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [done, setDone] = useState<{ key: string; suggestion: TriageSuggestion | null } | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [dismissedDup, setDismissedDup] = useState<string | null>(null);

  const [errors, setErrors] = useState<ReportFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'send' | 'join' | null>(null);

  const photoUris = useMemo(() => photos.filter((p): p is string => !!p), [photos]);
  const trimmed = description.trim();
  const hasInput = photoUris.length > 0 || trimmed.length >= 5;
  const priorCategory = manualCategory ?? paramCategory;
  const mainPhoto = photoUris[0];
  const onPhotosChange = useCallback((next: PhotoPair) => {
    setPhotos(next);
    setPhotoAnalysisConsent(false);
  }, []);

  // Mock AI: runs once there is a photo or a few words; debounced while typing; stale answers are dropped.
  // `done.key` says which inputs the latest answer belongs to, so "loading" is derived rather than stored.
  const inputKey = [trimmed, mainPhoto ?? '', photoAnalysisConsent, priorCategory ?? '', place.lat, place.lng, retryTick, lang].join('|');
  const triage = hasInput ? (done?.suggestion ?? null) : null;
  const triageState: TriageState = !hasInput ? 'idle' : done?.key !== inputKey ? 'loading' : done.suggestion ? 'ready' : 'error';
  const categoryId: CategoryId | null = manualCategory ?? triage?.options[0]?.categoryId ?? paramCategory;

  useEffect(() => {
    if (!hasInput) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let suggestion: TriageSuggestion | null = null;
      try {
        let triagePhoto: { photoUri?: string; photoConsent: boolean };
        if (API_MODE === 'mock') {
          triagePhoto = { photoUri: mainPhoto, photoConsent: false };
        } else if (photoAnalysisConsent && mainPhoto) {
          let prepared = triagePhotoCache.current.get(mainPhoto);
          if (!prepared) {
            prepared = prepareTriagePhoto(mainPhoto, true, services.uploads.upload);
            triagePhotoCache.current.set(mainPhoto, prepared);
            prepared.catch(() => triagePhotoCache.current.delete(mainPhoto));
          }
          try {
            triagePhoto = await prepared;
          } catch {
            triagePhoto = { photoConsent: false };
          }
        } else {
          triagePhoto = { photoConsent: false };
        }
        if (cancelled) return;
        suggestion = await services.triage.analyze({
          userId: userId ?? '',
          description: trimmed,
          categoryId: priorCategory ?? undefined,
          ...triagePhoto,
          location: { lat: place.lat, lng: place.lng },
        });
      } catch {
        suggestion = null;
      }
      if (!cancelled) setDone({ key: inputKey, suggestion });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [hasInput, inputKey, userId, trimmed, mainPhoto, photoAnalysisConsent, priorCategory, place.lat, place.lng]);

  // Only matches of the category that will be submitted count (the AI top pick may differ from a manual pick).
  const dupView = pickDuplicateView(triage, categoryId);
  const duplicate = dupView.kind === 'join' && dupView.match.incidentId !== dismissedDup ? dupView.match : null;

  // Upload + transcribe a fresh recording; the transcript lands in the description (appended, still editable).
  const onVoiceRecorded = useCallback(async (localUri: string) => {
    const ticket = ++voiceTicket.current;
    setVoiceLocal(localUri);
    setVoicePath(null);
    setVoiceStatus('transcribing');
    const { text } = await uploadAndTranscribeVoiceNote(localUri, undefined, (path) => {
      if (ticket === voiceTicket.current) setVoicePath(path);
    });
    if (ticket !== voiceTicket.current) return; // deleted or re-recorded meanwhile
    if (text) {
      setDescription((d) => appendTranscript(d, text));
      setErrors((e) => ({ ...e, description: undefined }));
      setVoiceStatus('done');
    } else {
      setVoiceStatus('failed');
    }
  }, []);
  const onVoiceRemoved = useCallback(() => {
    voiceTicket.current += 1;
    setVoiceLocal(null);
    setVoicePath(null);
    setVoiceStatus('none');
  }, []);

  const submit = useCallback(
    async (linkTo?: string) => {
      if (submitting) return;
      const values = {
        categoryId: categoryId ?? '',
        description: trimmed,
        photoUris,
        location: { lat: place.lat, lng: place.lng, address: place.address.trim(), landmark: place.landmark?.trim() || undefined },
        anonymous,
        blurFaces,
      };
      const found = validateReportForm(values);
      setErrors(found);
      setSubmitError(null);
      if (Object.keys(found).length > 0) return;

      setSubmitting(linkTo ? 'join' : 'send');
      try {
        const res = await submitReport({
          categoryId: values.categoryId as CategoryId,
          description: values.description,
          photoUris,
          voiceNoteUri: voicePath ?? voiceLocal ?? undefined,
          location: values.location,
          anonymous,
          blurFaces,
          severity: triage?.severity,
          governorate,
          district,
          linkToIncidentId: linkTo,
        });
        router.replace(res.queued ? { pathname: '/report/success', params: { queued: '1' } } : '/report/success');
      } catch (e) {
        setSubmitError(e instanceof Error && e.message ? e.message : trNow('معرفناش نبعت البلاغ، جرّب تاني.', "We couldn't send your report. Try again."));
        setSubmitting(null);
      }
    },
    [submitting, categoryId, trimmed, photoUris, voicePath, voiceLocal, place, anonymous, blurFaces, submitReport, triage, governorate, district],
  );

  const pickCategory = (id: CategoryId) => {
    setManualCategory(id);
    setPickerOpen(false);
    setErrors((e) => ({ ...e, categoryId: undefined }));
  };

  // `setErrors((e) => ({ ...e, x: undefined }))` leaves the key behind: count real messages only.
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <>
      <Screen
        avoidKeyboard
        header={
          <View>
            <ScreenHeader title={tr('بلاغ جديد', 'New report')} step={tr('خطوة ٢ من ٣', 'Step 2 of 3')} />
            <StepBar step={2} />
          </View>
        }
        gap={14}
        footer={
          <View style={styles.footer}>
            <View style={styles.offline}>
              <Icon name="wifi" size={14} color={colors.inkMuted} />
              <AppText variant="caption" color={colors.inkMuted}>{tr('النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع', 'Weak signal? We’ll save your report and send it when you’re back online')}</AppText>
            </View>
            {submitError ? <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{submitError}</AppText> : null}
            {!submitError && errorCount > 0 ? (
              <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{tr('راجع الحقول اللي متعلّمة بالأحمر.', 'Check the fields marked in red.')}</AppText>
            ) : null}
            <Button testID="submit-report" label={tr('ابعت البلاغ', 'Send report')} icon="arrow-forward" iconPosition="end" loading={submitting === 'send'} disabled={submitting === 'join'} onPress={() => submit()} />
          </View>
        }
      >
        <PhotoSlots photos={photos} onChange={onPhotosChange} quality={dataSaver ? 0.5 : 0.8} />

        {triageState === 'idle' ? (
          <View style={{ gap: 4 }}>
            <CategoryRow selected={categoryId} onPress={() => setPickerOpen(true)} />
            {errors.categoryId ? <AppText variant="caption" color={colors.urgent}>{errors.categoryId}</AppText> : null}
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            {/* Safety net: emergency numbers show even when the AI suggestion is loading or failed. */}
            {!triage?.emergency && detectEmergency(trimmed) ? <EmergencyAlert /> : null}
            <AiSuggestion
              state={triageState}
              suggestion={triage}
              selected={categoryId}
              onSelect={pickCategory}
              onPickOther={() => setPickerOpen(true)}
              onRetry={() => setRetryTick((n) => n + 1)}
            />
            {errors.categoryId ? <AppText variant="caption" color={colors.urgent}>{errors.categoryId}</AppText> : null}
          </View>
        )}

        <View style={{ gap: 8 }}>
          <AppText variant="label">{tr('وصف المشكلة', 'Describe the problem')}</AppText>
          <VoiceNote highlight={params.voice === '1'} status={voiceStatus} onRecorded={onVoiceRecorded} onRemoved={onVoiceRemoved} />
          <TextField
            testID="description-input"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (errors.description) setErrors((e) => ({ ...e, description: undefined }));
            }}
            multiline
            rows={3}
            placeholder={tr('اكتب المشكلة بالعامية، زي: فيه حفرة قدام المدرسة', 'Describe it in your own words, like: There’s a pothole in front of the school')}
            error={errors.description}
          />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">{tr('المكان', 'Location')}</AppText>
          <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onRetry={locate} onMove={moveTo} />
          <TextField testID="landmark-input" label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={place.landmark ?? ''} onChangeText={setLandmark} placeholder={tr('مثلًا: قدام مدرسة النصر الإعدادية', 'e.g. in front of Al Nasr Prep School')} />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">{tr('خصوصيتك', 'Your privacy')}</AppText>
          <ToggleRow testID="toggle-blur" icon="eye-off" title={tr('اخفي الوشوش ونمر العربيات', 'Blur faces and car plates')} subtitle={tr('بنعمل blur تلقائي قبل ما الصورة تتنشر', 'We blur them automatically before the photo is published')} value={blurFaces} onValueChange={setBlurFaces} />
          <ToggleRow testID="toggle-anonymous" icon="shield-check" title={tr('بلّغ من غير اسم', 'Report without my name')} subtitle={tr('الحي مش هيشوف اسمك ولا رقمك', 'The district won’t see your name or number')} value={anonymous} onValueChange={setAnonymous} />
          {API_MODE === 'api' && mainPhoto ? <ToggleRow testID="toggle-ai-photo-consent" icon="shield-check" title={tr('أوافق على تحليل الصورة بالذكاء الاصطناعي', 'Allow AI photo analysis')} subtitle={tr('هنرفع الصورة بشكل خاص ونبعتها لـ Gemini للتحليل. اختياري؛ تقدر تكمل بالوصف بس.', 'The photo will be uploaded privately and sent to Gemini for analysis. Optional; you can continue with text only.')} value={photoAnalysisConsent} onValueChange={setPhotoAnalysisConsent} /> : null}
        </View>

        {dupView.kind === 'own' ? (
          <AlreadyReportedNote own={dupView.own} onOpen={() => router.push(`/requests/${dupView.own.reportId}`)} />
        ) : null}
        {duplicate ? (
          <DuplicatePanel
            match={duplicate}
            busy={submitting === 'join'}
            onJoin={() => submit(duplicate.incidentId)}
            onDismiss={() => setDismissedDup(duplicate.incidentId)}
          />
        ) : null}
      </Screen>

      <CategoryPicker visible={pickerOpen} selected={categoryId} onClose={() => setPickerOpen(false)} onSelect={pickCategory} />
    </>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
  offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
