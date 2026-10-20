import { StyleSheet, Switch, View } from 'react-native';
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

/** Icon + title + subtitle + switch (data saver, WhatsApp updates, blur faces, anonymous). */
export function ToggleRow({ icon, title, subtitle, value, onValueChange, bare, testID }: ToggleRowProps) {
  return (
    <View style={[styles.row, bare ? null : styles.boxed]}>
      <Icon name={icon} size={20} color={colors.red} />
      <View style={styles.text}>
        <AppText variant="smallStrong">{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.inkMuted}>{subtitle}</AppText> : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={title}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.line, true: colors.red }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxed: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  text: { flex: 1, minWidth: 0 },
});
