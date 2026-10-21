import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AiSuggestion, CategoryPicker, CategoryRow, type TriageState } from '@/components/report/AiSuggestion';
import { useReportLocation } from '@/components/report/location';
import { PhotoSlots, type PhotoPair } from '@/components/report/PhotoSlots';
import { AlreadyReportedNote, DuplicatePanel, LocationCard, StepBar, VoiceRow } from '@/components/report/ReportParts';
import { validateReportForm, type ReportFormErrors } from '@/components/report/validation';
import { AppText, Button, Screen, ScreenHeader, TextField, ToggleRow } from '@/components/ui';
import { CATEGORIES } from '@/domain/categories';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { CategoryId, TriageSuggestion } from '@/domain/types';
import { pickDuplicateView } from '@/logic/duplicates';
import { services } from '@/services';
import { useReports, useSession } from '@/store';
import { colors } from '@/theme/tokens';

const isCategoryId = (v: string | undefined): v is CategoryId => !!v && CATEGORIES.some((c) => c.id === v);

export default function NewReportScreen() {
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
  const { place, state: locState, locate, setAddress, setLandmark } = useReportLocation(fallbackCenter);

  const [photos, setPhotos] = useState<PhotoPair>([null, null]);
  const [description, setDescription] = useState('');
  const [blurFaces, setBlurFaces] = useState(true);
  const [anonymous, setAnonymous] = useState(false);
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

  // Mock AI: runs once there is a photo or a few words; debounced while typing; stale answers are dropped.
  // `done.key` says which inputs the latest answer belongs to, so "loading" is derived rather than stored.
  const inputKey = [trimmed, mainPhoto ?? '', priorCategory ?? '', place.lat, place.lng, retryTick].join('|');
  const triage = hasInput ? (done?.suggestion ?? null) : null;
  const triageState: TriageState = !hasInput ? 'idle' : done?.key !== inputKey ? 'loading' : done.suggestion ? 'ready' : 'error';
  const categoryId: CategoryId | null = manualCategory ?? triage?.options[0]?.categoryId ?? paramCategory;

  useEffect(() => {
    if (!hasInput) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      let suggestion: TriageSuggestion | null = null;
      try {
        suggestion = await services.triage.analyze({
          userId: userId ?? '',
          description: trimmed,
          categoryId: priorCategory ?? undefined,
          photoUri: mainPhoto,
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
  }, [hasInput, inputKey, userId, trimmed, mainPhoto, priorCategory, place.lat, place.lng]);

  // Only matches of the category that will be submitted count (the AI top pick may differ from a manual pick).
  const dupView = pickDuplicateView(triage, categoryId);
  const duplicate = dupView.kind === 'join' && dupView.match.incidentId !== dismissedDup ? dupView.match : null;

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
        await submitReport({
          categoryId: values.categoryId as CategoryId,
          description: values.description,
          photoUris,
          location: values.location,
          anonymous,
          blurFaces,
          severity: triage?.severity,
          governorate,
          district,
          linkToIncidentId: linkTo,
        });
        router.replace('/report/success');
      } catch (e) {
        setSubmitError(e instanceof Error && e.message ? e.message : 'معرفناش نبعت البلاغ، جرّب تاني.');
        setSubmitting(null);
      }
    },
    [submitting, categoryId, trimmed, photoUris, place, anonymous, blurFaces, submitReport, triage, governorate, district],
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
            <ScreenHeader title="بلاغ جديد" step="خطوة ٢ من ٣" />
            <StepBar step={2} />
          </View>
        }
        gap={14}
        footer={
          <View style={styles.footer}>
            <View style={styles.offline}>
              <Icon name="wifi" size={14} color={colors.inkMuted} />
              <AppText variant="caption" color={colors.inkMuted}>النت ضعيف؟ البلاغ هيتحفظ ويتبعت أول ما يرجع</AppText>
            </View>
            {submitError ? <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{submitError}</AppText> : null}
            {!submitError && errorCount > 0 ? (
              <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>راجع الحقول اللي متعلّمة بالأحمر.</AppText>
            ) : null}
            <Button testID="submit-report" label="ابعت البلاغ" icon="arrow-forward" iconPosition="end" loading={submitting === 'send'} disabled={submitting === 'join'} onPress={() => submit()} />
          </View>
        }
      >
        <PhotoSlots photos={photos} onChange={setPhotos} quality={dataSaver ? 0.5 : 0.8} />

        {triageState === 'idle' ? (
          <View style={{ gap: 4 }}>
            <CategoryRow selected={categoryId} onPress={() => setPickerOpen(true)} />
            {errors.categoryId ? <AppText variant="caption" color={colors.urgent}>{errors.categoryId}</AppText> : null}
          </View>
        ) : (
          <View style={{ gap: 4 }}>
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
          <AppText variant="label">وصف المشكلة</AppText>
          <VoiceRow highlight={params.voice === '1'} />
          <TextField
            testID="description-input"
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (errors.description) setErrors((e) => ({ ...e, description: undefined }));
            }}
            multiline
            rows={3}
            placeholder="اكتب المشكلة بالعامية، زي: فيه حفرة قدام المدرسة"
            error={errors.description}
          />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">المكان</AppText>
          <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onRetry={locate} />
          <TextField testID="landmark-input" label="علامة مميزة (اختياري)" value={place.landmark ?? ''} onChangeText={setLandmark} placeholder="مثلًا: قدام مدرسة النصر الإعدادية" />
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">خصوصيتك</AppText>
          <ToggleRow testID="toggle-blur" icon="eye-off" title="اخفي الوشوش ونمر العربيات" subtitle="بنعمل blur تلقائي قبل ما الصورة تتنشر" value={blurFaces} onValueChange={setBlurFaces} />
          <ToggleRow testID="toggle-anonymous" icon="shield-check" title="بلّغ من غير اسم" subtitle="الحي مش هيشوف اسمك ولا رقمك" value={anonymous} onValueChange={setAnonymous} />
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
