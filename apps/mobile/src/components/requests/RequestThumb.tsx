import { Image, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import type { IconName } from '@/domain/types';
import { colors, radius } from '@/theme/tokens';

type Props = {
  /** First report photo, when there is one. */
  uri?: string;
  icon: IconName;
  size?: number;
  /** Services get a red-soft tile so they read differently from reports. */
  tone?: 'report' | 'service';
};

/** Photo thumbnail, or the category / service icon on a tile when there is no photo. */
export function RequestThumb({ uri, icon, size = 52, tone = 'report' }: Props) {
  if (uri) {
    return <Image accessibilityIgnoresInvertColors source={{ uri }} style={[styles.base, { width: size, height: size }]} />;
  }
  const service = tone === 'service';
  return (
    <View style={[styles.base, styles.tile, { width: size, height: size, backgroundColor: service ? colors.redSoft : colors.statusReceived }]}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={service ? colors.red : '#C9D1D4'} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.sm, flexShrink: 0 },
  tile: { alignItems: 'center', justifyContent: 'center' },
});
