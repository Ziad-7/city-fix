import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTr, useIsRTL } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';

type Props = { value: string; onChangeText: (t: string) => void; placeholder?: string };

/** 48 px pill search field from Services.html. */
export function SearchField({ value, onChangeText, placeholder }: Props) {
  const tr = useTr();
  const rtl = useIsRTL();
  return (
    <View style={styles.field}>
      <Icon name="search" size={20} color={colors.inkMuted} />
      <TextInput
        accessibilityLabel={tr('ابحث عن خدمة', 'Search services')}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? tr('ابحث عن خدمة…', 'Search services…')}
        placeholderTextColor={colors.inkMuted}
        returnKeyType="search"
        style={[styles.input, rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left', writingDirection: 'ltr' }]}
        testID="service-search"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={tr('مسح البحث', 'Clear search')} onPress={() => onChangeText('')} hitSlop={10} style={styles.clear}>
          <Icon name="x" size={18} color={colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { height: 48, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.sans400, fontSize: 15, color: colors.ink, outlineStyle: 'none' } as object,
  clear: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
