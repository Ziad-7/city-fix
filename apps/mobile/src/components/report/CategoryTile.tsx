import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import type { Category } from '@/domain/types';
import { labelOfCategory, useLang, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';

/** Category grid tile: icon disc, name, and the red "خطر" tag for life-threatening categories. */
export function CategoryTile({ category, onPress, selected }: { category: Category; onPress: () => void; selected?: boolean }) {
  const tr = useTr();
  const lang = useLang();
  const label = labelOfCategory(category);
  const neutral = category.id === 'other';
  const disc = neutral ? { bg: colors.statusReceivedBg, fg: colors.statusReceived } : { bg: colors.redSoft, fg: category.danger ? colors.redDeep : colors.red };
  return (
    <Pressable
      testID={`category-${category.id}`}
      accessibilityRole="button"
      accessibilityLabel={category.danger ? `${label}${tr('، خطر', ' — danger')}` : label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected ? styles.tileOn : styles.tileOff, pressed ? { opacity: 0.85 } : null]}
    >
      {category.danger ? (
        <View style={[styles.tag, lang === 'en' ? styles.tagEn : null]}>
          <AppText color={colors.onRed} style={styles.tagText}>{tr('خطر', 'Danger')}</AppText>
        </View>
      ) : null}
      <View style={[styles.disc, { backgroundColor: disc.bg }]}>
        <Icon name={category.icon} size={22} color={disc.fg} />
      </View>
      <AppText center style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: 104, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 6 },
  tileOff: { borderWidth: 1, borderColor: colors.line },
  tileOn: { borderWidth: 2, borderColor: colors.red },
  tag: { position: 'absolute', top: 6, end: 6, height: 18, paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.urgent, justifyContent: 'center' },
  // "Danger" is wider than "خطر": tuck it into the corner so it clears the icon disc.
  tagEn: { top: 4, end: 4, paddingHorizontal: 5, zIndex: 1 },
  tagText: { fontFamily: fonts.sans700, fontSize: 10, lineHeight: 14 },
  disc: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 19 },
});
