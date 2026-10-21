import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { REQUEST_FILTERS, RequestCard, StateMessage, filterRequests, type RequestFilter } from '@/components/requests';
import { AppText, Chip, Screen, ScreenHeader } from '@/components/ui';
import { refreshAll, useReports, useRequestItems, useServiceRequests } from '@/store';
import { colors } from '@/theme/tokens';

/** طلباتي: my reports and service bookings, newest first. */
export default function RequestsScreen() {
  const items = useRequestItems();
  const reportsStatus = useReports((s) => s.status);
  const reportsError = useReports((s) => s.error);
  const servicesStatus = useServiceRequests((s) => s.status);
  const servicesError = useServiceRequests((s) => s.error);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(() => filterRequests(items, filter), [items, filter]);
  const loading = items.length === 0 && (reportsStatus === 'idle' || reportsStatus === 'loading' || servicesStatus === 'idle' || servicesStatus === 'loading');
  const failed = reportsStatus === 'error' || servicesStatus === 'error';
  const errorText = reportsError ?? servicesError ?? undefined;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAll();
    } finally {
      setRefreshing(false);
    }
  }, []);

  let body: React.ReactNode;
  if (loading) {
    body = <StateMessage loading title="بنجيب طلباتك…" />;
  } else if (failed && items.length === 0) {
    body = <StateMessage tone="error" icon="wifi" title="مقدرناش نحمّل طلباتك" body={errorText ?? 'اتأكد من النت وجرّب تاني'} actionLabel="جرّب تاني" onAction={onRefresh} />;
  } else if (items.length === 0) {
    body = (
      <StateMessage
        icon="clipboard"
        title="لسه مفيش طلبات"
        body="أول ما تبلّغ عن مشكلة أو تحجز خدمة هتلاقيها هنا وتتابع حالتها."
        actionLabel="بلّغ عن مشكلة"
        onAction={() => router.push('/report/category')}
      />
    );
  } else if (visible.length === 0) {
    body = <StateMessage icon="search" title="مفيش طلبات في القسم ده" body="جرّب فلتر تاني من فوق." />;
  } else {
    body = (
      <View style={styles.list}>
        {failed ? (
          <AppText variant="caption" color={colors.urgent}>معرفناش نحدّث الطلبات. اسحب لتحت وجرّب تاني.</AppText>
        ) : null}
        {visible.map((item) => <RequestCard key={item.id} item={item} />)}
      </View>
    );
  }

  return (
    <Screen
      edges={['top']}
      header={
        <View>
          <ScreenHeader title="طلباتي" hideBack />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
            {REQUEST_FILTERS.map((f) => (
              <Chip key={f.id} label={f.labelAr} selected={filter === f.id} onPress={() => setFilter(f.id)} testID={`filter-${f.id}`} />
            ))}
          </ScrollView>
        </View>
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.red} colors={[colors.red]} />}
      contentStyle={styles.content}
    >
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  content: { paddingTop: 4 },
  list: { gap: 10 },
});
