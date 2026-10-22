import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import type { MaterialId } from '@/domain/citycycle';
import { getMaterial } from '@/domain/materials';
import { materialLabel, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';

type Props = { id: MaterialId; selected: boolean; onPress: () => void; testID?: string };

/** Picture tile of a material: big icon, short label, a check when chosen. Three per row on a phone. */
export function MaterialTile({ id, selected, onPress, testID }: Props) {
  const tr = useTr();
  const label = materialLabel(id);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={selected ? tr('اضغط تاني عشان تشيلها', 'Tap again to remove it') : tr('اضغط عشان تضيفها', 'Tap to add it')}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, selected ? styles.on : styles.off, pressed ? { opacity: 0.85 } : null]}
    >
      <View style={[styles.disc, { backgroundColor: selected ? colors.red : colors.redSoft }]}>
        <Icon name={getMaterial(id).icon} size={28} color={selected ? colors.onRed : colors.red} />
      </View>
      <AppText variant="smallStrong" center color={selected ? colors.redDeep : colors.ink} style={styles.label} numberOfLines={2}>
        {label}
      </AppText>
      {selected ? (
        <View style={styles.check}>
          <Icon name="check" size={12} color={colors.onRed} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '31.5%', flexGrow: 0, minHeight: 112, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 6 },
  on: { backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 2 },
  off: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
  disc: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.sans600, fontSize: 13, lineHeight: 20 },
  check: { position: 'absolute', top: 6, end: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
});
