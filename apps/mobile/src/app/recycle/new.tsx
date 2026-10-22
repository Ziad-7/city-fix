import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useReportLocation } from '@/components/report/location';
import { LocationCard } from '@/components/report/ReportParts';
import {
  EstimateBar,
  KgStepper,
  MaterialTile,
  PickupPhoto,
  WasteSuggestion,
  applySuggestion,
  hasErrors,
  selectionToItems,
  toggleMaterial,
  validatePickupForm,
  type KgSelection,
  type PickupFormErrors,
  type SuggestionState,
} from '@/components/recycle';
import { DayTile, FormSection, gridStyles } from '@/components/services';
import { AppText, Button, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import type { PickupMode, WasteClassification } from '@/domain/citycycle';
import { MATERIALS } from '@/domain/materials';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import { SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { slotLabel, tr as trNow, useTr } from '@/i18n';
import { useCityCycle, useSession } from '@/store';
import { colors, radius } from '@/theme/tokens';

/** طلب استلام خامات: materials, approximate kg, optional photo + AI check, place, day and slot, free or paid. */
export default function NewPickupScreen() {
  const tr = useTr();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const dataSaver = useSession((s) => s.prefs.dataSaver);
  const createPickup = useCityCycle((s) => s.createPickup);
  const classifyPhoto = useCityCycle((s) => s.classifyPhoto);

  const fallbackCenter = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);
  const { place, state: locState, locate, moveTo, setAddress, setLandmark } = useReportLocation(fallbackCenter);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [sel, setSel] = useState<KgSelection>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [ai, setAi] = useState<{ state: SuggestionState; result: WasteClassification | null; applied: boolean }>({ state: 'idle', result: null, applied: false });
  const [day, setDay] = useState<string | null>(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [mode, setMode] = useState<PickupMode>('paid');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<PickupFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => selectionToItems(sel), [sel]);
  const clear = (key: keyof PickupFormErrors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const changePhoto = (uri: string | null) => {
    setPhoto(uri);
    setAi({ state: 'idle', result: null, applied: false }); // a new photo needs a new check
  };

  const runCheck = useCallback(async () => {
    if (!photo) return;
    setAi({ state: 'loading', result: null, applied: false });
    const result = await classifyPhoto(photo); // never rejects: a failure is a "fallback" answer
    setAi({ state: 'ready', result, applied: false });
  }, [photo, classifyPhoto]);

  const applyAi = () => {
    if (!ai.result) return;
    setSel((cur) => applySuggestion(cur, ai.result as WasteClassification));
    setAi((cur) => ({ ...cur, applied: true }));
    clear('items');
    clear('kg');
  };

  const submit = async () => {
    const found = validatePickupForm({ items, address: place.address, day });
    setErrors(found);
    setSubmitError(null);
    if (hasErrors(found) || !day) return;
    setBusy(true);
    try {
      const pickup = await createPickup({
        items,
        photoUris: photo ? [photo] : [],
        location: { lat: place.lat, lng: place.lng, address: place.address.trim(), landmark: place.landmark?.trim() || undefined },
        day,
        slot,
        mode,
        note: note.trim() || undefined,
      });
      router.replace({ pathname: '/recycle/success', params: { id: pickup.id } });
    } catch (e) {
      // Offline gives the store's clear message (pickups are not queued); other errors keep their own text.
      setSubmitError(e instanceof Error && e.message ? e.message : trNow('معرفناش نبعت الطلب، جرّب تاني.', "We couldn't send your request. Try again."));
      setBusy(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const chosen = MATERIALS.filter((m) => sel[m.id] !== undefined);

  return (
    <Screen
      avoidKeyboard
      header={<ScreenHeader title={tr('طلب استلام خامات', 'Recycling pickup')} />}
      gap={20}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <EstimateBar items={items} mode={mode} />
          {submitError ? <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{submitError}</AppText> : null}
          {!submitError && errorCount > 0 ? (
            <AppText accessibilityRole="alert" variant="caption" color={colors.urgent} center>{tr('راجع الحقول اللي متعلّمة بالأحمر.', 'Check the fields marked in red.')}</AppText>
          ) : null}
          <Button testID="pickup-submit" label={tr('ابعت الطلب', 'Send request')} icon="arrow-forward" iconPosition="end" loading={busy} onPress={submit} />
        </View>
      }
    >
      <AppText variant="small" color={colors.inkMuted}>
        {tr('اختار الخامات، وجامع معتمد هيعدّي ياخدها ويوزنها قدامك.', 'Choose your materials. A verified collector will come, weigh them in front of you and take them.')}
      </AppText>

      <FormSection title={tr('إيه اللي هتسلّمه؟', 'What are you handing over?')} error={errors.items}>
        <View style={gridStyles.wrap}>
          {MATERIALS.map((m) => (
            <MaterialTile
              key={m.id}
              id={m.id}
              selected={sel[m.id] !== undefined}
              onPress={() => {
                setSel((cur) => toggleMaterial(cur, m.id));
                clear('items');
                clear('kg');
              }}
              testID={`material-${m.id}`}
            />
          ))}
        </View>
        <Pressable testID="open-guide" accessibilityRole="link" accessibilityLabel={tr('دليل الفرز بالصور', 'Picture guide to sorting')} onPress={() => router.push('/recycle/guide')} style={styles.guideLink}>
          <Icon name="info" size={18} color={colors.red} />
          <AppText variant="smallStrong" color={colors.red} style={{ flex: 1 }}>{tr('مش متأكد تفرز إزاي؟ شوف دليل الفرز بالصور', 'Not sure how to sort? See the picture guide')}</AppText>
          <Icon name="chevron" size={16} color={colors.red} />
        </Pressable>
      </FormSection>

      {chosen.length > 0 ? (
        <FormSection title={tr('الوزن التقريبي', 'Approximate weight')} hint={tr('تقدير بس. الجامع هيوزن الوزن الفعلي.', 'Just an estimate. The collector weighs the real amount.')} error={errors.kg}>
          <View style={{ gap: 8 }}>
            {chosen.map((m) => (
              <KgStepper
                key={m.id}
                id={m.id}
                kg={sel[m.id] as number}
                onChange={(kg) => setSel((cur) => ({ ...cur, [m.id]: kg }))}
                onRemove={() => setSel((cur) => toggleMaterial(cur, m.id))}
              />
            ))}
          </View>
        </FormSection>
      ) : null}

      <FormSection title={tr('صورة (اختياري)', 'Photo (optional)')} hint={tr('الصورة بتساعد الجامع يجهّز نفسه.', 'A photo helps the collector get ready.')}>
        <PickupPhoto uri={photo} onChange={changePhoto} quality={dataSaver ? 0.4 : 0.6} />
        {photo ? (
          <Button testID="ai-check" label={tr('افحص الصورة بالذكاء الاصطناعي', 'Check the photo with AI')} icon="sparkles" variant="secondary" size="sm" loading={ai.state === 'loading'} onPress={runCheck} />
        ) : null}
        <WasteSuggestion state={ai.state} result={ai.result} applied={ai.applied} onApply={applyAi} />
      </FormSection>

      <FormSection title={tr('المكان', 'Where')}>
        <LocationCard place={place} state={locState} error={errors.address} onEditAddress={(a) => { setAddress(a); clear('address'); }} onRetry={locate} onMove={moveTo} />
        <TextField testID="landmark-input" label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={place.landmark ?? ''} onChangeText={setLandmark} placeholder={tr('مثلًا: عمارة ١٢ جنب الصيدلية', 'e.g. Building 12, next to the pharmacy')} />
      </FormSection>

      <FormSection title={tr('اختار الميعاد', 'Pick a time')} hint={tr('من الأحد للخميس', 'Sunday to Thursday')} error={errors.day}>
        <View style={gridStyles.wrap}>
          {days.map((d) => (
            <DayTile key={d} day={d} selected={day === d} onPress={() => { setDay(d); clear('day'); }} />
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

      <FormSection title={tr('تسلّمها إزاي؟', 'How do you want to hand them over?')}>
        <View style={styles.modes}>
          <ModeCard
            testID="mode-free"
            selected={mode === 'free'}
            title={tr('اتبرّع بيها', 'Give for free')}
            body={tr('من غير مقابل. بتروح لإعادة التدوير.', 'No payment. It goes to recycling.')}
            onPress={() => setMode('free')}
          />
          <ModeCard
            testID="mode-paid"
            selected={mode === 'paid'}
            title={tr('بمقابل فلوس', 'Get paid')}
            body={tr('الجامع بيدفعلك كاش على الوزن الفعلي.', 'The collector pays you cash for the weighed amount.')}
            onPress={() => setMode('paid')}
          />
        </View>
      </FormSection>

      <FormSection title={tr('ملحوظة (اختياري)', 'Note (optional)')}>
        <TextField testID="note-input" value={note} onChangeText={setNote} multiline rows={2} maxLength={300} placeholder={tr('مثلًا: الخامات قدام باب العمارة', 'e.g. The materials are by the building door')} />
      </FormSection>
    </Screen>
  );
}

function ModeCard({ selected, title, body, onPress, testID }: { selected: boolean; title: string; body: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={[styles.mode, selected ? styles.modeOn : styles.modeOff]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.red : colors.inkMuted }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="smallStrong" color={selected ? colors.redDeep : colors.ink}>{title}</AppText>
        <AppText variant="caption" color={colors.inkMuted}>{body}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
  guideLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 4 },
  modes: { gap: 8 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderRadius: radius.md, padding: 12 },
  modeOn: { backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 2 },
  modeOff: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
});
