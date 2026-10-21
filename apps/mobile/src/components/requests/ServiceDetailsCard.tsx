import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { FEE_LABEL, FREE_SERVICE_LABEL } from '@/domain/services-catalog';
import type { ServiceRequest } from '@/domain/types';
import { useTr } from '@/i18n';
import { FEE_LABEL_EN, FREE_SERVICE_LABEL_EN, itemLabel } from '@/i18n/labels';
import { colors, fonts } from '@/theme/tokens';
import { dayText, paymentLabel, slotLabel } from './labels';

/** Booking details of a service request: items, day, slot, payment, fee, address. */
export function ServiceDetailsCard({ request }: { request: ServiceRequest }) {
  const tr = useTr();
  const { details, location } = request;
  const free = !details.payment;
  const items = details.items.map(itemLabel).join(tr('، ', ', '));
  const rows: { label: string; value: string }[] = [
    free
      ? { label: tr('نوع الشغل', 'Type of work'), value: details.workType ? itemLabel(details.workType) : items }
      : { label: tr('اللي هيترفع', 'Items'), value: items },
    { label: tr('اليوم', 'Day'), value: dayText(details.day) },
    { label: tr('الفترة', 'Time slot'), value: slotLabel(details.slot) },
    { label: tr('طريقة الدفع', 'Payment'), value: paymentLabel(details.payment) },
    { label: tr('الرسوم', 'Fee'), value: free ? tr(FREE_SERVICE_LABEL, FREE_SERVICE_LABEL_EN) : tr(FEE_LABEL, FEE_LABEL_EN.charAt(0).toUpperCase() + FEE_LABEL_EN.slice(1)) },
    { label: tr('العنوان', 'Address'), value: [location.address, location.landmark].filter(Boolean).join(' · ') },
    ...(details.note ? [{ label: tr('ملاحظة', 'Note'), value: details.note }] : []),
  ];
  const heading = tr('تفاصيل الحجز', 'Booking details');
  return (
    <Card rounded="lg" padding={16} accessibilityLabel={heading}>
      <AppText style={styles.heading} accessibilityRole="header">{heading}</AppText>
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
