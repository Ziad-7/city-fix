import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, StatusChips } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { SERVICES } from '@/domain/services-catalog';
import { useTr } from '@/i18n';
import { statusLabel } from '@/i18n/labels';
import { isCriticalIncident } from '@/logic/priority';
import { STATUS_LABEL_AR } from '@/domain/types';
import type { RequestItem } from '@/store';
import { colors } from '@/theme/tokens';
import { isolateLtr } from '@/utils/digits';
import { relativeTime } from '@/utils/time';
import { RequestThumb } from './RequestThumb';
import { dayText, slotLabel } from './labels';

/** List row in the "آخر التحديثات" style: thumbnail, title, #ID + time, status chip. */
export function RequestCard({ item }: { item: RequestItem }) {
  const tr = useTr();
  const sep = tr('، ', ', ');
  const critical = item.kind === 'report' && !!item.incident && isCriticalIncident(item.incident);
  const meta = `${isolateLtr(`#${item.id}`)} · ${relativeTime(item.createdAt)}`;
  const isService = item.kind === 'service';
  const icon = isService
    ? (SERVICES.find((s) => s.serviceType === item.request.serviceType)?.icon ?? 'clipboard')
    : getCategory(item.categoryId).icon;
  return (
    <Card
      onPress={() => router.push(`/requests/${item.id}`)}
      accessibilityLabel={`${item.title}${sep}${critical ? `${tr('خطر', 'Danger')}${sep}` : ''}${statusLabel(item.status, STATUS_LABEL_AR[item.status])}`}
      testID={`request-${item.id}`}
    >
      <View style={styles.row}>
        <RequestThumb uri={isService ? undefined : item.report.photoUris[0]} icon={icon} tone={isService ? 'service' : 'report'} />
        <View style={styles.text}>
          <AppText variant="smallStrong" style={styles.title} numberOfLines={2}>{item.title}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>{meta}</AppText>
          {isService ? (
            <AppText variant="caption" color={colors.inkMuted}>
              {tr('الميعاد', 'Scheduled')}: {dayText(item.request.details.day)} · {slotLabel(item.request.details.slot)}
            </AppText>
          ) : null}
        </View>
        <StatusChips status={item.status} critical={critical} stack />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 15, lineHeight: 24 },
});
