import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { binDisplayState } from '@/domain/bins';
import type { BinMapProps } from './types';
import { BinRow } from './BinRow';
import { useTr } from '@/i18n';
import { colors, radius } from '@/theme/tokens';
import { haversineM } from '@/utils/geo';

/** Web preview stand-in: react-native-maps does not support web, so the bins show as a list (nearest first). */
export function BinMap({ bins, selectedId, onSelectBin, center, style }: BinMapProps) {
  const tr = useTr();
  const rows = bins
    .map((bin) => ({ bin, distanceM: haversineM(center, bin.location) }))
    .sort((a, b) => a.distanceM - b.distanceM);
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.banner}>
        <Icon name="map" size={18} color={colors.inkMuted} />
        <AppText variant="caption" color={colors.inkMuted}>
          {tr('الخريطة بتشتغل على الموبايل. دي قائمة بالصناديق القريبة.', 'The map works on your phone. Here is a list of nearby bins.')}
        </AppText>
      </View>
      {rows.map(({ bin, distanceM }) => (
        <BinRow key={bin.id} bin={bin} state={binDisplayState(bin)} distanceM={distanceM} selected={selectedId === bin.id} onPress={() => onSelectBin?.(bin.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.paper, padding: 4, gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
});
