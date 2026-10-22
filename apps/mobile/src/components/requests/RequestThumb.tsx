import { Image, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/domain/types';
import { colors, radius } from '@/theme/tokens';

type Props = {
  /** First report photo, when there is one. */
  uri?: string;
  icon: IconName;
  size?: number;
  /** Services get a red-soft tile so they read differently from reports; recycling pickups a green one. */
  tone?: 'report' | 'service' | 'recycle';
};

/** Photo thumbnail, or the category / service icon on a tile when there is no photo. */
export function RequestThumb({ uri, icon, size = 52, tone = 'report' }: Props) {
  if (uri) {
    return <Image accessibilityIgnoresInvertColors source={{ uri }} style={[styles.base, { width: size, height: size }]} />;
  }
  const bg = tone === 'service' ? colors.redSoft : tone === 'recycle' ? colors.statusResolvedBg : colors.statusReceived;
  const fg = tone === 'service' ? colors.red : tone === 'recycle' ? colors.statusResolved : colors.iconMuted;
  return (
    <View style={[styles.base, styles.tile, { width: size, height: size, backgroundColor: bg }]}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.sm, flexShrink: 0 },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
