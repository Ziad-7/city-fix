import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { FEE_LABEL, FREE_SERVICE_LABEL } from '@/domain/services-catalog';
import type { ServiceRequest } from '@/domain/types';
import { colors, fonts } from '@/theme/tokens';
import { dayLabel } from '../services/day';
import { paymentLabel, slotLabel } from './labels';

/** Booking details of a service request: items, day, slot, payment, fee, address. */
export function ServiceDetailsCard({ request }: { request: ServiceRequest }) {
  const { details, location } = request;
  const free = !details.payment;
  const rows: { label: string; value: string }[] = [
    free
      ? { label: 'نوع الشغل', value: details.workType ?? details.items.join('، ') }
      : { label: 'اللي هيترفع', value: details.items.join('، ') },
    { label: 'اليوم', value: dayLabel(details.day) },
    { label: 'الفترة', value: slotLabel(details.slot) },
    { label: 'طريقة الدفع', value: paymentLabel(details.payment) },
    { label: 'الرسوم', value: free ? FREE_SERVICE_LABEL : FEE_LABEL },
    { label: 'العنوان', value: [location.address, location.landmark].filter(Boolean).join(' · ') },
    ...(details.note ? [{ label: 'ملاحظة', value: details.note }] : []),
  ];
  return (
    <Card rounded="lg" padding={16} accessibilityLabel="تفاصيل الحجز">
      <AppText style={styles.heading} accessibilityRole="header">تفاصيل الحجز</AppText>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.label} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}`}>
            <AppText variant="small" color={colors.inkMuted} style={styles.label}>{r.label}</AppText>
            <AppText variant="smallStrong" style={styles.value}>{r.value}</AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.display600, fontSize: 16, lineHeight: 24, marginBottom: 8, color: colors.ink },
  rows: { gap: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  label: { width: 88 },
  value: { flex: 1, minWidth: 0 },
});
