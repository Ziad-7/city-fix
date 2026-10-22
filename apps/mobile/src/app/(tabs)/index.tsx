import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { EmergencyRow } from '@/components';
import { Grid3 } from '@/components/report/Grid3';
import { selectNearby } from '@/components/home/nearby';
import {
  EmptyNote, ErrorCard, Greeting, HeroCard, HomeHeader, NearbyCard, SectionTitle, ServiceTile, SkeletonRow,
} from '@/components/home/HomeParts';
import { CityCycleSection } from '@/components/home/CityCycleSection';
import { RequestCard } from '@/components/requests';
import { AppText, Button, Screen } from '@/components/ui';
import { DEFAULT_PLACE, findDistrict } from '@/domain/locations';
import type { IconName } from '@/domain/types';
import { refreshAll, useFollowingSet, useReports, useRequestItems, useSession } from '@/store';
import { placeName, useTr } from '@/i18n';
import { colors } from '@/theme/tokens';
import { greeting } from '@/utils/time';

type Tile = { icon: IconName; ar: string; en: string; href: string; testID: string };

const TILES: Tile[] = [
  { icon: 'alert-triangle', ar: 'بلاغ عن مشكلة', en: 'Report a problem', href: '/report/category', testID: 'tile-report' },
  { icon: 'trash', ar: 'رفع مخلفات', en: 'Bulky waste', href: '/services/bulky-waste', testID: 'tile-bulky' },
  { icon: 'tree', ar: 'صيانة الشجر', en: 'Tree care', href: '/services/tree', testID: 'tile-tree' },
  { icon: 'map', ar: 'خريطة المدينة', en: 'City map', href: '/map', testID: 'tile-map' },
  { icon: 'clipboard', ar: 'طلباتي', en: 'My requests', href: '/requests', testID: 'tile-requests' },
  { icon: 'bulb', ar: 'إنارة الشوارع', en: 'Streetlights', href: '/report/new?category=streetlight_out', testID: 'tile-streetlight' },
];

export default function HomeScreen() {
  const tr = useTr();
  const name = useSession((s) => s.name);
  const governorate = useSession((s) => s.governorate);
  const district = useSession((s) => s.district);

  const status = useReports((s) => s.status);
  const error = useReports((s) => s.error);
  const incidents = useReports((s) => s.incidents);
  const reports = useReports((s) => s.reports);
  const followIncident = useReports((s) => s.followIncident);
  const items = useRequestItems();

  const [refreshing, setRefreshing] = useState(false);
  const followed = useFollowingSet();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followFailed, setFollowFailed] = useState(false);

  const center = useMemo(() => {
    const d = findDistrict(governorate, district);
    return d ? { lat: d.lat, lng: d.lng } : { lat: DEFAULT_PLACE.lat, lng: DEFAULT_PLACE.lng };
  }, [governorate, district]);

  const nearby = useMemo(() => {
    const mine = new Set(reports.map((r) => r.incidentId));
    return selectNearby(incidents, mine, center, 2);
  }, [incidents, reports, center]);

  const latest = useMemo(() => items.slice(0, 2), [items]);

  const loading = (status === 'idle' || status === 'loading') && incidents.length === 0 && items.length === 0;
  const failed = status === 'error' && incidents.length === 0 && items.length === 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const onFollow = useCallback(
    async (id: string) => {
      setBusyId(id);
      setFollowFailed(false);
      try {
        await followIncident(id);
      } catch {
        setFollowFailed(true);
      } finally {
        setBusyId(null);
      }
    },
    [followIncident],
  );

  return (
    <Screen
      edges={['top']}
      padded={false}
      header={<HomeHeader />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} colors={[colors.red]} />}
      contentStyle={styles.content}
    >
      <Greeting greeting={greeting()} name={name} area={tr(`${governorate} · حي ${district}`, `${placeName(governorate)} · ${placeName(district)}`)} />

      <HeroCard />

      <View style={styles.section}>
        <SectionTitle title={tr('الخدمات', 'City services')} actionLabel={tr('كل الخدمات', 'All services')} onAction={() => router.push('/services')} />
        <Grid3>
          {TILES.map((t) => (
            <ServiceTile key={t.testID} testID={t.testID} icon={t.icon} label={tr(t.ar, t.en)} onPress={() => router.navigate(t.href)} />
          ))}
        </Grid3>
      </View>

      <CityCycleSection center={center} />

      {failed ? (
        <ErrorCard message={error ?? tr('حصلت مشكلة، جرّب تاني', 'Something went wrong. Try again')} onRetry={onRefresh} />
      ) : (
        <>
          <View style={styles.section}>
            <SectionTitle title={tr('حوالين بيتك', 'Near your home')} />
            {loading ? (
              <SkeletonRow />
            ) : nearby.length === 0 ? (
              <EmptyNote icon="check" text={tr('مفيش مشاكل مفتوحة حواليك دلوقتي.', 'No open problems near you right now.')} />
            ) : (
              nearby.map(({ incident, distanceM }) => (
                <NearbyCard
                  key={incident.id}
                  incident={incident}
                  distanceM={distanceM}
                  followed={followed.has(incident.id)}
                  busy={busyId === incident.id}
                  onFollow={() => onFollow(incident.id)}
                />
              ))
            )}
            {followFailed ? <AppText variant="caption" color={colors.urgent}>{tr('معرفناش نسجّل متابعتك، جرّب تاني.', "We couldn't save your follow. Try again.")}</AppText> : null}
          </View>

          <View style={styles.section}>
            <SectionTitle title={tr('آخر التحديثات', 'Latest updates')} actionLabel={items.length > 0 ? tr('كل الطلبات', 'All requests') : undefined} onAction={() => router.navigate('/requests')} />
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : latest.length === 0 ? (
              <View style={styles.emptyBlock}>
                <EmptyNote icon="clipboard" text={tr('لسه مفيش طلبات. أول بلاغ ليك هيظهر هنا.', 'No requests yet. Your first report will show up here.')} />
                <Button label={tr('بلّغ عن مشكلة', 'Report a problem')} icon="camera" variant="secondary" size="sm" onPress={() => router.push('/report/category')} />
              </View>
            ) : (
              latest.map((item) => <RequestCard key={item.id} item={item} />)
            )}
          </View>
        </>
      )}

      <EmergencyRow />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 18 },
  section: { gap: 10 },
  emptyBlock: { gap: 10 },
});
