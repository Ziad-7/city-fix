import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { StateMessage } from '@/components/requests';
import { useTr } from '@/i18n';
import type { LatLng } from '@/domain/types';
import { useCityCycle } from '@/store';
import { colors } from '@/theme/tokens';
import { haversineM } from '@/utils/geo';
import { BinMap } from './BinMap';
import { BinSheet } from './BinSheet';
import { binHref } from './links';

/** Body of the map tab when the "Smart bins" layer is on. The screen refreshes the bins while this is visible. */
export function BinsLayer({ center }: { center: LatLng }) {
  const tr = useTr();
  const bins = useCityCycle((s) => s.bins);
  const status = useCityCycle((s) => s.status);
  const refreshBins = useCityCycle((s) => s.refreshBins);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => bins.find((b) => b.id === selectedId) ?? null, [bins, selectedId]);

  const map = <BinMap bins={bins} selectedId={selected?.id ?? null} onSelectBin={setSelectedId} center={center} style={Platform.OS === 'web' ? undefined : styles.map} />;
  const empty = bins.length === 0;

  return (
    <View style={styles.body}>
      {Platform.OS === 'web' ? <ScrollView style={styles.webList} contentContainerStyle={styles.webListContent}>{map}</ScrollView> : map}

      {empty ? (
        <View style={styles.overlay}>
          {status === 'loading' || status === 'idle' ? (
            <StateMessage loading title={tr('بنحمّل الصناديق…', 'Loading the bins…')} />
          ) : (
            <StateMessage icon="trash" title={tr('مفيش صناديق ذكية هنا لسه', 'No smart bins here yet')} body={tr('لما تتركّب في منطقتك هتظهر هنا.', 'They will show up here once they are installed in your area.')} actionLabel={tr('حدّث', 'Refresh')} onAction={() => void refreshBins()} />
          )}
        </View>
      ) : null}

      {selected ? (
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <BinSheet
            bin={selected}
            distanceM={haversineM(center, selected.location)}
            onDetails={() => router.push(binHref(selected.id))}
            onClose={() => setSelectedId(null)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  map: { flex: 1, borderRadius: 0 },
  webList: { flex: 1 },
  webListContent: { padding: 16, paddingBottom: 220 },
  overlay: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.paper, justifyContent: 'center' },
  sheetWrap: { position: 'absolute', start: 12, end: 12, bottom: 12 },
});
