import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTr } from '@/i18n';
import { switchMode } from '@/store/actions';
import { useCanUseCollectorMode } from '@/store/useSession';
import { colors } from '@/theme/tokens';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Icon } from '../Icon';

/**
 * Profile entry: "اشتغل كجامع / Work as a collector". Only when collector mode is available for the account
 * (mock mode: always, for the demo collector; API mode: when the account has the `collector` role).
 */
export function CollectorModeCard() {
  const tr = useTr();
  const can = useCanUseCollectorMode();
  const [busy, setBusy] = useState(false);
  if (!can) return null;
  return (
    <Card rounded="lg" padding={16} style={styles.card} testID="collector-mode-card">
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="truck" size={26} color={colors.ink} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" accessibilityRole="header">{tr('اشتغل كجامع', 'Work as a collector')}</AppText>
          <AppText variant="small" color={colors.inkMuted}>
            {tr('شوف طلبات الفرز القريبة منك، استلم الخامات ووزّنها واعرف أرباحك.', 'See recycling pickups near you, collect and weigh the materials, and track your earnings.')}
          </AppText>
        </View>
      </View>
      <Button
        label={tr('اشتغل كجامع', 'Work as a collector')}
        variant="gold"
        icon="truck"
        loading={busy}
        onPress={() => {
          setBusy(true);
          void switchMode('collector').finally(() => setBusy(false));
        }}
        testID="switch-to-collector"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
