import { Platform, StyleSheet, Switch, View, type SwitchProps } from 'react-native';
import type { IconName } from '@/domain/types';
import { colors, radius } from '@/theme/tokens';
import { AppText } from './AppText';
import { Icon } from '../Icon';

export type ToggleRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Flat white row (default) or no background when nested in a Card. */
  bare?: boolean;
  testID?: string;
};

// react-native-web only (types do not know it): the thumb colour while the switch is on (default teal).
const webThumb = (Platform.OS === 'web' ? { activeThumbColor: colors.surface } : {}) as Partial<SwitchProps>;

/** Icon + title + subtitle + switch (data saver, WhatsApp updates, blur faces, anonymous). */
export function ToggleRow({ icon, title, subtitle, value, onValueChange, bare, testID }: ToggleRowProps) {
  return (
    <View style={[styles.row, bare ? null : styles.boxed]}>
      <Icon name={icon} size={20} color={colors.red} />
      <View style={styles.text}>
        <AppText variant="smallStrong">{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.inkMuted}>{subtitle}</AppText> : null}
      </View>
      {/* react-native-web's Switch positions its thumb in left-to-right terms, so under dir="rtl" the thumb and the
          track drift apart. A left-to-right wrapper keeps them together; it is only applied on web. */}
      <View style={Platform.OS === 'web' ? styles.webSwitch : undefined}>
        <Switch
          testID={testID}
          accessibilityLabel={title}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.line, true: colors.red }}
          thumbColor={colors.surface}
          {...webThumb}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxed: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  text: { flex: 1, minWidth: 0 },
  webSwitch: { direction: 'ltr' },
});
