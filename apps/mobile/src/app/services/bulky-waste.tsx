import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { itemLabel, paymentLabelFor, placeName, slotLabel, useTr, FEE_LABEL_EN } from '@/i18n';
import { DayTile, FormSection, gridStyles } from '@/components/services';
import { AppText, Button, ChoiceChip, Screen, ScreenHeader, TextField } from '@/components/ui';
import { bulkyBookingSchema, placeSchema } from '@/domain/schemas';
import { BULKY_ITEMS, FEE_LABEL, PAYMENT_METHODS, SLOTS, nextWorkingDays } from '@/domain/services-catalog';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { PaymentMethod, SlotId } from '@/domain/types';
import { useServiceRequests, useSession } from '@/store';
import { colors } from '@/theme/tokens';

type Errors = Partial<Record<'items' | 'day' | 'address', string>>;

/** Bulky-waste pickup booking: items, day + slot, payment, address. */
export default function BulkyWasteScreen() {
  const tr = useTr();
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const bookService = useServiceRequests((s) => s.bookService);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [items, setItems] = useState<string[]>([]);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [address, setAddress] = useState(`${placeName(district)}${tr('، ', ', ')}${placeName(governorate)}`);
  const [landmark, setLandmark] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleItem = (item: string) => {
    setItems((cur) => (cur.includes(item) ? cur.filter((i) => i !== item) : [...cur, item]));
    setErrors((e) => ({ ...e, items: undefined }));
  };

  const submit = async () => {
    const next: Errors = {};
    const parsed = bulkyBookingSchema.safeParse({ items, day, slot, payment });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === 'items' ? 'items' : 'day';
        next[key] ??= key === 'items' ? tr('اختار حاجة واحدة على الأقل', 'Choose at least one item') : tr('اختار اليوم', 'Choose a day');
      }
    }
    const center = findDistrict(governorate, district) ?? DEFAULT_PLACE;
    const place = placeSchema.safeParse({ lat: center.lat, lng: center.lng, address: address.trim(), landmark: landmark.trim() || undefined });
    if (!place.success) next.address = tr('اكتب العنوان', 'Enter the address');
    setErrors(next);
    setSubmitError(null);
    if (!parsed.success || !place.success) return;

    setBusy(true);
    try {
      const req = await bookService({ serviceType: 'bulky_waste', details: parsed.data, location: place.data });
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : tr('معرفناش نحجز الميعاد، جرّب تاني', 'We couldn’t book your slot. Please try again.'));
      setBusy(false);
    }
  };

  return (
    <Screen
      avoidKeyboard
      header={<ScreenHeader title={tr('رفع مخلفات كبيرة', 'Bulky waste pickup')} />}
      gap={20}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {submitError ? <AppText variant="caption" color={colors.urgent} center accessibilityLiveRegion="polite">{submitError}</AppText> : null}
          <Button label={tr('احجز الميعاد', 'Book a slot')} onPress={submit} loading={busy} testID="book-submit" />
        </View>
      }
    >
      <AppText variant="small" color={colors.inkMuted}>{tr('عفش قديم، أجهزة، مخلفات بناء · بنوصلك خلال ٤٨ ساعة من الميعاد.', 'Old furniture, appliances, building waste · we’ll reach you within 48 hours of your chosen day.')}</AppText>

      <FormSection title={tr('إيه اللي محتاج يترفع؟', 'What needs to be picked up?')} error={errors.items}>
        <View style={gridStyles.wrap}>
          {BULKY_ITEMS.map((it) => (
            <ChoiceChip key={it} label={itemLabel(it)} check selected={items.includes(it)} onPress={() => toggleItem(it)} testID={`item-${it}`} />
          ))}
        </View>
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

      <FormSection title={tr('طريقة الدفع', 'Payment method')} hint={`${tr('الرسوم', 'Fee')}: ${tr(FEE_LABEL, FEE_LABEL_EN)}`}>
        <View style={gridStyles.wrap}>
          {PAYMENT_METHODS.map((p) => (
            <View key={p.id} style={gridStyles.half}>
              <ChoiceChip label={paymentLabelFor(p)} selected={payment === p.id} onPress={() => setPayment(p.id)} testID={`pay-${p.id}`} />
            </View>
          ))}
        </View>
      </FormSection>

      <FormSection title={tr('العنوان', 'Address')}>
        <TextField label={tr('المنطقة', 'Area')} value={address} onChangeText={(t) => { setAddress(t); setErrors((e) => ({ ...e, address: undefined })); }} error={errors.address} testID="address-input" />
        <TextField label={tr('علامة مميزة (اختياري)', 'Landmark (optional)')} value={landmark} onChangeText={setLandmark} placeholder={tr('مثلًا: عمارة ١٢ جنب الصيدلية', 'e.g. Building 12, next to the pharmacy')} testID="landmark-input" />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
