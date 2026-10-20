import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '@/theme/tokens';
import { AppText } from './AppText';

export type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  /** Content before the input, e.g. the "+20" country chip. */
  prefix?: React.ReactNode;
  /** Force left-to-right layout and text (phone numbers, codes). */
  ltr?: boolean;
  large?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Label above, 52 px field (14 px radius), red border on focus, inline error. */
export function TextField({
  label, value, onChangeText, placeholder, helper, error, keyboardType, maxLength, multiline, rows = 3,
  prefix, ltr, large, autoFocus, onSubmitEditing, style, testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.urgent : focused ? colors.red : colors.line;
  return (
    <View style={[styles.wrap, style]}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View
        style={[
          styles.field,
          { borderColor, borderWidth: focused || error ? 1.5 : 1 },
          multiline ? { minHeight: rows * 28 + 16, alignItems: 'flex-start' } : { height: 52 },
          ltr ? { direction: 'ltr' } : null,
        ]}
      >
        {prefix}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          autoFocus={autoFocus}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            { fontSize: large ? 17 : 15, letterSpacing: large ? 0.5 : 0 },
            ltr ? { textAlign: 'left', writingDirection: 'ltr' } : { textAlign: 'right', writingDirection: 'rtl' },
            multiline ? { paddingTop: 8 } : null,
          ]}
        />
      </View>
      {error ? (
        <AppText variant="caption" color={colors.urgent}>{error}</AppText>
      ) : helper ? (
        <AppText variant="caption" color={colors.inkMuted}>{helper}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 12, fontFamily: fonts.sans400, color: colors.ink, outlineStyle: 'none' } as object,
});
