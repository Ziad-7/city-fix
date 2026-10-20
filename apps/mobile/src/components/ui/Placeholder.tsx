import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { AppText } from './AppText';
import { Screen } from './Screen';
import { ScreenHeader } from './ScreenHeader';

/** Temporary screen body used by routes that Phase B replaces. */
export function Placeholder({ title, back = true }: { title: string; back?: boolean }) {
  return (
    <Screen scroll={false} edges={back ? ['top', 'bottom'] : ['top']} header={<ScreenHeader title={title} hideBack={!back} />}>
      <View style={styles.body}>
        <AppText variant="h3" color={colors.inkMuted}>قيد التنفيذ</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
