import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);
  const bookService = useServiceRequests((s) => s.bookService);

  const days = useMemo(() => nextWorkingDays(6), []);
  const [items, setItems] = useState<string[]>([]);
  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState<SlotId>('morning');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [address, setAddress] = useState(`${district}، ${governorate}`);
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
        next[key] ??= issue.message;
      }
    }
    const center = findDistrict(governorate, district) ?? DEFAULT_PLACE;
    const place = placeSchema.safeParse({ lat: center.lat, lng: center.lng, address: address.trim(), landmark: landmark.trim() || undefined });
    if (!place.success) next.address = place.error.issues[0].message;
    setErrors(next);
    setSubmitError(null);
    if (!parsed.success || !place.success) return;

    setBusy(true);
    try {
      const req = await bookService({ serviceType: 'bulky_waste', details: parsed.data, location: place.data });
      router.replace(`/requests/${req.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'معرفناش نحجز الميعاد، جرّب تاني');
      setBusy(false);
    }
  };

  return (
    <Screen
      header={<ScreenHeader title="رفع مخلفات كبيرة" />}
      gap={20}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {submitError ? <AppText variant="caption" color={colors.urgent} center accessibilityLiveRegion="polite">{submitError}</AppText> : null}
          <Button label="احجز الميعاد" onPress={submit} loading={busy} testID="book-submit" />
        </View>
      }
    >
      <AppText variant="small" color={colors.inkMuted}>عفش قديم، أجهزة، مخلفات بناء · بنوصلك خلال ٤٨ ساعة من الميعاد.</AppText>

      <FormSection title="إيه اللي محتاج يترفع؟" error={errors.items}>
        <View style={gridStyles.wrap}>
          {BULKY_ITEMS.map((it) => (
            <ChoiceChip key={it} label={it} check selected={items.includes(it)} onPress={() => toggleItem(it)} testID={`item-${it}`} />
          ))}
        </View>
      </FormSection>

      <FormSection title="اختار الميعاد" hint="الخدمة من الأحد للخميس" error={errors.day}>
        <View style={gridStyles.wrap}>
          {days.map((d) => (
            <DayTile key={d} day={d} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </View>
        <View style={gridStyles.wrap}>
          {SLOTS.map((s) => (
            <View key={s.id} style={gridStyles.half}>
              <ChoiceChip label={s.labelAr} selected={slot === s.id} onPress={() => setSlot(s.id)} testID={`slot-${s.id}`} />
            </View>
          ))}
        </View>
      </FormSection>

      <FormSection title="طريقة الدفع" hint={`الرسوم: ${FEE_LABEL}`}>
        <View style={gridStyles.wrap}>
          {PAYMENT_METHODS.map((p) => (
            <View key={p.id} style={gridStyles.half}>
              <ChoiceChip label={p.labelAr} selected={payment === p.id} onPress={() => setPayment(p.id)} testID={`pay-${p.id}`} />
            </View>
          ))}
        </View>
      </FormSection>

      <FormSection title="العنوان">
        <TextField label="المنطقة" value={address} onChangeText={(t) => { setAddress(t); setErrors((e) => ({ ...e, address: undefined })); }} error={errors.address} testID="address-input" />
        <TextField label="علامة مميزة (اختياري)" value={landmark} onChangeText={setLandmark} placeholder="مثلًا: عمارة ١٢ جنب الصيدلية" testID="landmark-input" />
      </FormSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 4, paddingBottom: 24 },
  footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8, backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
});
