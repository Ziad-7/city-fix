import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText, Button } from '@/components/ui';
import type { IconName } from '@/domain/types';
import { colors } from '@/theme/tokens';

type Props = {
  icon?: IconName;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
  tone?: 'neutral' | 'error';
};

/** Centered loading / empty / error block with an optional action. */
export function StateMessage({ icon = 'info', title, body, actionLabel, onAction, loading, tone = 'neutral' }: Props) {
  const fg = tone === 'error' ? colors.urgent : colors.red;
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.badge, { backgroundColor: tone === 'error' ? colors.urgentSoft : colors.redSoft }]}>
        {loading ? <ActivityIndicator color={fg} /> : <Icon name={icon} size={28} color={fg} />}
      </View>
      <AppText variant="h3" center>{title}</AppText>
      {body ? <AppText variant="small" color={colors.inkMuted} center>{body}</AppText> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} fullWidth={false} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 16 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  action: { marginTop: 8, alignSelf: 'center' },
});
