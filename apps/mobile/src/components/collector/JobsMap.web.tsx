import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTr } from '@/i18n';
import { materialLabel } from '@/i18n/labels';
import { colors, radius } from '@/theme/tokens';
import { formatDistance } from '@/utils/geo';
import { formatKg } from '@/utils/money';
import { AppText } from '../ui/AppText';
import { Icon } from '../Icon';
import type { JobsMapProps } from './JobsMap.types';

/** Pin positions as 0..1 inside the bounds of the jobs and the origin (north up, east right). */
export function sketchPositions(points: { id: string; lat: number; lng: number }[]): Record<string, { x: number; y: number }> {
  if (points.length === 0) return {};
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const dLat = maxLat - minLat || 0.01;
  const dLng = maxLng - minLng || 0.01;
  const out: Record<string, { x: number; y: number }> = {};
  for (const p of points) out[p.id] = { x: 0.1 + 0.8 * ((p.lng - minLng) / dLng), y: 0.1 + 0.8 * (1 - (p.lat - minLat) / dLat) };
  return out;
}

/** Web preview stand-in: react-native-maps has no web support, so draw a simple sketch and list the jobs. */
export function JobsMap({ jobs, origin, selectedId, onSelect, style }: JobsMapProps) {
  const tr = useTr();
  const pos = useMemo(() => sketchPositions([{ id: '__origin', lat: origin.lat, lng: origin.lng }, ...jobs.map((j) => ({ id: j.id, lat: j.location.lat, lng: j.location.lng }))]), [jobs, origin]);
  return (
    <View style={[styles.frame, style]}>
      <View style={styles.banner}>
        <Icon name="map" size={18} color={colors.inkMuted} />
        <AppText variant="caption" color={colors.inkMuted} style={styles.flex}>
          {tr('الخريطة بتشتغل على الموبايل. دي رسمة بسيطة للأماكن التقريبية.', 'The map works on your phone. This is a simple sketch of the approximate areas.')}
        </AppText>
      </View>
      {/* Geography does not mirror: the sketch is always laid out west-to-east left-to-right, so it uses left/top on purpose. */}
      <View style={styles.sketch} accessibilityElementsHidden>
        <View style={[styles.dot, styles.me, { left: `${(pos.__origin?.x ?? 0.5) * 100}%`, top: `${(pos.__origin?.y ?? 0.5) * 100}%` }]} />
        {jobs.map((j) => {
          const p = pos[j.id];
          if (!p) return null;
          const on = selectedId === j.id;
          return <View key={j.id} style={[styles.dot, styles.job, on ? styles.jobOn : null, { left: `${p.x * 100}%`, top: `${p.y * 100}%` }]} />;
        })}
      </View>
      {jobs.map((j) => {
        const label = `${j.items.map((i) => materialLabel(i.materialId)).join(tr('، ', ', '))}${tr('، ', ', ')}${formatKg(j.estimatedKg)}`;
        return (
          <Pressable
            key={j.id}
            testID={`jobpin-${j.id}`}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === j.id }}
            accessibilityLabel={label}
            onPress={() => onSelect?.(j.id)}
            style={[styles.row, selectedId === j.id ? styles.rowOn : null]}
          >
            <View style={[styles.rowDot, selectedId === j.id ? { backgroundColor: colors.gold } : null]} />
            <AppText variant="smallStrong" style={styles.flex} numberOfLines={1}>{label}</AppText>
            {j.distanceM !== undefined ? <AppText variant="caption" color={colors.inkMuted}>{formatDistance(j.distanceM)}</AppText> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 8 },
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sketch: { height: 150, borderRadius: radius.md, backgroundColor: colors.mapGround, overflow: 'hidden', direction: 'ltr' },
  dot: { position: 'absolute', width: 22, height: 22, marginLeft: -11, marginTop: -11, borderRadius: 11, borderWidth: 3, borderColor: colors.surface },
  me: { backgroundColor: colors.ink },
  job: { backgroundColor: colors.red },
  jobOn: { backgroundColor: colors.gold, width: 28, height: 28, marginLeft: -14, marginTop: -14, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 8, borderRadius: radius.sm },
  rowOn: { backgroundColor: colors.goldSoft },
  rowDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.red },
});
