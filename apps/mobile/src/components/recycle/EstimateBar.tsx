import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import type { PickupItem, PickupMode } from '@/domain/citycycle';
import { totalEstimatedKg } from '@/domain/materials';
import { demoPricesLabel, priceToBeSetLabel, useTr } from '@/i18n';
import { useEstimate } from '@/store';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatEgp, formatKg } from '@/utils/money';

/** Sticky "القيمة التقديرية": estimated EGP from the district price list, the "Demo prices" label, or "price to be set". */
export function EstimateBar({ items, mode }: { items: readonly PickupItem[]; mode: PickupMode }) {
  const tr = useTr();
  const { valueEgp, partial, demo } = useEstimate(items);
  const kg = totalEstimatedKg(items);

  let value: string;
  let note: string | null = null;
  if (items.length === 0) value = '—';
  else if (valueEgp === undefined) value = priceToBeSetLabel();
  else if (partial) {
    value = tr(`من ${formatEgp(valueEgp)}`, `From ${formatEgp(valueEgp)}`);
    note = tr('وباقي الخامات السعر هيتحدد', 'Price to be set for the other materials');
  } else value = formatEgp(valueEgp);

  const caption = mode === 'free' ? tr('القيمة التقديرية (هتتبرّع بيها)', 'Estimated value (you give it for free)') : tr('القيمة التقديرية', 'Estimated value');
  return (
    <View style={styles.bar} testID="estimate-bar" accessible accessibilityLabel={`${caption}: ${value}${items.length ? `, ${formatKg(kg)}` : ''}`}>
      <View style={styles.main}>
        <AppText variant="caption" color={colors.inkMuted}>{caption}</AppText>
        <AppText style={styles.value} testID="estimate-value">{value}</AppText>
        {note ? <AppText variant="caption" color={colors.inkMuted}>{note}</AppText> : null}
      </View>
      <View style={styles.side}>
        {items.length > 0 ? <AppText variant="smallStrong">{formatKg(kg)}</AppText> : null}
        {items.length > 0 && valueEgp !== undefined && demo ? (
          <View style={styles.demo}>
            <AppText variant="caption" color={colors.goldDeep} style={{ fontFamily: fonts.sans600 }}>{demoPricesLabel()}</AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.paper },
  main: { flex: 1, minWidth: 0 },
  value: { fontFamily: fonts.display700, fontSize: 20, lineHeight: 28, color: colors.ink },
  side: { alignItems: 'flex-end', gap: 4 },
  demo: { backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
});
