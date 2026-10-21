import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { IncidentMap, NASR_CITY } from '@/components/map';
import { PinSheet, TopBar, filterPins, incidentToPin, type MapStatusFilter } from '@/components/map-screen';
import { StateMessage } from '@/components/requests';
import { AppText, Screen } from '@/components/ui';
import { findDistrict } from '@/domain/locations';
import { useTr } from '@/i18n';
import type { CategoryId } from '@/domain/types';
import { refreshAll, useFollowingSet, useReports, useSession } from '@/store';
import { colors, radius, shadows } from '@/theme/tokens';
import { haversineM } from '@/utils/geo';

/** CityPulse: every open and recent incident as a status-coloured pin, with filters and a detail card. */
export default function MapScreen() {
  const tr = useTr();
  const incidents = useReports((s) => s.incidents);
  const reports = useReports((s) => s.reports);
  const status = useReports((s) => s.status);
  const followIncident = useReports((s) => s.followIncident);
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);

  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>('all');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const followed = useFollowingSet();
  const [followBusy, setFollowBusy] = useState(false);

  const pins = useMemo(() => incidents.map(incidentToPin), [incidents]);
  const visible = useMemo(() => filterPins(pins, statusFilter, category), [pins, statusFilter, category]);
  const center = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : NASR_CITY;
  }, [governorate, district]);

  const selected = useMemo(() => incidents.find((i) => i.id === selectedId) ?? null, [incidents, selectedId]);
  // Hide the card when the filters remove the selected pin.
  const sheetIncident = selected && visible.some((p) => p.id === selected.id) ? selected : null;
  const myReport = sheetIncident ? reports.find((r) => r.incidentId === sheetIncident.id) : undefined;

  const select = (id: string) => {
    setSelectedId(id);
    setExpanded(false);
  };

  const follow = async () => {
    if (!sheetIncident) return;
    setFollowBusy(true);
    try {
      await followIncident(sheetIncident.id);
    } catch {
      // The card stays as it was; the button is available again.
    } finally {
      setFollowBusy(false);
    }
  };

  const details = () => {
    if (myReport) router.push(`/requests/${myReport.id}`);
    else setExpanded((e) => !e);
  };

  const emptyFilter = status === 'ready' && visible.length === 0;
  const emptyPill = (
    <View style={Platform.OS === 'web' ? styles.emptyInline : styles.empty} pointerEvents="none">
      <AppText variant="smallStrong" center>{tr('مفيش بلاغات بالفلتر ده', 'No reports match this filter')}</AppText>
    </View>
  );

  const map = (
    <IncidentMap
      pins={visible}
      selectedId={sheetIncident?.id ?? null}
      onSelectPin={select}
      center={center}
      style={Platform.OS === 'web' ? undefined : styles.map}
    />
  );

  return (
    <Screen
      edges={['top']}
      scroll={false}
      padded={false}
      header={<TopBar status={statusFilter} onStatus={setStatusFilter} category={category} onCategory={setCategory} />}
    >
      <View style={styles.body}>
        {Platform.OS === 'web' ? (
          <ScrollView style={styles.webList} contentContainerStyle={styles.webListContent}>
            {map}
            {emptyFilter ? emptyPill : null}
          </ScrollView>
        ) : (
          map
        )}

        {status === 'loading' && incidents.length === 0 ? (
          <View style={styles.overlay}><StateMessage loading title={tr('بنحمّل الخريطة…', 'Loading the map…')} /></View>
        ) : null}
        {status === 'error' && incidents.length === 0 ? (
          <View style={styles.overlay}>
            <StateMessage tone="error" icon="wifi" title={tr('مقدرناش نحمّل البلاغات', "We couldn't load the reports")} actionLabel={tr('جرّب تاني', 'Try again')} onAction={() => void refreshAll()} />
          </View>
        ) : null}
        {emptyFilter && Platform.OS !== 'web' ? emptyPill : null}

        {sheetIncident ? (
          <View style={styles.sheetWrap} pointerEvents="box-none">
            <PinSheet
              incident={sheetIncident}
              distanceM={haversineM(center, { lat: sheetIncident.location.lat, lng: sheetIncident.location.lng })}
              following={followed.has(sheetIncident.id)}
              followBusy={followBusy}
              myReportId={myReport?.id}
              expanded={expanded}
              onFollow={follow}
              onDetails={details}
              onClose={() => setSelectedId(null)}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  map: { flex: 1, borderRadius: 0 },
  webList: { flex: 1 },
  webListContent: { padding: 16, paddingBottom: 220 },
  overlay: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: colors.paper, justifyContent: 'center' },
  empty: { position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, ...shadows.card },
  emptyInline: { alignSelf: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12, ...shadows.card },
  sheetWrap: { position: 'absolute', start: 12, end: 12, bottom: 12 },
});
