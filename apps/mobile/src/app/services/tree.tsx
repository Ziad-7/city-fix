import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { itemLabel, slotLabel, useTr, FREE_SERVICE_LABEL_EN } from '@/i18n';
import { useReportLocation } from '@/components/report/location';
import { pickFromGallery, takePhoto } from '@/components/report/photo';
import { LocationCard } from '@/components/report/ReportParts';
import { DayTile, FormSection, gridStyles } from '@/components/services';
import { validateTreeBooking, type TreeFormErrors } from '@/components/services/tree';
import { AppText, Button, Card, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import { FREE_SERVICE_LABEL, SLOTS, TREE_WORK_TYPES, nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { services } from '@/services';
import { PHOTO_CONTENT_TYPE, compressImage } from '@/services/media';
import { useServiceRequests, useSession } from '@/store';
import { colors, radius } from '@/theme/tokens';

/** Tree maintenance booking (free, from the district gardens department): work type, photo, place, day + slot, note. */
export default function TreeMaintenanceScreen() {
  const tr = useTr();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const dataSaver = useSession((s) => s.prefs.dataSaver);
  const bookService = useServiceRequests((s) => s.bookService);

  const fallbackCenter = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);
  const { place, state: locState, locate, setAddress, setLandmark, moveTo } = useReportLocation(fallbackCenter);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [workType, setWorkType] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoProblem, setPhotoProblem] = useState(false);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<TreeFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<{ local: string; path: string } | null>(null);

  const quality = dataSaver ? 0.5 : 0.8;
  const addPhoto = async (source: 'camera' | 'gallery') => {
    const res = await (source === 'camera' ? takePhoto(quality) : pickFromGallery(quality));
    if (res.kind === 'photo') {
      setPhoto(res.uri);
      setPhotoProblem(false);
    } else if (res.kind === 'denied' || res.kind === 'failed') {
      setPhotoProblem(true);
    }
  };

  const submit = async () => {
    if (busy) return;
    const { errors: next, input } = validateTreeBooking({ workType, day, slot, note, place, photoUris: photo ? [photo] : [] });
    setErrors(next);
    setSubmitError(null);
    if (!input) return;
    setBusy(true);
    try {
      if (photo && input.details.photoUris) {
        // Same pipeline as report photos: shrink to 1600 px JPEG, upload once (a retry after a failed booking reuses it).
        if (uploaded.current?.local !== photo) {
          const path = await services.uploads.upload(await compressImage(photo), 'report_photo', PHOTO_CONTENT_TYPE);
          uploaded.current = { local: photo, path };
        }
        input.details.photoUris = [uploaded.current.path];
      }
      const req = await bookService(input);
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tr('معرفناش نحجز الميعاد، جرّب تاني', 'We couldn’t book your slot. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <Screen
      avoidKeyboard
      header={<ScreenHeader title={tr('تقليم أو إزالة شجرة', 'Tree trimming or removal')} />}
      gap={20}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {submitError ? <AppText variant="caption" color={colors.urgent} center accessibilityLiveRegion="polite">{submitError}</AppText> : null}
          <Button label={tr('احجز الميعاد', 'Book a slot')} onPress={submit} loading={busy} testID="tree-submit" />
        </View>
      }
    >
      <AppText variant="small" color={colors.inkMuted}>{tr('إدارة الحدائق بتبعت فريق خلال ٥ أيام من الميعاد المختار.', 'The Parks Department sends a team within 5 days of your chosen day.')}</AppText>

      <Card background={colors.statusResolvedBg} padding={12} style={styles.free}>
        <Icon name="check" size={18} color={colors.statusResolved} strokeWidth={2.5} />
        <AppText variant="smallStrong" color={colors.statusResolved} style={styles.flex} testID="tree-free">{tr(FREE_SERVICE_LABEL, FREE_SERVICE_LABEL_EN)}</AppText>
      </Card>

      <FormSection title={tr('الشغل المطلوب', 'Work needed')} error={errors.workType}>
        <View style={gridStyles.wrap}>
          {TREE_WORK_TYPES.map((w) => (
            <View key={w} style={gridStyles.half}>
              <ChoiceChip
                label={itemLabel(w)}
                selected={workType === w}
                onPress={() => {
                  setWorkType(w);
                  setErrors((e) => ({ ...e, workType: undefined }));
                }}
                testID={`work-${w}`}
              />
            </View>
          ))}
        </View>
      </FormSection>

      <FormSection title={tr('صورة الشجرة (اختياري)', 'Photo of the tree (optional)')}>
        {photo ? (
          <View style={styles.photoBox}>
            <Image source={{ uri: photo }} accessibilityLabel={tr('صورة الشجرة', 'Photo of the tree')} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <Pressable accessibilityRole="button" accessibilityLabel={tr('امسح الصورة', 'Remove photo')} onPress={() => setPhoto(null)} hitSlop={10} style={styles.remove}>
              <Icon name="x" size={16} color={colors.onRed} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : (
          <View style={gridStyles.wrap}>
            <View style={gridStyles.half}>
              <Button label={tr('صوّر', 'Take a photo')} icon="camera" variant="secondary" onPress={() => void addPhoto('camera')} testID="tree-photo-camera" />
            </View>
            <View style={gridStyles.half}>
              <Button label={tr('من المعرض', 'From gallery')} icon="image" variant="secondary" onPress={() => void addPhoto('gallery')} testID="tree-photo-gallery" />
            </View>
          </View>
        )}
        {photoProblem ? (
          <AppText variant="caption" color={colors.goldDeep} accessibilityRole="alert">
            {tr('مقدرناش نفتح الكاميرا. اختار صورة من المعرض أو كمّل من غير صورة.', 'We couldn’t open the camera. Pick a photo from your gallery, or continue without one.')}
          </AppText>
        ) : null}
      </FormSection>

      <FormSection title={tr('المكان', 'Location')}>
        <LocationCard place={place} state={locState} error={errors.address} onEditAddress={setAddress} onRetry={locate} onMove={moveTo} />
        <TextField label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={place.landmark ?? ''} onChangeText={setLandmark} placeholder={tr('مثلًا: قدام الجنينة جنب المدرسة', 'e.g. In front of the park, next to the school')} testID="landmark-input" />
      </FormSection>

      <FormSection title={tr('اختار الميعاد', 'Pick a time')} hint={tr('الخدمة من الأحد للخميس', 'Available Sunday to Thursday')} error={errors.day}>
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
        <TextField value={note} onChangeText={setNote} multiline rows={3} placeholder={tr('مثلًا: الفرع قريب من أسلاك الكهربا', 'e.g. The branch is close to power lines')} testID="tree-note" />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 24 },
  flex: { flex: 1 },
  free: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photoBox: { height: 150, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.statusReceivedBg },
  remove: { position: 'absolute', top: 8, end: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(22,22,22,0.72)', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
