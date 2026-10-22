import { useEffect, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { AppText } from '@/components/ui';
import { BIN_ICON, binDisplayState } from '@/domain/bins';
import { binTitle, fillPercent } from '@/domain/bin-map';
import type { Bin } from '@/domain/citycycle';
import { binStateLabel, useTr } from '@/i18n';
import { colors, fonts, radius } from '@/theme/tokens';
import { binColors, pctText } from './style';
import type { BinMapProps } from './types';

/** Marker: a pill with the state icon and the fill %, so state and level are readable without colour. */
function BinPill({ bin, selected }: { bin: Bin; selected: boolean }) {
  const state = binDisplayState(bin);
  const c = binColors(state);
  const pct = fillPercent(bin);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.fg }, selected ? styles.pillOn : null]}>
      <Icon name={BIN_ICON[state]} size={selected ? 20 : 16} color={c.fg} strokeWidth={2.2} />
      {pct !== undefined ? <AppText style={styles.pct} color={c.fg}>{pctText(pct)}</AppText> : null}
    </View>
  );
}

/** Custom marker views are bitmapped once drawn: tracking every frame is slow on Android. */
function BinMarker({ bin, selected, onPress }: { bin: Bin; selected: boolean; onPress?: (id: string) => void }) {
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 600);
    return () => clearTimeout(t);
  }, []);
  const tr = useTr();
  const sep = tr('، ', ', ');
  const pct = fillPercent(bin);
  return (
    <Marker
      coordinate={{ latitude: bin.location.lat, longitude: bin.location.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracks}
      accessibilityLabel={[binTitle(bin), binStateLabel(binDisplayState(bin)), pct !== undefined ? tr(`ممتلي ${pctText(pct)}`, `${pctText(pct)} full`) : null].filter(Boolean).join(sep)}
      onPress={() => onPress?.(bin.id)}
    >
      <BinPill bin={bin} selected={selected} />
    </Marker>
  );
}

/** Native map of smart bins (Expo Go, no API key). */
export function BinMap({ bins, selectedId, onSelectBin, center, style }: BinMapProps) {
  return (
    <View style={[styles.frame, style]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        toolbarEnabled={false}
      >
        {bins.map((b) => (
          // The key changes with state, fill and selection so the bitmap is redrawn, then tracking stops again.
          <BinMarker key={`${b.id}-${binDisplayState(b)}-${fillPercent(b)}-${selectedId === b.id}`} bin={b} selected={selectedId === b.id} onPress={onSelectBin} />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.line, minHeight: 240 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 8, borderRadius: radius.pill, borderWidth: 2 },
  pillOn: { minHeight: 38, paddingHorizontal: 12, borderWidth: 3 },
  pct: { fontFamily: fonts.sans600, fontSize: 12, lineHeight: 16 },
});
