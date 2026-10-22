import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { MATERIALS, formatKg, formatPrice, materialLabel, priceOf, type MaterialId, type MaterialPrice, type PickupItem } from '@/domain/citycycle';
import { useLang } from '@/i18n';
import { colors, radius } from '@/theme/tokens';

/** Round icon badge for a material. */
export function MaterialBadge({ id, size = 40, on }: { id: MaterialId; size?: number; on?: boolean }) {
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, on ? styles.badgeOn : null]}>
      <Icon name={MATERIALS[id].icon} size={Math.round(size * 0.55)} color={on ? colors.onRed : colors.red} />
    </View>
  );
}

type GridProps = {
  materials: readonly MaterialId[];
  selected: ReadonlySet<MaterialId>;
  prices: readonly MaterialPrice[];
  onToggle: (id: MaterialId) => void;
};

/** Two-column picker: icon, name, the district price (or "price to be set"), a check when chosen. */
export function MaterialGrid({ materials, selected, prices, onToggle }: GridProps) {
  useLang();
  return (
    <View style={styles.grid} accessibilityRole="list">
      {materials.map((id) => {
        const on = selected.has(id);
        const price = priceOf(prices, id);
        return (
          <Pressable
            key={id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${materialLabel(id)}, ${formatPrice(price)}`}
            onPress={() => onToggle(id)}
            style={[styles.cell, on ? styles.cellOn : styles.cellOff]}
            testID={`material-${id}`}
          >
            <MaterialBadge id={id} on={on} />
            <View style={styles.cellText}>
              <AppText variant="smallStrong" numberOfLines={2}>{materialLabel(id)}</AppText>
              <AppText variant="caption" color={price === null ? colors.goldDeep : colors.inkMuted}>{formatPrice(price)}</AppText>
            </View>
            {on ? <Icon name="check" size={18} color={colors.red} strokeWidth={3} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Read-only list: icon, name, estimated weight and the price per kg. */
export function MaterialLines({ items, prices }: { items: readonly PickupItem[]; prices?: readonly MaterialPrice[] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => (
        <View key={it.materialId} style={styles.line}>
          <MaterialBadge id={it.materialId} size={36} />
          <View style={styles.cellText}>
            <AppText variant="smallStrong">{materialLabel(it.materialId)}</AppText>
            {prices ? <AppText variant="caption" color={colors.inkMuted}>{formatPrice(priceOf(prices, it.materialId))}</AppText> : null}
          </View>
          <AppText variant="smallStrong">{formatKg(it.estimatedKg)}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.red },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64, padding: 10, borderRadius: radius.md },
  cellOn: { backgroundColor: colors.redSoft, borderWidth: 2, borderColor: colors.red },
  cellOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  cellText: { flex: 1, minWidth: 0, gap: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
