import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsRTL } from '@/i18n';
import { colors, radius, shadows } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from '../Icon';

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  testID?: string;
};

/** Dropdown replacement: a 48 px field that opens a bottom-sheet list. */
export function SelectField({ label, value, options, onChange, testID }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const rtl = useIsRTL();
  const current = options.find((o) => o.value === value)?.label ?? value;
  return (
    <View style={styles.wrap}>
      <AppText variant="label">{label}</AppText>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${current}`} onPress={() => setOpen(true)} style={styles.field}>
        <AppText variant="small" style={styles.value} numberOfLines={1}>{current}</AppText>
        <Icon name="chevron-down" size={18} color={colors.inkMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.backdrop, { direction: rtl ? 'rtl' : 'ltr' }]} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { paddingBottom: 16 + insets.bottom }]}>
            <AppText variant="h3" style={styles.sheetTitle}>{label}</AppText>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => {
                const on = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    style={[styles.option, on ? styles.optionOn : null]}
                  >
                    <AppText variant={on ? 'bodyStrong' : 'body'} color={on ? colors.redDeep : colors.ink} style={styles.optionText}>{item.label}</AppText>
                    {on ? <Icon name="check" size={18} color={colors.red} strokeWidth={2.5} /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  field: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  value: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(22,22,22,0.4)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '70%', backgroundColor: colors.surface, borderTopStartRadius: radius.lg, borderTopEndRadius: radius.lg, paddingTop: 16, paddingBottom: 16, ...shadows.float },
  sheetTitle: { paddingHorizontal: 20, paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 20 },
  optionOn: { backgroundColor: colors.redSoft },
  optionText: { flex: 1 },
});
