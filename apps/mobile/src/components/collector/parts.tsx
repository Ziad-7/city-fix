import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CollectorJob, MaterialId, MaterialPrice, PickupItem } from '@/domain/citycycle';
import { demoPriceList, getMaterial, pricesAreDemo } from '@/domain/materials';
import { SLOTS } from '@/domain/services-catalog';
import type { SlotId } from '@/domain/types';
import { demoPricesLabel, materialLabel, slotLabel, tr as trNow, useTr } from '@/i18n';
import { API_MODE } from '@/services';
import { useCityCycle } from '@/store/useCityCycle';
import { colors, fonts, radius } from '@/theme/tokens';
import { formatDate } from '@/utils/time';
import { formatKg } from '@/utils/money';
import { AppText } from '../ui/AppText';
import { Icon } from '../Icon';

/** The district price list; in mock mode the demo list until the store has loaded one. */
export function usePriceList(): MaterialPrice[] {
  const prices = useCityCycle((s) => s.prices);
  return useMemo(() => (prices.length ? prices : API_MODE === 'mock' ? demoPriceList() : []), [prices]);
}

/** True when the prices shown are demo prices: every value then carries the "Demo prices" label. */
export function useDemoPrices(): boolean {
  const list = usePriceList();
  return useMemo(() => pricesAreDemo(list), [list]);
}

/** Small gold label "أسعار تجريبية" / "Demo prices". */
export function DemoTag() {
  useTr();
  return (
    <View style={styles.demo} accessibilityLabel={demoPricesLabel()}>
      <AppText variant="caption" color={colors.goldDeep} style={styles.demoText}>{demoPricesLabel()}</AppText>
    </View>
  );
}

/** Gold chip "وضع الجامع" / "Collector mode" for the screen headers. */
export function ModeChip() {
  const tr = useTr();
  return (
    <View style={styles.modeChip} accessibilityLabel={tr('وضع الجامع', 'Collector mode')}>
      <Icon name="truck" size={16} color={colors.ink} />
      <AppText variant="caption" color={colors.ink} style={styles.modeText}>{tr('وضع الجامع', 'Collector mode')}</AppText>
    </View>
  );
}

/** One material with its icon and an optional amount, as a pill. */
export function MaterialPill({ materialId, kg, tone = 'plain' }: { materialId: MaterialId; kg?: number; tone?: 'plain' | 'selected' }) {
  useTr();
  const m = getMaterial(materialId);
  const on = tone === 'selected';
  return (
    <View style={[styles.pill, on ? styles.pillOn : null]}>
      <Icon name={m.icon} size={18} color={on ? colors.onRed : colors.ink} />
      <AppText variant="smallStrong" color={on ? colors.onRed : colors.ink}>
        {materialLabel(materialId)}
      </AppText>
      {kg !== undefined ? <AppText variant="small" color={on ? colors.onRed : colors.inkMuted}>{formatKg(kg)}</AppText> : null}
    </View>
  );
}

export function ItemsRow({ items }: { items: readonly PickupItem[] }) {
  return (
    <View style={styles.wrap}>
      {items.map((i) => (
        <MaterialPill key={i.materialId} materialId={i.materialId} kg={i.estimatedKg} />
      ))}
    </View>
  );
}

/** "اليوم، ٩ ص – ١٢ ظ" style label for the day and slot of a job. */
export function whenLabel(job: Pick<CollectorJob, 'day' | 'slot'>): string {
  const tr = trNow;
  const slot = SLOTS.find((s) => s.id === (job.slot as SlotId));
  return `${formatDate(`${job.day}T12:00:00`)}${slot ? `${tr('، ', ', ')}${slotLabel(slot)}` : ''}`;
}

const styles = StyleSheet.create({
  demo: { alignSelf: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  demoText: { fontFamily: fonts.sans600 },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 32 },
  modeText: { fontFamily: fonts.sans700 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 12, minHeight: 40 },
  pillOn: { backgroundColor: colors.red, borderColor: colors.red },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
