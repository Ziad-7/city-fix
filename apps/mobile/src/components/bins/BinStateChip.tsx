import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { BIN_ICON, type BinDisplayState } from '@/domain/bins';
import { binStateLabel, useLang } from '@/i18n';
import { fonts, radius } from '@/theme/tokens';
import { binColors } from './style';

/** Pill with the state icon and word: the state is never colour-only. */
export function BinStateChip({ state }: { state: BinDisplayState }) {
  useLang();
  const c = binColors(state);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]} testID={`bin-state-${state}`}>
      <Icon name={BIN_ICON[state]} size={14} color={c.fg} strokeWidth={2} />
      <AppText variant="caption" color={c.fg} style={styles.text}>{binStateLabel(state)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.sans600 },
});
